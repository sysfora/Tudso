import dotenv from 'dotenv'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const envDir = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(envDir, '..', '.env') })

const PACKAGE_VERSION = (createRequire(import.meta.url)('../package.json') as { version: string }).version

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback
}

export const config = {
  app: {
    name: optional('APP_NAME', 'Tudso'),
    url: optional('APP_URL', 'http://localhost:3000'),
    env: optional('APP_ENV', 'development'),
    version: PACKAGE_VERSION,
    port: Number(optional('PORT', '3000')),
  },
  pocketbase: {
    url: required('POCKETBASE_URL'),
    adminEmail: required('POCKETBASE_ADMIN_EMAIL'),
    adminPassword: required('POCKETBASE_ADMIN_PASSWORD'),
  },
  stripe: {
    secretKey: required('STRIPE_SECRET_KEY'),
    webhookSecret: required('STRIPE_WEBHOOK_SECRET'),
    publishableKey: required('STRIPE_PUBLISHABLE_KEY'),
    priceIds: {
      weekly: optional('STRIPE_PRICE_WEEKLY', ''),
      monthly: optional('STRIPE_PRICE_MONTHLY', ''),
      yearly: optional('STRIPE_PRICE_YEARLY', ''),
      pro: optional('STRIPE_PRICE_PRO', ''),
      premium: optional('STRIPE_PRICE_PREMIUM', ''),
    },
  },
  ai: {
    provider: optional('AI_PROVIDER', 'openai'),
    baseUrl: optional('AI_API_BASE_URL', 'https://api.openai.com/v1'),
    apiKey: required('AI_API_KEY'),
    chatModel: optional('AI_CHAT_MODEL', 'gpt-4.1-nano'),
    visionModel: optional('AI_VISION_MODEL', 'gpt-4.1-nano'),
    realtimeModel: optional('AI_REALTIME_MODEL', 'gpt-4o-mini-realtime-preview'),
    transcriptionModel: optional('AI_TRANSCRIPTION_MODEL', 'gpt-4o-mini-transcribe'),
  },
  auth: {
    callbackScheme: optional('AUTH_CALLBACK_SCHEME', 'tudso'),
    callbackHost: optional('AUTH_CALLBACK_HOST', 'auth/callback'),
    sessionTtlMs: Number(optional('AUTH_SESSION_TTL_MS', String(7 * 24 * 60 * 60 * 1000))),
  },
  security: {
    jwtSecret: required('JWT_SECRET'),
    encryptionKey: required('ENCRYPTION_KEY'),
    releaseUploadToken: optional('RELEASE_UPLOAD_TOKEN', ''),
  },
  storage: {
    localDir: optional('RESUME_STORAGE_DIR', 'data'),
    releasesDir: 'data/releases',
  },
} as const

export type Config = typeof config
