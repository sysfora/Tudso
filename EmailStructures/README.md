# PocketBase email templates

Paste these into PocketBase so Tudso mail matches the app.

**PocketBase → Collections → users → Edit (gear) → Options → Mail templates**

Also paste `auth-alert.html` under **Auth alert**, and `otp.html` under **OTP**.

Keep PocketBase placeholders as they are: `{APP_NAME}`, `{TOKEN}`, `{OTP}`, `{ALERT_INFO}`.

The button links must go to the **Tudso API**, not PocketBase. The files use `https://tudso.com`. For local, change that origin to `http://localhost:3000`.

| File | PocketBase field | Opens |
|---|---|---|
| `verification.html` | Verification template | `/auth/verify-email?token={TOKEN}` |
| `reset-password.html` | Reset password template | `/auth/reset-password?token={TOKEN}` |
| `confirm-email-change.html` | Confirm email change template | `/auth/confirm-email-change?token={TOKEN}` |
| `auth-alert.html` | Auth alert | — |
| `otp.html` | OTP | — |

After pasting, send a test from PocketBase and confirm SMTP is enabled under **Settings → Mail settings**.
