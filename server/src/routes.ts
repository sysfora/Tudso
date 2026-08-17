import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import express, { type Request, type Response, type Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { authenticateWithEmailPassword, buildCallbackUrl, createAccount, exchangeDesktopToken, exchangeOAuthCallback, generateAuthState, getOAuthUrl, verifyAuthState } from './auth.js'
import { chat, getProfileContext, transcription, vision, buildChatMessages, buildSystemPrompt } from './ai.js'
import { beginPlainStream, endPlainStream, writePlainStream } from './stream.js'
import { config } from './config.js'
import { authCompletePage, loginPage } from './login.html.js'
import { aiRateLimiter, rateLimiter, requireAuth } from './middleware.js'
import { createConversation, createMessage, deleteConversation, deleteContext, deleteDesktopSession, deleteDevice, deleteResume, deleteUserData, getConversations, getContext, getDevices, getEntitlementForUser, getMessages, getOrCreateProfile, getResume, getSubscription, getUsageToday, incrementUsage, resumeStorageRef, updateContext, updateProfile, upsertResume, watchEntitlement } from './pocketbase.js'
import { extractText, parseResume } from './resume-parser.js'
import { deleteStoredObject, putResumeFile, readStoredObject } from './storage.js'
import { createCheckoutSession, createCustomerPortalSession, handleStripeWebhook, stripe } from './stripe.js'
import type { AIStreamHandler, ChatMessage, Plan } from './types.js'

const upload = multer({ dest: 'uploads/', limits: { fileSize: 10 * 1024 * 1024 } })

const router: Router = express.Router()

const pendingCodeTokens = new Map<string, { token: string; userId: string; email: string; state: string; createdAt: number }>()

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: config.app.version, env: config.app.env })
})

router.get('/updates/latest', (req, res) => {
  const channel = (req.query.channel as 'stable' | 'beta' | 'alpha') ?? 'stable'
  const currentVersion = (req.query.currentVersion as string) ?? '0.1.0'
  const latestVersion = config.updates[channel] ?? config.updates.stable
  const updateAvailable = compareVersions(currentVersion, latestVersion) < 0
  res.json({
    channel,
    currentVersion,
    latestVersion,
    updateAvailable,
    downloadUrl: config.updates.downloadUrl,
    releaseNotesUrl: config.updates.releaseNotesUrl,
  })
})

// Auth: desktop login page
router.get('/auth/desktop', (req: Request, res: Response) => {
  const state = req.query.state as string | undefined
  if (!state) {
    res.status(400).send('Missing state')
    return
  }
  const mode = req.query.mode === 'register' ? 'register' : 'login'
  res.setHeader('Content-Type', 'text/html')
  res.send(loginPage({ state, mode }))
})

function finishDesktopAuth(
  res: Response,
  auth: { token: string; userId: string; email: string },
  state: string,
): void {
  const code = crypto.randomUUID()
  pendingCodeTokens.set(code, { token: auth.token, userId: auth.userId, email: auth.email, state, createdAt: Date.now() })
  res.setHeader('Content-Type', 'text/html')
  res.send(authCompletePage(buildCallbackUrl(code, state)))
}

router.post('/auth/desktop/login', express.urlencoded({ extended: true }), async (req: Request, res: Response) => {
  const parsed = z.object({ state: z.string(), email: z.string().email(), password: z.string().min(1) }).safeParse(req.body)
  if (!parsed.success) {
    res.setHeader('Content-Type', 'text/html')
    res.status(400).send(loginPage({ state: String(req.body?.state ?? ''), error: 'Enter a valid email and password.', mode: 'login' }))
    return
  }
  const { state, email, password } = parsed.data
  if (!verifyAuthState(state)) {
    res.status(400).send('Invalid or expired state')
    return
  }
  const auth = await authenticateWithEmailPassword(email, password)
  if (!auth) {
    res.setHeader('Content-Type', 'text/html')
    res.status(401).send(loginPage({ state, error: 'Invalid email or password.', mode: 'login' }))
    return
  }
  finishDesktopAuth(res, auth, state)
})

router.post('/auth/desktop/register', express.urlencoded({ extended: true }), async (req: Request, res: Response) => {
  const parsed = z.object({
    state: z.string(),
    email: z.string().email(),
    password: z.string().min(8),
    passwordConfirm: z.string().min(8),
    name: z.string().trim().max(80).optional(),
  }).safeParse(req.body)
  if (!parsed.success) {
    res.setHeader('Content-Type', 'text/html')
    res.status(400).send(loginPage({
      state: String(req.body?.state ?? ''),
      error: 'Enter a valid email and a password with at least 8 characters.',
      mode: 'register',
    }))
    return
  }
  const { state, email, password, passwordConfirm, name } = parsed.data
  if (!verifyAuthState(state)) {
    res.status(400).send('Invalid or expired state')
    return
  }
  if (password !== passwordConfirm) {
    res.setHeader('Content-Type', 'text/html')
    res.status(400).send(loginPage({ state, error: 'Passwords do not match.', mode: 'register' }))
    return
  }
  const auth = await createAccount(email, password, name || email.split('@')[0] || 'Tudso user')
  if (!auth) {
    res.setHeader('Content-Type', 'text/html')
    res.status(409).send(loginPage({ state, error: 'Could not create account. That email may already be in use.', mode: 'register' }))
    return
  }
  finishDesktopAuth(res, auth, state)
})

router.post('/auth/desktop/oauth', express.urlencoded({ extended: true }), async (req: Request, res: Response) => {
  const { state, provider } = z.object({ state: z.string(), provider: z.enum(['google']) }).parse(req.body)
  if (!verifyAuthState(state)) {
    res.status(400).send('Invalid or expired state')
    return
  }
  try {
    const url = await getOAuthUrl(provider, state)
    res.redirect(url)
  } catch (error) {
    res.setHeader('Content-Type', 'text/html')
    res.status(400).send(loginPage({ state, error: (error as Error).message }))
  }
})

router.get('/auth/desktop/oauth/callback', async (req: Request, res: Response) => {
  const { code, state } = z.object({ code: z.string(), state: z.string() }).parse(req.query)
  const [authState, provider] = state.split(':') as [string, 'google']
  if (!verifyAuthState(authState)) {
    res.status(400).send('Invalid or expired state')
    return
  }
  const auth = await exchangeOAuthCallback(provider, code, authState)
  if (!auth) {
    res.status(400).send('OAuth authentication failed')
    return
  }
  const exchangeCode = crypto.randomUUID()
  pendingCodeTokens.set(exchangeCode, { token: auth.token, userId: auth.userId, email: auth.email, state: authState, createdAt: Date.now() })
  res.setHeader('Content-Type', 'text/html')
  res.send(authCompletePage(buildCallbackUrl(exchangeCode, authState)))
})

router.post('/auth/desktop/callback', async (req: Request, res: Response) => {
  const { code, state, deviceId, platform, appVersion } = z.object({
    code: z.string().min(1),
    state: z.string().min(1),
    deviceId: z.string().default('unknown'),
    platform: z.string().default('unknown'),
    appVersion: z.string().default('1.0.0'),
  }).parse(req.body)
  if (!verifyAuthState(state)) {
    res.status(400).json({ error: 'Invalid or expired state' })
    return
  }
  const pending = pendingCodeTokens.get(code)
  if (!pending || pending.state !== state || Date.now() - pending.createdAt > 5 * 60 * 1000) {
    res.status(400).json({ error: 'Invalid or expired code' })
    return
  }
  const result = await exchangeDesktopToken(pending.token, deviceId, platform, appVersion)
  if (!result) {
    res.status(401).json({ error: 'Invalid token' })
    return
  }
  pendingCodeTokens.delete(code)
  res.json({
    token: result.desktopToken,
    desktopToken: result.desktopToken,
    userId: result.userId,
    email: result.email,
  })
})

router.post('/auth/register', rateLimiter, async (req: Request, res: Response) => {
  const { email, password, name } = z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().optional() }).parse(req.body)
  const auth = await createAccount(email, password, name ?? email.split('@')[0])
  if (!auth) {
    res.status(409).json({ error: 'Email already registered' })
    return
  }
  res.json({ token: auth.token, userId: auth.userId, email: auth.email })
})

router.post('/auth/desktop/start', (req: Request, res: Response) => {
  const { deviceId, platform, appVersion } = z.object({
    deviceId: z.string().min(1),
    platform: z.string().default('unknown'),
    appVersion: z.string().default('1.0.0'),
  }).parse(req.body)
  const { state, url } = generateAuthState()
  res.json({ url, state, deviceId, platform, appVersion })
})

router.post('/auth/logout', requireAuth, async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''
  await deleteDesktopSession(token)
  res.json({ ok: true })
})

// Me
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const profile = await getOrCreateProfile(req.userId!)
  res.json({ userId: req.userId, email: req.email, profile })
})

router.get('/me/profile', requireAuth, async (req: Request, res: Response) => {
  const profile = await getOrCreateProfile(req.userId!)
  res.json(profile)
})

router.patch('/me/profile', requireAuth, rateLimiter, async (req: Request, res: Response) => {
  const schema = z.object({
    preferredName: z.string().optional(),
    profession: z.string().optional(),
    role: z.string().optional(),
    industry: z.string().optional(),
    education: z.string().optional(),
    skills: z.array(z.string()).optional(),
    goals: z.array(z.string()).optional(),
    communicationStyle: z.enum(['concise', 'balanced', 'detailed']).optional(),
    technicalLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    formal: z.boolean().optional(),
    stepByStep: z.boolean().optional(),
    examples: z.boolean().optional(),
    explainTerms: z.boolean().optional(),
    customContext: z.string().optional(),
  })
  const profile = await updateProfile(req.userId!, schema.parse(req.body))
  res.json(profile)
})

// Resume
router.post('/me/resume', requireAuth, upload.single('resume'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' })
    return
  }
  const tempPath = req.file.path
  let storedKey: { backend?: 'r2' | 'local'; key?: string } | undefined
  try {
    const mimeType = resumeMimeType(req.file)
    const fileBuffer = await fs.readFile(tempPath)
    const text = await extractText(tempPath, mimeType)
    const parsed = parseResume(text)
    const existing = await getResume(req.userId!)
    const stored = await putResumeFile({
      userId: req.userId!,
      buffer: fileBuffer,
      fileName: req.file.originalname || `resume${path.extname(req.file.originalname || '.pdf')}`,
      mimeType,
    })
    storedKey = stored
    const resume = await upsertResume(req.userId!, {
      extractedText: text,
      parsedData: parsed,
      filePath: stored.key,
      storage: stored.backend,
      fileName: stored.fileName,
      mimeType: stored.mimeType,
    })
    await deleteStoredObject(resumeStorageRef(existing)).catch(() => undefined)
    res.json({
      id: resume.id,
      parsed,
      skills: parsed.skills,
      filePath: stored.key,
      storage: stored.backend,
      fileName: stored.fileName,
    })
  } catch (error) {
    if (storedKey) await deleteStoredObject(storedKey).catch(() => undefined)
    console.error(error)
    res.status(400).json({ error: error instanceof Error ? error.message : 'Could not save resume' })
  } finally {
    await fs.unlink(tempPath).catch(() => undefined)
  }
})

router.get('/me/resume', requireAuth, async (req: Request, res: Response) => {
  const resume = await getResume(req.userId!)
  if (!resume) {
    res.status(404).json({ error: 'No resume found' })
    return
  }
  const stored = resumeStorageRef(resume)
  res.json({
    id: resume.id,
    parsedData: resume.parsedData,
    extractedText: resume.extractedText,
    filePath: stored.key ?? '',
    storage: stored.backend ?? '',
    fileName: resume.parsedData?.fileName ?? '',
  })
})

router.get('/me/resume/file', requireAuth, async (req: Request, res: Response) => {
  const resume = await getResume(req.userId!)
  if (!resume) {
    res.status(404).json({ error: 'No resume found' })
    return
  }
  const stored = resumeStorageRef(resume)
  if (!stored.key) {
    res.status(404).json({ error: 'Resume file is not stored' })
    return
  }
  try {
    const file = await readStoredObject(stored)
    const fileName = resume.parsedData?.fileName || path.basename(stored.key)
    res.setHeader('Content-Type', file.mimeType || resume.parsedData?.mimeType || 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/"/g, '')}"`)
    res.send(file.buffer)
  } catch (error) {
    console.error(error)
    res.status(404).json({ error: 'Resume file not found' })
  }
})

router.delete('/me/resume', requireAuth, async (req: Request, res: Response) => {
  await deleteResume(req.userId!)
  res.json({ ok: true })
})

// Conversations
router.get('/conversations', requireAuth, async (req: Request, res: Response) => {
  const conversations = await getConversations(req.userId!)
  res.json(conversations)
})

router.post('/conversations', requireAuth, rateLimiter, async (req: Request, res: Response) => {
  const { title } = z.object({ title: z.string().min(1) }).parse(req.body)
  const conversation = await createConversation(req.userId!, title)
  res.json(conversation)
})

router.get('/conversations/:id', requireAuth, async (req: Request, res: Response) => {
  const messages = await getMessages(req.userId!, req.params.id as string)
  res.json(messages)
})

router.delete('/conversations/:id', requireAuth, rateLimiter, async (req: Request, res: Response) => {
  await deleteConversation(req.userId!, req.params.id as string)
  res.json({ ok: true })
})

// AI
router.post('/ai/chat', requireAuth, aiRateLimiter, async (req: Request, res: Response) => {
  const schema = z.object({
    conversationId: z.string().optional(),
    message: z.string().min(1),
    stream: z.boolean().default(true),
    includeProfile: z.boolean().default(true),
    includeHistory: z.boolean().default(true),
  })
  const { conversationId, message, stream, includeProfile, includeHistory } = schema.parse(req.body)

  const [entitlement, historyRecords, profileContext] = await Promise.all([
    getEntitlementForUser(req.userId!),
    includeHistory && conversationId ? getMessages(req.userId!, conversationId) : Promise.resolve([]),
    includeProfile ? getProfileContext(req.userId!) : Promise.resolve({ profile: undefined, resume: undefined, contextEntries: undefined }),
  ])
  if (!entitlement?.aiAccess) {
    res.status(403).json({ error: 'AI access not available on your plan' })
    return
  }

  const history: ChatMessage[] = historyRecords
    .slice(-12)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  const { profile, resume, contextEntries } = profileContext
  const systemPrompt = buildSystemPrompt({
    profile,
    resume,
    contextEntries,
    communicationStyle: profile?.communicationStyle,
  })
  const messages = buildChatMessages(systemPrompt, history, message)

  if (stream) {
    beginPlainStream(res)
    let content = ''
    await chat(
      { messages, stream: true },
      {
        onDelta: (delta) => {
          content += delta
          writePlainStream(res, delta)
        },
        onDone: () => {
          endPlainStream(res)
          void persistChat(req.userId!, conversationId, message, content)
        },
        onError: (error) => {
          if (res.headersSent) {
            endPlainStream(res)
            return
          }
          res.status(500).json({ error: error.message })
        },
      } as AIStreamHandler,
    )
    return
  }

  const result = await chat({ messages })
  try {
    if (conversationId) {
      await createMessage(req.userId!, conversationId, 'user', storedUserContent(message))
      await createMessage(req.userId!, conversationId, 'assistant', result.content)
    }
    await incrementUsage(req.userId!, { requests: 1, tokens: result.usage?.totalTokens ?? 0 })
  } catch (error) {
    console.error('Failed to persist chat usage', error)
  }
  res.json(result)
})

router.post('/ai/vision', requireAuth, aiRateLimiter, async (req: Request, res: Response) => {
  const schema = z.object({
    image: z.string().min(1),
    message: z.string().min(1),
    conversationId: z.string().optional(),
  })
  const { image, message, conversationId } = schema.parse(req.body)

  const [entitlement, profileContext] = await Promise.all([
    getEntitlementForUser(req.userId!),
    getProfileContext(req.userId!),
  ])
  if (!entitlement?.screenAnalysis) {
    res.status(403).json({ error: 'Screen analysis not available on your plan' })
    return
  }

  const { profile, resume, contextEntries } = profileContext
  const systemPrompt = buildSystemPrompt({ profile, resume, contextEntries, screenContext: true })
  const messages = buildChatMessages(systemPrompt, [], message)
  beginPlainStream(res)
  let content = ''
  await vision(
    { messages, image },
    {
      onDelta: (delta) => {
        content += delta
        writePlainStream(res, delta)
      },
      onDone: () => {
        endPlainStream(res)
        void persistVision(req.userId!, conversationId, message, content)
      },
      onError: (error) => {
        if (res.headersSent) {
          endPlainStream(res)
          return
        }
        res.status(500).json({ error: error.message })
      },
    } as AIStreamHandler,
  )
})

router.post('/ai/transcribe', requireAuth, aiRateLimiter, upload.single('audio'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No audio uploaded' })
    return
  }
  const tempPath = req.file.path
  try {
    const buffer = await fs.readFile(tempPath)
    if (buffer.length < 500) {
      res.status(400).json({ error: 'Recording was too short' })
      return
    }
    const fileName = req.file.originalname?.includes('.') ? req.file.originalname : 'audio.webm'
    const text = await transcription(buffer, fileName)
    res.json({ text })
  } catch (error) {
    console.error('Failed to transcribe audio', error)
    res.status(500).json({ error: (error as Error).message || 'Transcription failed' })
  } finally {
    await fs.unlink(tempPath).catch(() => undefined)
  }
})

router.get('/ai/realtime/session', requireAuth, async (req: Request, res: Response) => {
  const entitlement = await getEntitlementForUser(req.userId!)
  if (!entitlement?.realtimeAccess) {
    res.status(403).json({ error: 'Realtime not available on your plan' })
    return
  }
  // For production, create a short-lived ephemeral session token from the provider
  res.json({ url: `${config.ai.baseUrl}/realtime?model=${encodeURIComponent(config.ai.realtimeModel)}`, model: config.ai.realtimeModel })
})

// Entitlements / Usage
router.get('/entitlements', requireAuth, async (req: Request, res: Response) => {
  const entitlement = await getEntitlementForUser(req.userId!)
  res.json(entitlement)
})

router.get('/entitlements/stream', requireAuth, async (req: Request, res: Response) => {
  req.socket.setTimeout(0)
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const send = async () => {
    const entitlement = await getEntitlementForUser(req.userId!)
    res.write(`data: ${JSON.stringify(entitlement)}\n\n`)
  }

  await send()
  const unsubscribe = await watchEntitlement(req.userId!, (entitlement) => {
    res.write(`data: ${JSON.stringify(entitlement)}\n\n`)
  })
  const poll = setInterval(() => {
    void send()
  }, 4000)

  const close = () => {
    clearInterval(poll)
    unsubscribe()
  }
  req.on('close', close)
  req.on('aborted', close)
})

router.get('/usage', requireAuth, async (req: Request, res: Response) => {
  const usage = await getUsageToday(req.userId!)
  const entitlement = await getEntitlementForUser(req.userId!)
  res.json({ usage, limits: entitlement?.usageLimits ?? {} })
})

// Billing
router.get('/billing/plans', (_req: Request, res: Response) => {
  res.json({
    free: config.stripe.priceIds.free,
    pro: config.stripe.priceIds.pro,
    premium: config.stripe.priceIds.premium,
  })
})

router.post('/billing/checkout', requireAuth, rateLimiter, async (req: Request, res: Response) => {
  const { plan } = z.object({ plan: z.enum(['pro', 'premium']) }).parse(req.body)
  const session = await createCheckoutSession(req.userId!, req.email ?? '', plan as Plan)
  res.json(session)
})

router.post('/billing/portal', requireAuth, async (req: Request, res: Response) => {
  const session = await createCustomerPortalSession(req.userId!)
  res.json(session)
})

router.get('/billing/subscription', requireAuth, async (req: Request, res: Response) => {
  const subscription = await getSubscription(req.userId!)
  res.json(subscription)
})

// Stripe webhook
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string
  if (!sig) {
    res.status(400).json({ error: 'Missing signature' })
    return
  }
  try {
    const event = stripe.webhooks.constructEvent(req.body as Buffer, sig, config.stripe.webhookSecret)
    await handleStripeWebhook(event)
    res.json({ received: true })
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
})

// Devices
router.get('/me/devices', requireAuth, async (req: Request, res: Response) => {
  const devices = await getDevices(req.userId!)
  res.json(devices)
})

router.delete('/me/devices/:deviceId', requireAuth, async (req: Request, res: Response) => {
  await deleteDevice(req.userId!, req.params.deviceId as string)
  res.json({ ok: true })
})

// Memory / Context
router.get('/me/context', requireAuth, async (req: Request, res: Response) => {
  const context = await getContext(req.userId!)
  res.json(context)
})

router.patch('/me/context', requireAuth, async (req: Request, res: Response) => {
  const { entries } = z.object({ entries: z.array(z.object({ id: z.string(), text: z.string(), created: z.string() })) }).parse(req.body)
  const context = await updateContext(req.userId!, entries)
  res.json(context)
})

router.delete('/me/context', requireAuth, async (req: Request, res: Response) => {
  await deleteContext(req.userId!)
  res.json({ ok: true })
})

// Account export
router.get('/me/export', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId!
  const [profile, resume, conversations, subscription, entitlement, usage] = await Promise.all([
    getOrCreateProfile(userId),
    getResume(userId),
    getConversations(userId),
    getSubscription(userId),
    getEntitlementForUser(userId),
    getUsageToday(userId),
  ])
  const messages = (await Promise.all(conversations.map((c: { id: string }) => getMessages(userId, c.id)))).flat()
  res.json({ profile, resume, conversations, messages, subscription, entitlement, usage })
})

// Account deletion
router.delete('/me/account', requireAuth, async (req: Request, res: Response) => {
  await deleteUserData(req.userId!)
  res.json({ ok: true })
})

async function persistChat(userId: string, conversationId: string | undefined, message: string, content: string) {
  try {
    if (conversationId && content) {
      await createMessage(userId, conversationId, 'user', storedUserContent(message))
      await createMessage(userId, conversationId, 'assistant', content)
    }
    await incrementUsage(userId, { requests: 1 })
  } catch (error) {
    console.error('Failed to persist chat usage', error)
  }
}

async function persistVision(userId: string, conversationId: string | undefined, message: string, content: string) {
  try {
    if (conversationId) {
      await createMessage(userId, conversationId, 'user', storedUserContent(message))
      await createMessage(userId, conversationId, 'assistant', content || '(no response)')
    }
  } catch (error) {
    console.error('Failed to persist vision messages', pocketbaseError(error))
  }
  try {
    await incrementUsage(userId, { requests: 1, screenAnalyses: 1 })
  } catch (error) {
    console.error('Failed to persist vision usage', pocketbaseError(error))
  }
}

function storedUserContent(message: string): string {
  const transcript = message.match(/Transcript:\s*([\s\S]+)$/i)?.[1]?.trim()
  if (transcript && transcript !== '(no speech in this moment)') return transcript
  if (/live interview copilot|Audio source:/i.test(message)) return 'Live copilot'
  if (/Answer whatever needs a response on this screenshot/i.test(message)) return 'Answer from screen'
  return message
}

function pocketbaseError(error: unknown): unknown {
  const err = error as { data?: unknown; response?: unknown; message?: string }
  return err.data ?? err.response ?? err.message ?? error
}

function resumeMimeType(file: Express.Multer.File): string {
  const name = (file.originalname || '').toLowerCase()
  if (name.endsWith('.pdf')) return 'application/pdf'
  if (name.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (name.endsWith('.txt') || name.endsWith('.md')) return 'text/plain'
  if (file.mimetype && file.mimetype !== 'application/octet-stream') return file.mimetype
  return 'application/pdf'
}

function compareVersions(a: string, b: string): number {
  const partsA = a.replace(/^v/, '').split('.').map(Number)
  const partsB = b.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i += 1) {
    const numA = Number.isNaN(partsA[i]) ? 0 : (partsA[i] ?? 0)
    const numB = Number.isNaN(partsB[i]) ? 0 : (partsB[i] ?? 0)
    if (numA !== numB) return numA - numB
  }
  return 0
}

export default router
