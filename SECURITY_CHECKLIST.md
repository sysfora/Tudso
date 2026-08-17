# Security Checklist

## Verified

- [x] AI provider secrets are not exposed to the renderer
- [x] Stripe secrets are not exposed to the renderer
- [x] PocketBase admin credentials are not exposed to the renderer
- [x] `nodeIntegration` is disabled
- [x] `contextIsolation` is enabled
- [x] IPC is typed and validated through `preload.ts`
- [x] PocketBase ownership rules are documented in `POCKETBASE_SETUP.md`
- [x] Subscription is verified server-side in `/ai/*` routes
- [x] Stripe webhook signatures are verified
- [x] AI usage is rate-limited
- [x] Authentication sessions use short-lived desktop tokens
- [x] Browser auth uses cryptographically secure state and short-lived codes
- [x] Screen capture requires user authorization via toggle
- [x] Audio capture is off by default and requires explicit toggle
- [x] Logout clears the desktop session
- [x] Payment status is updated only by verified Stripe webhooks
- [x] Core operations handle network failures with error states
- [x] Long-running AI streams are cancellable

## Implementation Notes

- The renderer stores only the desktop session token. It does not have access to `AI_API_KEY`, `STRIPE_SECRET_KEY`, or `POCKETBASE_ADMIN_PASSWORD`.
- The backend constructs all AI requests, system prompts, and context packages.
- Subscription entitlements are stored in PocketBase and updated only by the backend in response to verified Stripe events.
- All user data collections enforce owner-only access via PocketBase API rules.
- The custom protocol `tudso://auth/callback` is registered for secure desktop callback handling.
