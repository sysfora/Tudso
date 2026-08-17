import dotenv from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const envDir = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(envDir, '..', '.env') })

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
    version: optional('APP_VERSION', '1.0.0'),
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
      free: optional('STRIPE_PRICE_FREE', ''),
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
  },
  r2: {
    accountId: optional('R2_ACCOUNT_ID', ''),
    accessKeyId: optional('R2_ACCESS_KEY_ID', ''),
    secretAccessKey: optional('R2_SECRET_ACCESS_KEY', ''),
    bucket: optional('R2_BUCKET', ''),
    endpoint: optional('R2_ENDPOINT', ''),
    publicUrl: optional('R2_PUBLIC_URL', ''),
  },
  storage: {
    localDir: optional('RESUME_STORAGE_DIR', 'data'),
  },
  updates: {
    stable: optional('LATEST_VERSION_STABLE', '0.1.0'),
    beta: optional('LATEST_VERSION_BETA', '0.1.0'),
    alpha: optional('LATEST_VERSION_ALPHA', '0.1.0'),
    downloadUrl: optional('UPDATE_DOWNLOAD_URL', ''),
    releaseNotesUrl: optional('UPDATE_RELEASE_NOTES_URL', ''),
  },
} as const

export type Config = typeof config
