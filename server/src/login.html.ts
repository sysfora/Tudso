function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function loginPage(params: { state: string; error?: string; mode?: 'login' | 'register' }): string {
  const { state, error } = params
  const mode = params.mode === 'register' ? 'register' : 'login'
  const isRegister = mode === 'register'
  const safeState = escapeHtml(state)
  const safeError = error ? escapeHtml(error) : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isRegister ? 'Create your Tudso account' : 'Sign in to Tudso'}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0b0b0d;
      color: #f3f3f5;
    }
    .card {
      width: 100%;
      max-width: 380px;
      padding: 32px;
      border-radius: 16px;
      background: #111114;
      border: 1px solid rgba(255,255,255,0.08);
    }
    h1 { margin: 0 0 8px; font-size: 22px; font-weight: 600; letter-spacing: -0.02em; }
    p { margin: 0 0 24px; color: #a8a8b0; font-size: 14px; }
    label { display: block; margin-bottom: 6px; font-size: 13px; color: #a8a8b0; }
    input {
      width: 100%;
      padding: 10px 12px;
      margin-bottom: 16px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.1);
      background: #18181c;
      color: #f3f3f5;
      font-size: 14px;
    }
    input:focus { outline: 2px solid #c3cce4; outline-offset: 2px; }
    button {
      width: 100%;
      padding: 10px 12px;
      border-radius: 8px;
      border: none;
      background: #c3cce4;
      color: #0b0b0d;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
    }
    button:hover { background: #d8deed; }
    .error { color: #e07070; font-size: 13px; margin-bottom: 16px; }
    .separator { text-align: center; margin: 20px 0; color: #6d6d76; font-size: 13px; }
    .oauth { background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #f3f3f5; }
    .oauth:hover { background: rgba(255,255,255,0.05); }
    .footer { margin-top: 20px; font-size: 13px; color: #6d6d76; text-align: center; }
    .switch { margin-top: 16px; font-size: 13px; color: #a8a8b0; text-align: center; }
    .switch a { color: #c3cce4; text-decoration: none; }
    .switch a:hover { color: #d8deed; }
    .hint { margin: -8px 0 16px; font-size: 12px; color: #6d6d76; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${isRegister ? 'Create your account' : 'Sign in to Tudso'}</h1>
    <p>${isRegister ? 'Set up Tudso so it can learn how you work.' : 'Your personal AI assistant for desktop.'}</p>
    ${safeError ? `<div class="error">${safeError}</div>` : ''}
    ${isRegister ? `
    <form method="POST" action="/auth/desktop/register">
      <input type="hidden" name="state" value="${safeState}">
      <label for="name">Name</label>
      <input id="name" name="name" type="text" autocomplete="name" placeholder="What should we call you?">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" required autofocus autocomplete="email">
      <label for="password">Password</label>
      <input id="password" name="password" type="password" required minlength="8" autocomplete="new-password">
      <p class="hint">Use at least 8 characters.</p>
      <label for="passwordConfirm">Confirm password</label>
      <input id="passwordConfirm" name="passwordConfirm" type="password" required minlength="8" autocomplete="new-password">
      <button type="submit">Create account</button>
    </form>
    ` : `
    <form method="POST" action="/auth/desktop/login">
      <input type="hidden" name="state" value="${safeState}">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" required autofocus autocomplete="email">
      <label for="password">Password</label>
      <input id="password" name="password" type="password" required autocomplete="current-password">
      <button type="submit">Continue with Email</button>
    </form>
    `}
    <div class="separator">or</div>
    <form method="POST" action="/auth/desktop/oauth">
      <input type="hidden" name="state" value="${safeState}">
      <input type="hidden" name="provider" value="google">
      <button type="submit" class="oauth">${isRegister ? 'Sign up with Google' : 'Continue with Google'}</button>
    </form>
    <div class="switch">
      ${isRegister
        ? `Already have an account? <a href="/auth/desktop?state=${encodeURIComponent(state)}">Sign in</a>`
        : `New to Tudso? <a href="/auth/desktop?state=${encodeURIComponent(state)}&mode=register">Create account</a>`}
    </div>
    <div class="footer">This window will close automatically after ${isRegister ? 'creating your account' : 'signing in'}.</div>
  </div>
</body>
</html>`
}

export function authCompletePage(callbackUrl: string): string {
  const safeUrl = escapeHtml(callbackUrl)
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0;url=${safeUrl}">
  <title>Returning to Tudso</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0b0b0d;
      color: #f3f3f5;
    }
    .card {
      width: 100%;
      max-width: 380px;
      padding: 32px;
      border-radius: 16px;
      background: #111114;
      border: 1px solid rgba(255,255,255,0.08);
      text-align: center;
    }
    h1 { margin: 0 0 8px; font-size: 22px; font-weight: 600; letter-spacing: -0.02em; }
    p { margin: 0 0 24px; color: #a8a8b0; font-size: 14px; }
    a.primary {
      display: block;
      width: 100%;
      padding: 10px 12px;
      border-radius: 8px;
      background: #c3cce4;
      color: #0b0b0d;
      font-weight: 600;
      font-size: 14px;
      text-decoration: none;
    }
    a.primary:hover { background: #d8deed; }
  </style>
</head>
<body>
  <div class="card">
    <h1>You're signed in</h1>
    <p>Returning to the Tudso app. You can close this tab after it opens.</p>
    <a class="primary" href="${safeUrl}">Open Tudso</a>
  </div>
</body>
</html>`
}
