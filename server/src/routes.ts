import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import express, { type Request, type Response, type Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { authenticateWithEmailPassword, buildCallbackUrl, confirmEmailChange, confirmEmailVerification, confirmPasswordReset, createAccount, exchangeDesktopToken, exchangeOAuthCallback, generateAuthState, getOAuthUrl, requestEmailVerification, requestPasswordReset, verifyAuthState } from './auth.js'
import { chat, getProfileContext, transcription, vision, buildChatMessages, buildSystemPrompt, resolveChatModel, invalidateProfileContext } from './ai.js'
import { learnFromExchange } from './learn.js'
import { beginPlainStream, endPlainStream, writePlainStream } from './stream.js'
import { config } from './config.js'
import { logError } from './log.js'
import { authCompletePage, checkEmailPage, confirmEmailChangePage, forgotPasswordPage, loginPage, resetPasswordPage, sessionExpiredPage, statusPage, subscribePage } from './login.html.js'
import { aiRateLimiter, rateLimiter, requireAuth, sensitiveRateLimiter } from './middleware.js'
import { createConversation, createMessage, deleteConversation, deleteDesktopSession, deleteDevice, deleteOtherDesktopSessions, deleteUserData, getConversations, getContext, getDevices, getEntitlementForUser, getMessages, getOrCreateProfile, getResume, getSubscription, getUsageToday, getUserBilling, incrementUsage, syncUserBilling, updateContext, updateProfile, watchEntitlement } from './pocketbase.js'
import { MAX_MEMORIES, MAX_MEMORY_CHARS, normalizeMemoryEntries } from './memory.js'
import { createCheckoutSession, createCustomerPortalSession, finalizeCheckoutSession, handleStripeWebhook, listPaidPlanPrices, stripe } from './stripe.js'
import { isPaidPlan } from './plans.js'
import type { AIStreamHandler, ChatMessage, Plan, UserProfile } from './types.js'

const DEVICE_ID = z.string().min(1).max(128).regex(/^[a-zA-Z0-9._:-]+$/)

function bearerToken(req: Request): string {
  const header = req.headers.authorization
  return header?.startsWith('Bearer ') ? header.slice(7) : ''
}

const upload = multer({ dest: 'uploads/', limits: { fileSize: 10 * 1024 * 1024 } })

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

const router: Router = express.Router()

const pendingCodeTokens = new Map<string, { token: string; userId: string; email: string; state: string; createdAt: number }>()
const PENDING_CODE_TTL_MS = 30 * 60 * 1000

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

async function finishDesktopAuth(
  res: Response,
  auth: { token: string; userId: string; email: string },
  state: string,
): Promise<void> {
  const code = crypto.randomUUID()
  pendingCodeTokens.set(code, { token: auth.token, userId: auth.userId, email: auth.email, state, createdAt: Date.now() })
  res.setHeader('Content-Type', 'text/html')
  const entitlement = await getEntitlementForUser(auth.userId)
  if (!isPaidPlan(entitlement?.plan, entitlement?.status)) {
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
  if (isPaidPlan(entitlement?.plan, entitlement?.status)) {
    res.setHeader('Content-Type', 'text/html')
    res.send(authCompletePage(buildCallbackUrl(code, state), {
      title: "You're ready",
      lede: 'Your plan is active. Returning to the Tudso app.',
    }))
    return
  }
  await sendSubscribePage(res, pending, code, state)
})

router.post('/auth/desktop/subscribe', express.urlencoded({ extended: true }), async (req: Request, res: Response) => {
  const parsed = z.object({
    code: z.string().min(1),
    state: z.string().min(1),
    plan: z.enum(['pro', 'premium']),
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
  if (isPaidPlan(entitlement?.plan, entitlement?.status)) {
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
    paid = isPaidPlan(entitlement?.plan, entitlement?.status)
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
    appVersion: z.string().max(64).default('1.0.0'),
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
    deviceId: DEVICE_ID,
    platform: z.string().max(64).default('unknown'),
    appVersion: z.string().max(64).default('1.0.0'),
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
  const [profile, billing] = await Promise.all([
    getOrCreateProfile(req.userId!),
    getUserBilling(req.userId!),
  ])
  res.json({
    userId: req.userId,
    email: req.email,
    profile,
    onboardingComplete: Boolean(billing?.onboardingComplete),
  })
})

router.post('/me/onboarding/complete', requireAuth, rateLimiter, async (req: Request, res: Response) => {
  await syncUserBilling(req.userId!, { onboardingComplete: true })
  res.json({ onboardingComplete: true })
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

// Resume files stay on the device. These routes remain so old clients fail clearly.
function resumeGone(_req: Request, res: Response) {
  res.status(410).json({ error: 'Resumes are stored on the device, not the server' })
}
router.post('/me/resume', requireAuth, resumeGone)
router.get('/me/resume', requireAuth, resumeGone)
router.get('/me/resume/file', requireAuth, resumeGone)
router.delete('/me/resume', requireAuth, resumeGone)

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
    model: z.enum(['gpt-4.1-nano', 'gpt-4.1']).optional(),
    profile: clientProfileSchema,
  })
  const { conversationId, message, stream, includeProfile, includeHistory, model, profile: profileBody } = schema.parse(req.body)

  const [entitlement, historyRecords, profileContext] = await Promise.all([
    getEntitlementForUser(req.userId!),
    includeHistory && conversationId ? getMessages(req.userId!, conversationId) : Promise.resolve([]),
    includeProfile
      ? getProfileContext(req.userId!, clientProfile(req.userId!, profileBody))
      : Promise.resolve({ profile: undefined, resume: undefined, contextEntries: undefined }),
  ])
  if (!isPaidPlan(entitlement?.plan, entitlement?.status)) {
    res.status(403).json({ error: 'Chat requires an active Pro or Premium subscription' })
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
      { messages, stream: true, model: resolveChatModel(model) },
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

  const result = await chat({ messages, model: resolveChatModel(model) })
  try {
    if (conversationId) {
      await createMessage(req.userId!, conversationId, 'user', storedUserContent(message))
      await createMessage(req.userId!, conversationId, 'assistant', result.content)
    }
    await incrementUsage(req.userId!, { requests: 1, tokens: result.usage?.totalTokens ?? 0 })
  } catch (error) {
    logError('Failed to persist chat usage', error, { user: req.userId })
  }
  void learnFromExchange(req.userId!, storedUserContent(message), result.content)
  res.json(result)
})

router.post('/ai/vision', requireAuth, aiRateLimiter, async (req: Request, res: Response) => {
  const schema = z.object({
    image: z.string().min(1),
    message: z.string().min(1),
    conversationId: z.string().optional(),
    model: z.enum(['gpt-4.1-nano', 'gpt-4.1']).optional(),
    profile: clientProfileSchema,
  })
  const { image, message, conversationId, model, profile: profileBody } = schema.parse(req.body)

  const [entitlement, profileContext] = await Promise.all([
    getEntitlementForUser(req.userId!),
    getProfileContext(req.userId!, clientProfile(req.userId!, profileBody)),
  ])
  if (!isPaidPlan(entitlement?.plan, entitlement?.status)) {
    res.status(403).json({ error: 'Screen answers require an active Pro or Premium subscription' })
    return
  }

  const { profile, resume, contextEntries } = profileContext
  const systemPrompt = buildSystemPrompt({ profile, resume, contextEntries, screenContext: true })
  const messages = buildChatMessages(systemPrompt, [], message)
  beginPlainStream(res)
  let content = ''
  await vision(
    { messages, image, model: resolveChatModel(model) },
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
  const entitlement = await getEntitlementForUser(req.userId!)
  if (!isPaidPlan(entitlement.plan, entitlement.status)) {
    res.status(403).json({ error: 'Voice input requires an active Pro or Premium subscription' })
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
    res.json({ text })
  } catch (error) {
    logError('Failed to transcribe audio', error, { user: req.userId })
    res.status(500).json({ error: (error as Error).message || 'Transcription failed' })
  } finally {
    await fs.unlink(tempPath).catch(() => undefined)
  }
})

router.get('/ai/realtime/session', requireAuth, async (req: Request, res: Response) => {
  const entitlement = await getEntitlementForUser(req.userId!)
  if (!isPaidPlan(entitlement?.plan, entitlement?.status)) {
    res.status(403).json({ error: 'Live copilot requires an active Pro or Premium subscription' })
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

// Billing
router.get('/billing/plans', async (_req: Request, res: Response) => {
  const prices = await listPaidPlanPrices()
  res.json({ plans: prices })
})

router.post('/billing/checkout', requireAuth, rateLimiter, async (req: Request, res: Response) => {
  const { plan } = z.object({ plan: z.enum(['pro', 'premium']) }).parse(req.body)
  try {
    const session = await createCheckoutSession(req.userId!, req.email ?? '', plan as Plan)
    res.json(session)
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Could not start checkout' })
  }
})

router.post('/billing/portal', requireAuth, async (req: Request, res: Response) => {
  const { action, plan } = z.object({
    action: z.enum(['manage', 'cancel', 'upgrade']).default('manage'),
    plan: z.enum(['pro', 'premium']).optional(),
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

// Memory
router.get('/me/context', requireAuth, async (req: Request, res: Response) => {
  const context = await getContext(req.userId!)
  res.json(context ?? { id: '', user: req.userId, entries: [], enabled: true })
})

router.patch('/me/context', requireAuth, rateLimiter, async (req: Request, res: Response) => {
  const { entries, enabled } = z.object({
    entries: z.array(z.object({
      id: z.string().min(1).max(64),
      text: z.string().min(1).max(MAX_MEMORY_CHARS),
      created: z.string().min(1),
      source: z.enum(['auto', 'manual']).optional(),
    })).max(MAX_MEMORIES).optional(),
    enabled: z.boolean().optional(),
  }).refine((body) => body.entries !== undefined || body.enabled !== undefined, {
    message: 'entries or enabled is required',
  }).parse(req.body)
  const context = await updateContext(req.userId!, {
    entries: entries ? normalizeMemoryEntries(entries) : undefined,
    enabled,
  })
  invalidateProfileContext(req.userId)
  res.json(context)
})

router.delete('/me/context', requireAuth, rateLimiter, async (req: Request, res: Response) => {
  const existing = await getContext(req.userId!)
  const context = await updateContext(req.userId!, { entries: [], enabled: existing?.enabled ?? true })
  invalidateProfileContext(req.userId)
  res.json({ ok: true, entries: [], enabled: context.enabled })
})

// Account export
router.get('/me/export', requireAuth, sensitiveRateLimiter, async (req: Request, res: Response) => {
  const userId = req.userId!
  const [profile, resume, conversations, subscription, entitlement, usage, context] = await Promise.all([
    getOrCreateProfile(userId),
    getResume(userId),
    getConversations(userId),
    getSubscription(userId),
    getEntitlementForUser(userId),
    getUsageToday(userId),
    getContext(userId),
  ])
  const messages = (await Promise.all(conversations.map((c: { id: string }) => getMessages(userId, c.id)))).flat()
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
    profile,
    resume,
    conversations,
    messages,
    subscription: billing,
    entitlement,
    usage,
    memories: context?.entries ?? [],
    memoryEnabled: context?.enabled !== false,
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

async function persistChat(userId: string, conversationId: string | undefined, message: string, content: string) {
  const userText = storedUserContent(message)
  try {
    if (conversationId && content) {
      await createMessage(userId, conversationId, 'user', userText)
      await createMessage(userId, conversationId, 'assistant', content)
    }
    await incrementUsage(userId, { requests: 1 })
  } catch (error) {
    logError('Failed to persist chat usage', error, { user: userId })
  }
  void learnFromExchange(userId, userText, content)
}

async function persistVision(userId: string, conversationId: string | undefined, message: string, content: string) {
  const userText = storedUserContent(message)
  try {
    if (conversationId) {
      await createMessage(userId, conversationId, 'user', userText)
      await createMessage(userId, conversationId, 'assistant', content || '(no response)')
    }
  } catch (error) {
    logError('Failed to persist vision messages', pocketbaseError(error), { user: userId })
  }
  try {
    await incrementUsage(userId, { requests: 1, screenAnalyses: 1 })
  } catch (error) {
    logError('Failed to persist vision usage', pocketbaseError(error), { user: userId })
  }
  void learnFromExchange(userId, userText, content)
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
