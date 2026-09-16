import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { dirname, join } from 'node:path'
import express, { type Request, type Response, type Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { authenticateWithEmailPassword, buildCallbackUrl, clearAuthState, confirmEmailChange, confirmEmailVerification, confirmPasswordReset, createAccount, createAppSession, exchangeOAuthCallback, generateAuthState, getOAuthUrl, requestEmailVerification, requestPasswordReset, resolveAccessToken, verifyAuthState } from './auth.js'
import { chat, transcription, vision, buildChatMessages, buildSystemPrompt, applyTurnContext, resolveChatModel, resolveVisionModel, extractMemoryFacts, extractResumeStructured } from './ai.js'
import { beginPlainStream, endPlainStream, writePlainStream } from './stream.js'
import { config } from './config.js'
import { logError } from './log.js'
import { authCompletePage, checkEmailPage, confirmEmailChangePage, forgotPasswordPage, loginPage, resetPasswordPage, sessionExpiredPage, statusPage, subscribePage } from './login.html.js'
import { aiRateLimiter, rateLimiter, requireAuth, requireInterviewSession, requireReleaseUpload, sensitiveRateLimiter } from './middleware.js'
import { changeAccountPassword, getAccountAvatar, getAccountIdentity, publicAccount, updateAccountAvatar, updateAccountName } from './account.js'
import { deleteDesktopSession, deleteDevice, deleteOtherDesktopSessions, deleteUserData, ensureUserBilling, getDevices, getEntitlementForUser, getSubscription, getUsageHistory, getUsageToday, getUserBilling, incrementUsage, consumeInterviewCredit, syncUserBilling, watchEntitlement } from './pocketbase.js'
import { MAX_MEMORIES, MAX_MEMORY_CHARS } from './memory.js'
import { getSessionPrompt, rememberSessionPrompt, SESSION_PROMPT_REQUIRED } from './session-prompt.js'
import { isAllowedReleaseName, publishStagedRelease, readGitHubRelease, readReleaseManifest, releasesDir, toLatestUpdate } from './releases.js'
import { clearLiveEntitlementCache, createCheckoutSession, createCustomerPortalSession, finalizeCheckoutSession, getBillingOverview, handleStripeWebhook, listPaidPlanPrices, stripe } from './stripe.js'
import { hasProductAccess, CHECKOUT_PLANS } from './plans.js'
import type { AIStreamHandler, ChatMessage, ParsedResume, UserProfile } from './types.js'
import { WEB_DEVICE_ID, clearWebSessionCookie, setWebSessionCookie } from './web-session.js'
import { createInterviewSession } from './interview-session.js'

const DEVICE_ID = z.string().min(1).max(128).regex(/^[a-zA-Z0-9._:-]+$/)

function bearerToken(req: Request): string {
  const header = req.headers.authorization
  return header?.startsWith('Bearer ') ? header.slice(7) : ''
}

const upload = multer({ dest: 'uploads/', limits: { fileSize: 10 * 1024 * 1024 } })

const AVATAR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!AVATAR_MIME[file.mimetype]) {
      cb(new Error('Use a JPEG, PNG, WebP, or GIF image.'))
      return
    }
    cb(null, true)
  },
})

function acceptAvatar(req: Request, res: Response, next: () => void) {
  avatarUpload.single('avatar')(req, res, (err: unknown) => {
    if (!err) {
      next()
      return
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'Image must be 2 MB or smaller.' })
      return
    }
    res.status(400).json({ error: err instanceof Error ? err.message : 'Could not upload that image.' })
  })
}

const clientProfileSchema = z.object({
  preferredName: z.string().max(120).optional(),
  profession: z.string().max(160).optional(),
  role: z.string().max(160).optional(),
  industry: z.string().max(160).optional(),
  education: z.string().max(200).optional(),
  skills: z.array(z.string().max(80)).max(50).optional(),
  goals: z.array(z.string().max(200)).max(30).optional(),
  communicationStyle: z.enum(['concise', 'balanced', 'detailed']).optional(),
  technicalLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  formal: z.boolean().optional(),
  stepByStep: z.boolean().optional(),
  examples: z.boolean().optional(),
  explainTerms: z.boolean().optional(),
  customContext: z.string().max(2000).optional(),
}).optional()

const clientMemoriesSchema = z.array(z.string().max(MAX_MEMORY_CHARS)).max(MAX_MEMORIES).optional()

const clientResumeSchema = z.object({
  name: z.string().max(120).optional(),
  headline: z.string().max(200).optional(),
  summary: z.string().max(2000).optional(),
  skills: z.array(z.string().max(80)).max(50).optional(),
  languages: z.array(z.string().max(80)).max(20).optional(),
  experience: z.array(z.object({
    company: z.string().max(160).optional(),
    role: z.string().max(160).optional(),
    duration: z.string().max(80).optional(),
    description: z.string().max(800).optional(),
  })).max(16).optional(),
  education: z.array(z.object({
    institution: z.string().max(160).optional(),
    degree: z.string().max(160).optional(),
    year: z.string().max(20).optional(),
  })).max(8).optional(),
  projects: z.array(z.object({
    name: z.string().max(160).optional(),
    description: z.string().max(800).optional(),
    technologies: z.array(z.string().max(80)).max(20).optional(),
  })).max(12).optional(),
  certifications: z.array(z.string().max(200)).max(16).optional(),
  achievements: z.array(z.string().max(400)).max(16).optional(),
  rawText: z.string().max(8000).optional(),
}).optional()

function clientProfile(userId: string, body?: z.infer<typeof clientProfileSchema>): UserProfile | undefined {
  if (!body) return undefined
  return {
    id: userId,
    user: userId,
    preferredName: body.preferredName,
    profession: body.profession,
    role: body.role,
    industry: body.industry,
    education: body.education,
    skills: body.skills ?? [],
    goals: body.goals ?? [],
    communicationStyle: body.communicationStyle,
    technicalLevel: body.technicalLevel,
    formal: body.formal,
    stepByStep: body.stepByStep,
    examples: body.examples,
    explainTerms: body.explainTerms,
    customContext: body.customContext,
    created: '',
    updated: '',
  }
}

function promptFromClient(
  userId: string,
  profileBody?: z.infer<typeof clientProfileSchema>,
  memories?: string[],
  resumeBody?: z.infer<typeof clientResumeSchema>,
) {
  return {
    profile: clientProfile(userId, profileBody),
    contextEntries: memories?.map((entry) => entry.trim()).filter(Boolean).slice(0, MAX_MEMORIES),
    resume: clientResume(resumeBody),
  }
}

function clientResume(body?: z.infer<typeof clientResumeSchema>): ParsedResume | undefined {
  if (!body) return undefined
  return {
    name: body.name,
    headline: body.headline,
    summary: body.summary,
    rawText: body.rawText,
    skills: body.skills ?? [],
    languages: body.languages ?? [],
    experience: body.experience ?? [],
    education: body.education ?? [],
    projects: body.projects ?? [],
    certifications: body.certifications ?? [],
    achievements: body.achievements ?? [],
  }
}

function hasSessionContext(
  profileBody?: z.infer<typeof clientProfileSchema>,
  memories?: string[],
  resumeBody?: z.infer<typeof clientResumeSchema>,
) {
  return profileBody !== undefined || memories !== undefined || resumeBody !== undefined
}

function resolveSessionPrompt(
  userId: string,
  conversationId: string | undefined,
  profileBody?: z.infer<typeof clientProfileSchema>,
  memories?: string[],
  resumeBody?: z.infer<typeof clientResumeSchema>,
): string | null {
  if (hasSessionContext(profileBody, memories, resumeBody)) {
    const { profile, contextEntries, resume } = promptFromClient(userId, profileBody, memories, resumeBody)
    const prompt = buildSystemPrompt({
      profile,
      resume,
      contextEntries,
      communicationStyle: profile?.communicationStyle,
    })
    if (conversationId) rememberSessionPrompt(userId, conversationId, prompt)
    return prompt
  }
  if (conversationId) {
    return getSessionPrompt(userId, conversationId) ?? null
  }
  return buildSystemPrompt({})
}

function entitled(entitlement: { plan?: string | null; status?: string | null; interviewCredits?: number } | null | undefined): boolean {
  return hasProductAccess(entitlement?.plan, entitlement?.status, entitlement?.interviewCredits)
}

const router: Router = express.Router()

const pendingCodeTokens = new Map<string, { token: string; userId: string; email: string; state: string; createdAt: number }>()
const PENDING_CODE_TTL_MS = 30 * 60 * 1000

// B-4: Periodically evict expired pending code tokens to prevent unbounded map growth
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of pendingCodeTokens) {
    if (now - entry.createdAt > PENDING_CODE_TTL_MS) pendingCodeTokens.delete(key)
  }
}, 5 * 60 * 1000).unref()

function pendingAuth(code: string, state: string) {
  const pending = pendingCodeTokens.get(code)
  if (!pending || pending.state !== state || Date.now() - pending.createdAt > PENDING_CODE_TTL_MS) return null
  return pending
}

function touchPending(code: string) {
  const pending = pendingCodeTokens.get(code)
  if (pending) pending.createdAt = Date.now()
}

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: config.app.version, env: config.app.env })
})

router.get('/updates/latest', async (req, res) => {
  const channel = (req.query.channel as 'stable' | 'beta' | 'alpha') ?? 'stable'
  const currentVersion = (req.query.currentVersion as string) ?? config.app.version
  const localManifest = await readReleaseManifest()
  if (localManifest?.files.length) {
    res.json(toLatestUpdate(localManifest, currentVersion, channel))
    return
  }
  const githubRelease = await readGitHubRelease()
  res.json(githubRelease
    ? toLatestUpdate(githubRelease.manifest, currentVersion, channel, {
      fileUrls: githubRelease.urls,
      releaseNotesUrl: githubRelease.releaseNotesUrl,
      source: 'github',
    })
    : toLatestUpdate(null, currentVersion, channel))
})

const MAX_RELEASE_BYTES = 512 * 1024 * 1024

function acceptReleaseFiles(req: Request, res: Response, next: () => void) {
  req.setTimeout(30 * 60 * 1000)
  res.setTimeout(30 * 60 * 1000)
  const staging = join(dirname(releasesDir()), `releases-incoming-${crypto.randomUUID()}`)
  void fs.mkdir(staging, { recursive: true }).then(() => {
    const upload = multer({
      storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, staging),
        filename: (_req, file, cb) => {
          const name = file.originalname.replaceAll('\\', '/').split('/').pop() ?? ''
          if (!isAllowedReleaseName(name)) {
            cb(new Error('Unsupported file'), '')
            return
          }
          cb(null, name)
        },
      }),
      limits: { fileSize: MAX_RELEASE_BYTES, files: 40 },
      fileFilter: (_req, file, cb) => {
        const name = file.originalname.replaceAll('\\', '/').split('/').pop() ?? ''
        if (!isAllowedReleaseName(name)) {
          cb(new Error(`Unsupported file: ${name}`))
          return
        }
        cb(null, true)
      },
    }).array('files', 40)
    upload(req, res, (err: unknown) => {
      if (err) {
        void fs.rm(staging, { recursive: true, force: true })
        res.status(400).json({ error: err instanceof Error ? err.message : 'Could not upload installers' })
        return
      }
      ;(req as Request & { releaseStaging?: string }).releaseStaging = staging
      next()
    })
  }).catch(() => {
    res.status(500).json({ error: 'Could not start upload' })
  })
}

router.post('/internal/releases', requireReleaseUpload, acceptReleaseFiles, async (req: Request, res: Response) => {
  const staging = (req as Request & { releaseStaging?: string }).releaseStaging
  try {
    if (!staging) throw new Error('Upload failed')
    const version = typeof req.body?.version === 'string' ? req.body.version : ''
    const manifest = await publishStagedRelease(version, staging)
    res.json({ ok: true, version: manifest.version, files: manifest.files.length })
  } catch (error) {
    if (staging) await fs.rm(staging, { recursive: true, force: true }).catch(() => undefined)
    logError('Failed to publish desktop release', error)
    res.status(400).json({ error: error instanceof Error ? error.message : 'Could not publish release' })
  }
})

function html(res: Response, page: string, status = 200) {
  res.setHeader('Content-Type', 'text/html')
  res.status(status).send(page)
}

function verifyInboxPage(email: string, state: string) {
  return checkEmailPage({
    title: 'Verify your email',
    lede: `We sent a verification link to ${email}. Open it, then sign in to Tudso.`,
    email,
    state,
    resendAction: '/auth/desktop/verify/resend',
  })
}

router.get('/auth/desktop', async (req: Request, res: Response) => {
  const state = req.query.state as string | undefined
  if (!state) {
    res.redirect('/login')
    return
  }
  if (!verifyAuthState(state)) {
    res.redirect('/login?error=expired')
    return
  }
  const cookieToken = typeof req.cookies?.token === 'string' ? req.cookies.token : ''
  if (cookieToken) {
    const resolved = await resolveAccessToken(cookieToken)
    if (resolved?.userId) {
      await finishDesktopAuth(res, { token: '', userId: resolved.userId, email: resolved.email }, state)
      return
    }
  }
  const login = new URL('/login', config.app.url)
  login.searchParams.set('state', state)
  if (req.query.mode === 'register') login.searchParams.set('mode', 'register')
  login.searchParams.set('prompt', '1')
  res.redirect(`${login.pathname}${login.search}`)
})

async function finishDesktopAuth(
  res: Response,
  auth: { token: string; userId: string; email: string },
  state: string,
): Promise<void> {
  try {
    await startWebSession(res, { userId: auth.userId, email: auth.email })
  } catch (error) {
    logError('Could not persist web session during app sign-in', error)
  }
  const code = crypto.randomUUID()
  pendingCodeTokens.set(code, { token: auth.token, userId: auth.userId, email: auth.email, state, createdAt: Date.now() })
  res.setHeader('Content-Type', 'text/html')
  const entitlement = await getEntitlementForUser(auth.userId)
  if (!entitled(entitlement)) {
    const prices = await listPaidPlanPrices()
    res.send(subscribePage({ code, state, email: auth.email, prices }))
    return
  }
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
    html(res, loginPage({ state, error: 'Invalid email or password.', mode: 'login' }), 401)
    return
  }
  if (!auth.verified) {
    await requestEmailVerification(auth.email)
    html(res, verifyInboxPage(auth.email, state))
    return
  }
  await finishDesktopAuth(res, auth, state)
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
    html(res, loginPage({ state, error: 'Could not create account. That email may already be in use.', mode: 'register' }), 409)
    return
  }
  if (!auth.verified) {
    html(res, verifyInboxPage(auth.email, state))
    return
  }
  await finishDesktopAuth(res, auth, state)
})

router.post('/auth/desktop/oauth', express.urlencoded({ extended: true }), async (req: Request, res: Response) => {
  const { state, provider, mode } = z.object({
    state: z.string(),
    provider: z.enum(['google']),
    mode: z.enum(['login', 'register']).optional(),
  }).parse(req.body)
  if (!verifyAuthState(state)) {
    res.status(400).send('Invalid or expired state')
    return
  }
  try {
    const url = await getOAuthUrl(provider, state)
    res.redirect(url)
  } catch (error) {
    logError('Google sign-in start failed', error)
    res.setHeader('Content-Type', 'text/html')
    res.status(400).send(loginPage({
      state,
      error: error instanceof Error ? error.message : "Google sign-in isn't available right now. Use email instead.",
      mode: mode === 'register' ? 'register' : 'login',
    }))
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
  if (!auth.verified) {
    await requestEmailVerification(auth.email)
    html(res, verifyInboxPage(auth.email, authState))
    return
  }
  await finishDesktopAuth(res, auth, authState)
})

router.get('/auth/desktop/forgot', (req: Request, res: Response) => {
  const state = typeof req.query.state === 'string' ? req.query.state : undefined
  html(res, forgotPasswordPage({ state }))
})

router.post('/auth/desktop/forgot', sensitiveRateLimiter, async (req: Request, res: Response) => {
  const parsed = z.object({
    email: z.string().email(),
    state: z.string().optional(),
  }).safeParse(req.body)
  const state = parsed.success ? parsed.data.state : String(req.body?.state ?? '') || undefined
  if (!parsed.success) {
    html(res, forgotPasswordPage({ state, error: 'Enter a valid email.', email: String(req.body?.email ?? '') }), 400)
    return
  }
  await requestPasswordReset(parsed.data.email)
  html(res, checkEmailPage({
    title: 'Check your email',
    lede: `If an account exists for ${parsed.data.email}, we sent a reset link. It expires in 30 minutes.`,
    state,
  }))
})

router.post('/auth/desktop/verify/resend', sensitiveRateLimiter, async (req: Request, res: Response) => {
  const parsed = z.object({
    email: z.string().email(),
    state: z.string().optional(),
  }).safeParse(req.body)
  if (!parsed.success) {
    html(res, statusPage({ title: 'Verify your email', heading: 'Could not resend', lede: 'Enter a valid email and try again.' }), 400)
    return
  }
  await requestEmailVerification(parsed.data.email)
  html(res, verifyInboxPage(parsed.data.email, parsed.data.state ?? ''))
})

router.get('/auth/verify-email', async (req: Request, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token : ''
  if (!token) {
    html(res, statusPage({
      title: 'Verify email',
      heading: 'Missing verification link',
      lede: 'Open the link from your email, or return to Tudso and sign in to send a new one.',
    }), 400)
    return
  }
  const ok = await confirmEmailVerification(token)
  if (!ok) {
    html(res, statusPage({
      title: 'Verify email',
      heading: 'This link is not valid',
      lede: 'It may have expired. Return to Tudso and sign in to send a new verification email.',
    }), 400)
    return
  }
  html(res, statusPage({
    title: 'Email verified',
    heading: 'Email verified',
    lede: 'Return to Tudso and sign in to continue.',
  }))
})

router.get('/auth/reset-password', (req: Request, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token : ''
  if (!token) {
    html(res, statusPage({
      title: 'Reset password',
      heading: 'Missing reset link',
      lede: 'Open the link from your email, or request a new one from the sign-in page.',
    }), 400)
    return
  }
  html(res, resetPasswordPage({ token }))
})

router.post('/auth/reset-password', sensitiveRateLimiter, async (req: Request, res: Response) => {
  const parsed = z.object({
    token: z.string().min(1),
    password: z.string().min(8),
    passwordConfirm: z.string().min(8),
  }).safeParse(req.body)
  if (!parsed.success) {
    html(res, resetPasswordPage({
      token: String(req.body?.token ?? ''),
      error: 'Use a password with at least 8 characters.',
    }), 400)
    return
  }
  if (parsed.data.password !== parsed.data.passwordConfirm) {
    html(res, resetPasswordPage({ token: parsed.data.token, error: 'Passwords do not match.' }), 400)
    return
  }
  const ok = await confirmPasswordReset(parsed.data.token, parsed.data.password, parsed.data.passwordConfirm)
  if (!ok) {
    html(res, resetPasswordPage({
      token: parsed.data.token,
      error: 'This reset link is not valid or has expired. Request a new one from the sign-in page.',
    }), 400)
    return
  }
  html(res, statusPage({
    title: 'Password updated',
    heading: 'Password updated',
    lede: 'Return to Tudso and sign in with your new password.',
  }))
})

router.get('/auth/confirm-email-change', (req: Request, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token : ''
  if (!token) {
    html(res, statusPage({
      title: 'Confirm email',
      heading: 'Missing confirmation link',
      lede: 'Open the link from your email to confirm the new address.',
    }), 400)
    return
  }
  html(res, confirmEmailChangePage({ token }))
})

router.post('/auth/confirm-email-change', sensitiveRateLimiter, async (req: Request, res: Response) => {
  const parsed = z.object({
    token: z.string().min(1),
    password: z.string().min(1),
  }).safeParse(req.body)
  if (!parsed.success) {
    html(res, confirmEmailChangePage({
      token: String(req.body?.token ?? ''),
      error: 'Enter your current password.',
    }), 400)
    return
  }
  const ok = await confirmEmailChange(parsed.data.token, parsed.data.password)
  if (!ok) {
    html(res, confirmEmailChangePage({
      token: parsed.data.token,
      error: 'Could not confirm. Check your password, or request a new email change.',
    }), 400)
    return
  }
  html(res, statusPage({
    title: 'Email updated',
    heading: 'Email updated',
    lede: 'Return to Tudso and sign in with your new email.',
  }))
})

async function sendSubscribePage(
  res: Response,
  pending: { email: string },
  code: string,
  state: string,
  error?: string,
) {
  const prices = await listPaidPlanPrices()
  res.setHeader('Content-Type', 'text/html')
  res.send(subscribePage({ code, state, email: pending.email, prices, error }))
}

router.get('/auth/desktop/subscribe', async (req: Request, res: Response) => {
  const parsed = z.object({ code: z.string().min(1), state: z.string().min(1) }).safeParse(req.query)
  if (!parsed.success) {
    res.status(400).send(sessionExpiredPage())
    return
  }
  const { code, state } = parsed.data
  const pending = pendingAuth(code, state)
  if (!pending) {
    res.status(400).send(sessionExpiredPage())
    return
  }
  const entitlement = await getEntitlementForUser(pending.userId)
  if (entitled(entitlement)) {
    res.setHeader('Content-Type', 'text/html')
    res.send(authCompletePage(buildCallbackUrl(code, state), {
      title: "You're ready",
      lede: 'Your plan is active. Returning to the Tudso app.',
    }))
    return
  }
  await sendSubscribePage(res, pending, code, state)
})

router.post('/auth/desktop/free', express.urlencoded({ extended: true }), async (req: Request, res: Response) => {
  const parsed = z.object({ code: z.string().min(1), state: z.string().min(1) }).safeParse(req.body)
  if (!parsed.success) {
    res.status(400).send(sessionExpiredPage())
    return
  }
  const { code, state } = parsed.data
  const pending = pendingAuth(code, state)
  if (!pending) {
    res.status(400).send(sessionExpiredPage())
    return
  }
  touchPending(code)
  const entitlement = await getEntitlementForUser(pending.userId)
  if (entitled(entitlement)) {
    res.setHeader('Content-Type', 'text/html')
    res.send(authCompletePage(buildCallbackUrl(code, state), {
      title: "You're ready",
      lede: 'Your plan is active. Returning to the Tudso app.',
    }))
    return
  }
  await syncUserBilling(pending.userId, { plan: 'free', planStatus: 'unpaid', interviewCredits: 3 })
  clearLiveEntitlementCache(pending.userId)
  const updated = await getUserBilling(pending.userId)
  if (updated?.plan !== 'free') {
    await sendSubscribePage(res, pending, code, state, 'Could not activate the free plan. Please try again.')
    return
  }
  res.setHeader('Content-Type', 'text/html')
  res.send(authCompletePage(buildCallbackUrl(code, state), {
    title: "You're ready",
    lede: 'Your free plan is active. Returning to the Tudso app. You can close this tab after it opens.',
  }))
})

router.post('/auth/desktop/subscribe', express.urlencoded({ extended: true }), async (req: Request, res: Response) => {
  const parsed = z.object({
    code: z.string().min(1),
    state: z.string().min(1),
    plan: z.enum(CHECKOUT_PLANS),
  }).safeParse(req.body)
  if (!parsed.success) {
    res.status(400).send(sessionExpiredPage())
    return
  }
  const { code, state, plan } = parsed.data
  const pending = pendingAuth(code, state)
  if (!pending) {
    res.status(400).send(sessionExpiredPage())
    return
  }
  touchPending(code)
  const entitlement = await getEntitlementForUser(pending.userId)
  if (entitled(entitlement)) {
    res.setHeader('Content-Type', 'text/html')
    res.send(authCompletePage(buildCallbackUrl(code, state), {
      title: "You're ready",
      lede: 'Your plan is active. Returning to the Tudso app.',
    }))
    return
  }
  try {
    const checkout = await createCheckoutSession(pending.userId, pending.email, plan, {
      successUrl: `${config.app.url}/auth/desktop/subscribed?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${config.app.url}/auth/desktop/subscribe?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
    })
    res.redirect(checkout.url)
  } catch (error) {
    await sendSubscribePage(res, pending, code, state, error instanceof Error ? error.message : 'Could not start checkout.')
  }
})

router.get('/auth/desktop/subscribed', async (req: Request, res: Response) => {
  const parsed = z.object({
    code: z.string().min(1),
    state: z.string().min(1),
    session_id: z.string().min(1).optional(),
  }).safeParse(req.query)
  if (!parsed.success) {
    res.status(400).send(sessionExpiredPage())
    return
  }
  const { code, state, session_id: sessionId } = parsed.data
  const pending = pendingAuth(code, state)
  if (!pending) {
    res.status(400).send(sessionExpiredPage())
    return
  }
  touchPending(code)
  let paid = false
  if (sessionId) {
    try {
      paid = await finalizeCheckoutSession(sessionId, pending.userId)
    } catch (error) {
      logError('Failed to finalize checkout', error, { user: pending.userId })
    }
  }
  if (!paid) {
    const entitlement = await getEntitlementForUser(pending.userId)
    paid = entitled(entitlement)
  }
  if (!paid) {
    await sendSubscribePage(res, pending, code, state, 'Payment is not complete yet. Subscribe again, or wait a moment and refresh.')
    return
  }
  res.setHeader('Content-Type', 'text/html')
  res.send(authCompletePage(buildCallbackUrl(code, state), {
    title: "You're subscribed",
    lede: 'Your plan is active. Returning to the Tudso app. You can close this tab after it opens.',
  }))
})

router.post('/auth/desktop/callback', async (req: Request, res: Response) => {
  const { code, state, deviceId, platform, appVersion } = z.object({
    code: z.string().min(1),
    state: z.string().min(1),
    deviceId: DEVICE_ID.default('unknown-device'),
    platform: z.string().max(64).default('unknown'),
    appVersion: z.string().max(64).default(config.app.version),
  }).parse(req.body)
  if (!verifyAuthState(state)) {
    res.status(400).json({ error: 'Invalid or expired state' })
    return
  }
  const pending = pendingAuth(code, state)
  if (!pending) {
    res.status(400).json({ error: 'Invalid or expired code' })
    return
  }
  const result = await createAppSession(pending.userId, pending.email, deviceId, platform, appVersion)
  pendingCodeTokens.delete(code)
  clearAuthState(state)
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
    deviceId: DEVICE_ID,
    platform: z.string().max(64).default('unknown'),
    appVersion: z.string().max(64).default(config.app.version),
  }).parse(req.body)
  const { state, url } = generateAuthState('desktop')
  res.json({ url, state, deviceId, platform, appVersion })
})

router.get('/auth/desktop/poll', async (req: Request, res: Response) => {
  const parsed = z.object({ state: z.string().min(1) }).safeParse(req.query)
  if (!parsed.success) {
    res.status(410).json({ status: 'expired' })
    return
  }
  const pendingEntry = [...pendingCodeTokens.entries()].find(([, pending]) => pending.state === parsed.data.state)
  if (!pendingEntry) {
    if (!verifyAuthState(parsed.data.state)) {
      res.status(410).json({ status: 'expired' })
      return
    }
    res.json({ status: 'pending' })
    return
  }
  const [code, pending] = pendingEntry
  const entitlement = await getEntitlementForUser(pending.userId)
  if (!entitled(entitlement)) {
    res.json({ status: 'pending' })
    return
  }
  res.json({ status: 'ready', code, state: parsed.data.state })
})

async function startWebSession(res: Response, auth: { userId: string; email: string }) {
  const session = await createAppSession(auth.userId, auth.email, WEB_DEVICE_ID, 'web', 'dashboard')
  await ensureUserBilling(auth.userId)
  setWebSessionCookie(res, session.desktopToken)
  const entitlement = await getEntitlementForUser(auth.userId)
  return { ...session, plan: entitlement?.plan ?? 'none' }
}

router.get('/auth/web/session', async (req: Request, res: Response) => {
  const token = typeof req.cookies?.token === 'string' ? req.cookies.token : ''
  if (!token) {
    res.json({ user: null })
    return
  }
  const resolved = await resolveAccessToken(token)
  if (!resolved?.userId) {
    res.json({ user: null })
    return
  }
  try {
    const identity = await getAccountIdentity(resolved.userId)
    const entitlement = await getEntitlementForUser(resolved.userId)
    res.json({ user: publicAccount(identity), plan: entitlement?.plan ?? 'none' })
  } catch {
    res.json({ user: { userId: resolved.userId, email: resolved.email, name: '', avatarUrl: null }, plan: 'none' })
  }
})

router.post('/auth/web/login', rateLimiter, async (req: Request, res: Response) => {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Enter a valid email and password.' })
    return
  }
  const auth = await authenticateWithEmailPassword(parsed.data.email, parsed.data.password)
  if (!auth) {
    res.status(401).json({ error: 'Invalid email or password.' })
    return
  }
  if (!auth.verified) {
    await requestEmailVerification(auth.email)
    res.status(403).json({ error: 'Verify your email, then sign in.', needsVerification: true, email: auth.email })
    return
  }
  const session = await startWebSession(res, auth)
  res.json({ userId: session.userId, email: session.email, plan: session.plan })
})

router.post('/auth/web/register', rateLimiter, async (req: Request, res: Response) => {
  const parsed = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    passwordConfirm: z.string().min(8),
    name: z.string().trim().max(80).optional(),
  }).safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Enter a valid email and a password with at least 8 characters.' })
    return
  }
  if (parsed.data.password !== parsed.data.passwordConfirm) {
    res.status(400).json({ error: 'Passwords do not match.' })
    return
  }
  const auth = await createAccount(parsed.data.email, parsed.data.password, parsed.data.name || parsed.data.email.split('@')[0] || 'Tudso user')
  if (!auth) {
    res.status(409).json({ error: 'Could not create account. That email may already be in use.' })
    return
  }
  if (!auth.verified) {
    res.json({ needsVerification: true, email: auth.email })
    return
  }
  const session = await startWebSession(res, auth)
  res.json({ userId: session.userId, email: session.email, plan: session.plan })
})

router.post('/auth/web/oauth', rateLimiter, async (req: Request, res: Response) => {
  const requested = typeof req.body?.state === 'string' ? req.body.state : ''
  const existing = requested ? verifyAuthState(requested) : null
  const state = existing ? requested : generateAuthState('web').state
  try {
    const url = await getOAuthUrl('google', state, 'web')
    res.json({ url })
  } catch (error) {
    logError('Web Google sign-in start failed', error)
    res.status(400).json({ error: error instanceof Error ? error.message : "Google sign-in isn't available right now." })
  }
})

router.get('/auth/web/oauth/callback', async (req: Request, res: Response) => {
  const parsed = z.object({ code: z.string(), state: z.string() }).safeParse(req.query)
  if (!parsed.success) {
    res.redirect('/login?error=oauth')
    return
  }
  const [authState, provider] = parsed.data.state.split(':') as [string, 'google']
  const pending = verifyAuthState(authState)
  if (!pending) {
    res.redirect('/login?error=expired')
    return
  }
  const auth = await exchangeOAuthCallback(provider, parsed.data.code, authState)
  if (!auth) {
    res.redirect('/login?error=oauth')
    return
  }
  if (!auth.verified) {
    await requestEmailVerification(auth.email)
    res.redirect('/login?verify=1')
    return
  }
  if (pending.kind === 'desktop') {
    await finishDesktopAuth(res, auth, authState)
    return
  }
  const session = await startWebSession(res, auth)
  clearAuthState(authState)
  res.redirect(session.plan === 'none' ? '/dashboard/subscription' : '/dashboard')
})

router.post('/auth/logout', requireAuth, async (req: Request, res: Response) => {
  const token = bearerToken(req) || (typeof req.cookies?.token === 'string' ? req.cookies.token : '')
  await deleteDesktopSession(token)
  clearWebSessionCookie(res)
  res.json({ ok: true })
})

// Me
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const billing = await getUserBilling(req.userId!).catch(() => null)
  try {
    const identity = await getAccountIdentity(req.userId!)
    res.json({
      ...publicAccount(identity),
      onboardingComplete: Boolean(billing?.onboardingComplete),
    })
  } catch {
    res.json({
      userId: req.userId,
      email: req.email,
      name: '',
      avatarUrl: null,
      onboardingComplete: Boolean(billing?.onboardingComplete),
    })
  }
})

router.get('/me/account', requireAuth, async (req: Request, res: Response) => {
  try {
    const identity = await getAccountIdentity(req.userId!)
    res.json(publicAccount(identity))
  } catch {
    res.status(500).json({ error: 'Could not load your profile.' })
  }
})

router.patch('/me/account', requireAuth, async (req: Request, res: Response) => {
  const parsed = z.object({ name: z.string().trim().min(1).max(80) }).strict().safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Enter a name up to 80 characters.' })
    return
  }
  try {
    const identity = await updateAccountName(req.userId!, parsed.data.name)
    res.json(publicAccount(identity))
  } catch {
    res.status(400).json({ error: 'Could not update your name.' })
  }
})

router.post('/me/account/password', requireAuth, sensitiveRateLimiter, async (req: Request, res: Response) => {
  const parsed = z.object({
    currentPassword: z.string().min(1).max(128),
    password: z.string().min(8).max(128),
    passwordConfirm: z.string().min(8).max(128),
  }).strict().safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Enter your current password and a new password of at least 8 characters.' })
    return
  }
  if (parsed.data.password !== parsed.data.passwordConfirm) {
    res.status(400).json({ error: 'New password and confirmation do not match.' })
    return
  }
  const email = req.email ?? ''
  if (!email) {
    res.status(400).json({ error: 'Could not update the password.' })
    return
  }
  try {
    await changeAccountPassword(email, parsed.data.currentPassword, parsed.data.password)
    res.json({ ok: true })
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Could not update the password.' })
  }
})

router.get('/me/avatar', requireAuth, async (req: Request, res: Response) => {
  try {
    const file = await getAccountAvatar(req.userId!)
    if (!file) {
      res.status(404).json({ error: 'No avatar' })
      return
    }
    res.setHeader('Content-Type', file.contentType)
    res.setHeader('Cache-Control', 'private, max-age=120')
    res.send(file.body)
  } catch {
    res.status(404).json({ error: 'No avatar' })
  }
})

router.post('/me/account/avatar', requireAuth, rateLimiter, acceptAvatar, async (req: Request, res: Response) => {
  const file = req.file
  if (!file?.buffer?.length) {
    res.status(400).json({ error: 'Choose an image.' })
    return
  }
  const ext = AVATAR_MIME[file.mimetype]
  if (!ext) {
    res.status(400).json({ error: 'Use a JPEG, PNG, WebP, or GIF image.' })
    return
  }
  try {
    const identity = await updateAccountAvatar(req.userId!, {
      buffer: file.buffer,
      mime: file.mimetype,
      filename: `avatar.${ext}`,
    })
    res.json(publicAccount(identity))
  } catch {
    res.status(400).json({ error: 'Could not update your avatar.' })
  }
})

router.delete('/me/account/avatar', requireAuth, async (req: Request, res: Response) => {
  try {
    const identity = await updateAccountAvatar(req.userId!, null)
    res.json(publicAccount(identity))
  } catch {
    res.status(400).json({ error: 'Could not remove your avatar.' })
  }
})

function localUserDataGone(_req: Request, res: Response) {
  res.status(410).json({ error: 'Profile, onboarding, and memory are stored on the device, not the server' })
}
router.post('/me/onboarding/complete', requireAuth, localUserDataGone)
router.get('/me/profile', requireAuth, localUserDataGone)
router.patch('/me/profile', requireAuth, localUserDataGone)

// Resume files stay on the device. These routes remain so old clients fail clearly.
function resumeGone(_req: Request, res: Response) {
  res.status(410).json({ error: 'Resumes are stored on the device, not the server' })
}
router.post('/me/resume', requireAuth, resumeGone)
router.get('/me/resume', requireAuth, resumeGone)
router.get('/me/resume/file', requireAuth, resumeGone)
router.delete('/me/resume', requireAuth, resumeGone)

function conversationsGone(_req: Request, res: Response) {
  res.status(410).json({ error: 'Chat sessions are stored on the device, not the server' })
}
router.get('/conversations', requireAuth, conversationsGone)
router.post('/conversations', requireAuth, conversationsGone)
router.get('/conversations/:id', requireAuth, conversationsGone)
router.patch('/conversations/:id', requireAuth, conversationsGone)
router.delete('/conversations/:id', requireAuth, conversationsGone)

const chatHistorySchema = z.array(z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(100_000),
})).max(24).optional()

function historyFromBody(history: z.infer<typeof chatHistorySchema>, includeHistory: boolean): ChatMessage[] {
  if (!includeHistory || !history?.length) return []
  return history
    .filter((item) => item.content.trim())
    .slice(-12)
    .map((item) => ({ role: item.role, content: item.content }))
}

// AI
router.post('/ai/chat', requireAuth, requireInterviewSession, aiRateLimiter, async (req: Request, res: Response) => {
  const schema = z.object({
    conversationId: z.string().optional(),
    message: z.string().min(1),
    stream: z.boolean().default(true),
    includeProfile: z.boolean().default(true),
    includeHistory: z.boolean().default(true),
    history: chatHistorySchema,
    model: z.enum(['gpt-4.1-nano', 'gpt-4.1']).optional(),
    profile: clientProfileSchema,
    memories: clientMemoriesSchema,
    resume: clientResumeSchema,
  })
  const { message, stream, includeHistory, history: historyBody, model, profile: profileBody, memories, resume: resumeBody, conversationId } = schema.parse(req.body)

  const entitlement = await getEntitlementForUser(req.userId!)
  if (!entitled(entitlement)) {
    res.status(403).json({ error: 'Chat requires remaining interview sessions or an active plan' })
    return
  }

  const history: ChatMessage[] = historyFromBody(historyBody, includeHistory)
  const basePrompt = resolveSessionPrompt(req.userId!, conversationId, profileBody, memories, resumeBody)
  if (!basePrompt) {
    res.status(409).json({ error: SESSION_PROMPT_REQUIRED })
    return
  }
  const systemPrompt = applyTurnContext(basePrompt)
  const messages = buildChatMessages(systemPrompt, history, message)

  if (stream) {
    beginPlainStream(res)
    let content = ''
    await chat(
      { messages, stream: true, model: resolveChatModel(model) },
      {
        onDelta: (delta) => {
          content += delta
          writePlainStream(res, delta)
        },
        onDone: () => {
          endPlainStream(res)
          // B-1: persistChat already calls incrementUsage; do not call it again here
          void persistChat(req.userId!, message, content)
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

  const result = await chat({ messages, model: resolveChatModel(model) })
  try {
    await incrementUsage(req.userId!, { requests: 1, tokens: result.usage?.totalTokens ?? 0 })
  } catch (error) {
    logError('Failed to persist chat usage', error, { user: req.userId })
  }
  res.json(result)
})

router.post('/ai/vision', requireAuth, requireInterviewSession, aiRateLimiter, async (req: Request, res: Response) => {
  const schema = z.object({
    image: z.string().min(1),
    message: z.string().min(1),
    conversationId: z.string().optional(),
    history: chatHistorySchema,
    model: z.enum(['gpt-4.1-nano', 'gpt-4.1']).optional(),
    profile: clientProfileSchema,
    memories: clientMemoriesSchema,
    resume: clientResumeSchema,
  })
  const { image, message, history: historyBody, model, profile: profileBody, memories, resume: resumeBody, conversationId } = schema.parse(req.body)

  const entitlement = await getEntitlementForUser(req.userId!)
  if (!entitled(entitlement)) {
    res.status(403).json({ error: 'Screen answers require remaining interview sessions or an active plan' })
    return
  }

  const history: ChatMessage[] = historyFromBody(historyBody, true)
    .filter((m) => !(m.role === 'user' && /^(Answer from screen|Live copilot)$/i.test(m.content)))
  const basePrompt = resolveSessionPrompt(req.userId!, conversationId, profileBody, memories, resumeBody)
  if (!basePrompt) {
    res.status(409).json({ error: SESSION_PROMPT_REQUIRED })
    return
  }
  const systemPrompt = applyTurnContext(basePrompt, { screen: true })
  const messages = buildChatMessages(systemPrompt, history, message)
  beginPlainStream(res)
  let content = ''
  await vision(
    { messages, image, model: resolveVisionModel(model) },
    {
      onDelta: (delta) => {
        content += delta
        writePlainStream(res, delta)
      },
      onDone: () => {
        endPlainStream(res)
        // B-1: persistVision already calls incrementUsage; do not call it again here
        void persistVision(req.userId!, message, content)
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

router.post('/ai/transcribe', requireAuth, requireInterviewSession, aiRateLimiter, upload.single('audio'), async (req: Request, res: Response) => {
  const entitlement = await getEntitlementForUser(req.userId!)
  if (!entitled(entitlement)) {
    res.status(403).json({ error: 'Voice input requires remaining interview sessions or an active plan' })
    return
  }
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
    await incrementUsage(req.userId!, { audioMinutes: Math.max(1, Math.ceil(buffer.length / 210_000)) })
    res.json({ text })
  } catch (error) {
    logError('Failed to transcribe audio', error, { user: req.userId })
    res.status(500).json({ error: (error as Error).message || 'Transcription failed' })
  } finally {
    await fs.unlink(tempPath).catch(() => undefined)
  }
})

router.post('/ai/memory-extract', requireAuth, requireInterviewSession, aiRateLimiter, async (req: Request, res: Response) => {
  const schema = z.object({
    userMessage: z.string().min(1).max(20_000),
    assistantContent: z.string().min(1).max(100_000),
    existing: z.array(z.string().max(MAX_MEMORY_CHARS)).max(MAX_MEMORIES).optional(),
  })
  const { userMessage, assistantContent, existing } = schema.parse(req.body)
  const entitlement = await getEntitlementForUser(req.userId!)
  if (!entitled(entitlement)) {
    res.status(403).json({ error: 'Memory requires remaining interview sessions or an active plan' })
    return
  }
  const facts = await extractMemoryFacts(userMessage, assistantContent, existing ?? [])
  res.json({ facts })
})

router.post('/ai/parse-resume', requireAuth, aiRateLimiter, async (req: Request, res: Response) => {
  const schema = z.object({
    text: z.string().min(1).max(20_000),
  })
  const { text } = schema.parse(req.body)
  const entitlement = await getEntitlementForUser(req.userId!)
  if (!entitled(entitlement)) {
    res.status(403).json({ error: 'Resume parsing requires an active plan or remaining interview sessions' })
    return
  }
  try {
    const result = await extractResumeStructured(text)
    await incrementUsage(req.userId!, { requests: 1 })
    res.json(result)
  } catch (error) {
    logError('Failed to parse resume with AI', error, { user: req.userId })
    res.status(422).json({ error: (error as Error).message || 'Could not parse resume' })
  }
})

router.get('/ai/realtime/session', requireAuth, async (req: Request, res: Response) => {
  const entitlement = await getEntitlementForUser(req.userId!)
  if (!entitled(entitlement)) {
    res.status(403).json({ error: 'Live copilot requires remaining interview sessions or an active plan' })
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
  res.json({ usage })
})

router.post('/usage/session', requireAuth, rateLimiter, async (req: Request, res: Response) => {
  const requestedMinutes = z.object({ durationMinutes: z.number().int().min(1).max(120).optional() }).safeParse(req.body ?? {})
  if (!requestedMinutes.success) {
    res.status(400).json({ error: 'Invalid session duration' })
    return
  }
  const consumed = await consumeInterviewCredit(req.userId!)
  if (!consumed.ok) {
    res.status(403).json({ error: consumed.error })
    return
  }
  const entitlement = await getEntitlementForUser(req.userId!)
  const interviewSession = createInterviewSession(req.userId!, requestedMinutes.data.durationMinutes, entitlement.plan)
  await incrementUsage(req.userId!, { sessions: 1 })
  res.json({ ok: true, interviewCredits: consumed.interviewCredits, sessionToken: interviewSession.token, expiresAt: interviewSession.expiresAt })
})

router.get('/me/dashboard', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId!
  const [entitlement, subscription, usage, history, devices] = await Promise.all([
    getEntitlementForUser(userId),
    getSubscription(userId),
    getUsageToday(userId),
    getUsageHistory(userId, 14),
    getDevices(userId),
  ])
  const sessionCount = history.reduce((total, day) => total + (day.sessions ?? 0), 0)
  res.json({
    email: req.email ?? '',
    entitlement,
    subscription,
    usage,
    history,
    sessionCount,
    conversationCount: sessionCount,
    deviceCount: devices.length,
  })
})

router.get('/billing/success', async (req: Request, res: Response) => {
  const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id : ''
  const token = typeof req.cookies?.token === 'string' ? req.cookies.token : ''
  const resolved = token ? await resolveAccessToken(token) : null
  if (resolved?.userId && sessionId) {
    try {
      await finalizeCheckoutSession(sessionId, resolved.userId)
    } catch (error) {
      logError('Failed to finalize web checkout', error, { user: resolved.userId })
    }
  }
  res.redirect('/dashboard/subscription?billing=success')
})

router.get('/billing/cancel', (_req: Request, res: Response) => {
  res.redirect('/dashboard/subscription?billing=cancel')
})

router.get('/billing/return', (_req: Request, res: Response) => {
  res.redirect('/dashboard/subscription')
})

// Billing
router.get('/billing/plans', async (_req: Request, res: Response) => {
  const prices = await listPaidPlanPrices()
  res.json({ plans: prices })
})

router.post('/billing/free', requireAuth, rateLimiter, async (req: Request, res: Response) => {
  const billing = await getUserBilling(req.userId!)
  if (billing?.plan !== 'none') {
    res.status(409).json({ error: 'The free plan is only available before choosing a paid plan.' })
    return
  }
  await syncUserBilling(req.userId!, { plan: 'free', planStatus: 'unpaid', interviewCredits: 3 })
  clearLiveEntitlementCache(req.userId!)
  res.json({ plan: 'free', interviewCredits: 3 })
})

router.post('/billing/checkout', requireAuth, rateLimiter, async (req: Request, res: Response) => {
  const { plan } = z.object({ plan: z.enum(CHECKOUT_PLANS) }).parse(req.body)
  try {
    const session = await createCheckoutSession(req.userId!, req.email ?? '', plan)
    res.json(session)
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Could not start checkout' })
  }
})

router.post('/billing/portal', requireAuth, async (req: Request, res: Response) => {
  const { action, plan } = z.object({
    action: z.enum(['manage', 'cancel', 'upgrade']).default('manage'),
    plan: z.enum(CHECKOUT_PLANS).optional(),
  }).parse(req.body ?? {})
  try {
    const session = await createCustomerPortalSession(req.userId!, { action, plan })
    res.json(session)
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Could not open billing' })
  }
})

router.get('/billing/subscription', requireAuth, async (req: Request, res: Response) => {
  const subscription = await getSubscription(req.userId!)
  res.json(subscription)
})

router.get('/billing/overview', requireAuth, async (req: Request, res: Response) => {
  try {
    const overview = await getBillingOverview(req.userId!)
    res.json(overview)
  } catch (error) {
    logError('Failed to load billing overview', error, { user: req.userId })
    res.status(400).json({ error: 'Could not load invoices from Stripe.' })
  }
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
  res.json(devices.map((device) => ({
    id: device.id,
    deviceId: device.deviceId,
    platform: device.platform,
    appVersion: device.appVersion,
    lastSeen: device.lastSeen,
    current: Boolean(req.deviceId && device.deviceId === req.deviceId),
  })))
})

router.delete('/me/devices/:deviceId', requireAuth, sensitiveRateLimiter, async (req: Request, res: Response) => {
  const deviceId = DEVICE_ID.parse(req.params.deviceId)
  const current = Boolean(req.deviceId && deviceId === req.deviceId)
  await deleteDevice(req.userId!, deviceId)
  if (current) await deleteDesktopSession(bearerToken(req))
  res.json({ ok: true, current })
})

router.post('/me/sessions/revoke-others', requireAuth, sensitiveRateLimiter, async (req: Request, res: Response) => {
  const token = bearerToken(req)
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const revoked = await deleteOtherDesktopSessions(req.userId!, token)
  res.json({ ok: true, revoked })
})

router.get('/me/context', requireAuth, localUserDataGone)
router.patch('/me/context', requireAuth, localUserDataGone)
router.delete('/me/context', requireAuth, localUserDataGone)

// Account export
router.get('/me/export', requireAuth, sensitiveRateLimiter, async (req: Request, res: Response) => {
  const userId = req.userId!
  const [subscription, entitlement, usage, history] = await Promise.all([
    getSubscription(userId),
    getEntitlementForUser(userId),
    getUsageToday(userId),
    getUsageHistory(userId, 30),
  ])
  const billing = subscription
    ? {
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      }
    : null
  res.json({
    exportedAt: new Date().toISOString(),
    email: req.email ?? '',
    subscription: billing,
    entitlement,
    usage,
    usageHistory: history,
    note: 'Profile, resume, chats, memories, and PIN are stored only on your device.',
  })
})

router.delete('/me/account', requireAuth, sensitiveRateLimiter, async (req: Request, res: Response) => {
  const { confirm } = z.object({ confirm: z.string().min(1).max(320) }).parse(req.body ?? {})
  const email = (req.email ?? '').trim().toLowerCase()
  if (!email || confirm.trim().toLowerCase() !== email) {
    res.status(400).json({ error: 'Type your account email to confirm deletion.' })
    return
  }
  await deleteUserData(req.userId!)
  await deleteDesktopSession(bearerToken(req))
  res.json({ ok: true })
})

async function persistChat(userId: string, _message: string, _content: string) {
  try {
    await incrementUsage(userId, { requests: 1 })
  } catch (error) {
    logError('Failed to persist chat usage', error, { user: userId })
  }
}

async function persistVision(userId: string, _message: string, _content: string) {
  try {
    await incrementUsage(userId, { requests: 1, screenAnalyses: 1 })
  } catch (error) {
    logError('Failed to persist vision usage', pocketbaseError(error), { user: userId })
  }
}

function pocketbaseError(error: unknown): unknown {
  const err = error as { data?: unknown; response?: unknown; message?: string }
  return err.data ?? err.response ?? err.message ?? error
}

export default router
