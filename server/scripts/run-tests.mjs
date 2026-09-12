import { spawnSync } from 'node:child_process'

const required = {
  POCKETBASE_URL: 'http://localhost:8090',
  POCKETBASE_ADMIN_EMAIL: 'admin@test.com',
  POCKETBASE_ADMIN_PASSWORD: 'test',
  AI_API_KEY: 'test',
  JWT_SECRET: '0123456789abcdef0123456789abcdef',
  ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef',
  STRIPE_SECRET_KEY: 'sk_test_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_test',
  STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
  STRIPE_PRICE_BASIC: 'price_basic_123',
  STRIPE_PRICE_PLUS: 'price_plus_123',
  STRIPE_PRICE_PRO: 'price_pro_123',
  STRIPE_PRICE_WEEKLY: 'price_weekly_123',
  STRIPE_PRICE_MONTHLY: 'price_monthly_123',
  STRIPE_PRICE_YEARLY: 'price_yearly_123',
  STRIPE_PRICE_PREMIUM: 'price_premium_123',
}

const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.config.ts', ...process.argv.slice(2)], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, ...required },
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
