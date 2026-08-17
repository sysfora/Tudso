# Tudso

A premium floating desktop AI assistant. Commercial SaaS architecture with Electron, React, TypeScript, Vite, PocketBase, and Stripe.

## Architecture

```text
┌─────────────────┐
│   Electron App  │
│  React renderer │
│  Secure preload │
│  Electron main  │
└────────┬────────┘
         │ Authenticated API
         ▼
┌─────────────────┐
│  Backend API    │
│  Auth, AI,      │
│  Billing, Usage │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
PocketBase  Stripe
```

The renderer never holds AI provider secrets, Stripe secrets, or PocketBase admin credentials. All privileged operations go through the backend.

## Prerequisites

- Node.js 20+
- PocketBase server running locally or hosted
- Stripe account (for payments)
- AI provider account and API key (configured backend-only)

## Setup

1. Copy `.env.example` to `.env` and fill in all required values.
2. Import `pb_schema.json` in PocketBase Admin → Settings → Import collections. See `POCKETBASE_SETUP.md`.
3. Configure Stripe using `STRIPE_SETUP.md`.
4. Install dependencies:
   ```bash
   npm install
   cd server && npm install
   ```

## Run Development

```bash
npm run dev
```

This starts the backend API, the Vite renderer dev server, and Electron together.

## Build

```bash
npm run build
npm run package
```

## Key Features

- Account creation and browser-based authentication via deep-link callback
- Onboarding (profile, skills, goals, communication preferences)
- Subscription plans (Free, Pro, Premium) with Stripe Checkout and Customer Portal
- Server-side entitlement enforcement
- PocketBase-backed conversations and messages
- Backend AI orchestration (chat, vision, realtime, transcription)
- Screen and audio context controls (capture implementation OS-specific)
- Global keyboard shortcuts, window positioning, tray menu
- Privacy center, profile management, and account deletion

## Security Notes

- `contextIsolation` is enabled and `nodeIntegration` is disabled.
- IPC is typed and minimal.
- AI provider keys, Stripe secrets, and admin credentials live only in the backend `.env`.
- The renderer uses only a short-lived desktop session token.
- Subscription status and usage limits are enforced server-side.
- PocketBase collections use owner-only rules for user data.

## Project Structure

```text
src/
  main/          Electron main process
  preload/       Secure preload script
  renderer/      React UI and stores
  shared/        Types and channels
server/          Express backend API
```

## Scripts

- `npm run dev` — start backend, renderer, and Electron
- `npm run build` — build backend and renderer
- `npm run package` — package the Electron app
- `npm run lint` — run ESLint
- `npm run typecheck` — run TypeScript checks
