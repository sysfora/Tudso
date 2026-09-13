import { ONE_TIME_PLAN_CATALOG, SUBSCRIPTION_PLAN_CATALOG, planIntervalLabel, type PaidPlan, type PlanCatalogItem } from './plans.js'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

const GOOGLE_MARK = `<svg class="google-mark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
</svg>`

const STYLES = `
  :root {
    color-scheme: dark;
    --bg: #17152a;
    --fg: #f3f3f5;
    --muted: #a8a8b0;
    --quiet: #8a8a94;
    --border: color-mix(in srgb, #ffffff 8%, transparent);
    --surface: #26223d;
    --field: #332e4e;
    --lift: #40395f;
    --accent: #cfc7ff;
    --fill: #7568e8;
    --fill-hover: color-mix(in srgb, #7568e8 82%, #ffffff);
    --fill-fg: #ffffff;
    --danger: #e07070;
    --google: var(--surface);
    --google-fg: var(--fg);
    --google-hover: var(--lift);
    --google-border: var(--border);
    --radius: 12px;
    --motion: 140ms;
  }
  html.light {
    color-scheme: light;
    --bg: #f8f6ff;
    --fg: #292440;
    --muted: #706a84;
    --quiet: #8a8a94;
    --border: color-mix(in srgb, #000000 8%, transparent);
    --surface: #ffffff;
    --field: #ffffff;
    --lift: #ebe7fb;
    --accent: #635bdb;
    --fill: #635bdb;
    --fill-hover: color-mix(in srgb, #635bdb 82%, #000000);
    --fill-fg: #ffffff;
    --danger: #c44444;
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  html {
    scrollbar-color: color-mix(in srgb, var(--accent) 58%, transparent) transparent;
    scrollbar-width: thin;
  }
  *::-webkit-scrollbar { width: 12px; height: 12px; }
  *::-webkit-scrollbar-track { background: transparent; }
  *::-webkit-scrollbar-thumb {
    min-height: 48px;
    border: 3px solid transparent;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 58%, transparent);
    background-clip: padding-box;
  }
  *::-webkit-scrollbar-thumb:hover {
    background: var(--accent);
    background-clip: padding-box;
  }
  *::-webkit-scrollbar-corner { background: transparent; }
  body {
    margin: 0;
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    font-family: "Inter", ui-sans-serif, system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.45;
    background:
      radial-gradient(60% 50% at 10% 20%, rgba(117, 104, 232, 0.22), transparent 70%),
      radial-gradient(55% 45% at 90% 80%, rgba(117, 104, 232, 0.16), transparent 70%),
      var(--bg);
    color: var(--fg);
  }
  main {
    width: 100%;
    max-width: 430px;
    padding: 32px;
    border: 1px solid var(--border);
    border-radius: 24px;
    background: var(--surface);
    box-shadow: 0 24px 70px rgba(20, 15, 50, 0.18);
  }
  .mark {
    display: block;
    width: 48px;
    height: 48px;
    margin: 0 0 24px;
    object-fit: contain;
  }
  h1 {
    margin: 0 0 8px;
    font-family: "Instrument Serif", Georgia, serif;
    font-size: 38px;
    font-weight: 400;
    letter-spacing: -0.02em;
    line-height: 1.2;
    text-wrap: balance;
  }
  .lede {
    margin: 0 0 28px;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.5;
  }
  .error {
    margin: -8px 0 20px;
    color: var(--danger);
    font-size: 13px;
    line-height: 1.45;
  }
  form { margin: 0; }
  .stack { display: grid; gap: 14px; }
  .field { display: grid; gap: 6px; }
  .field-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .field-head label { margin: 0; }
  .forgot {
    font-size: 12px;
    font-weight: 500;
    color: var(--accent);
    text-decoration: none;
    text-underline-offset: 2px;
    white-space: nowrap;
  }
  .forgot:hover { text-decoration: underline; }
  label {
    font-size: 13px;
    font-weight: 500;
    color: var(--fg);
  }
  input {
    width: 100%;
    height: 40px;
    padding: 0 12px;
    border: 1px solid transparent;
    border-radius: var(--radius);
    background: var(--field);
    color: var(--fg);
    caret-color: var(--fg);
    font: inherit;
    font-size: 13px;
    color-scheme: inherit;
  }
  input::placeholder {
    color: var(--quiet);
    opacity: 1;
  }
  input:hover { background: var(--lift); }
  input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    background: var(--lift);
  }
  input:autofill,
  input:autofill:hover,
  input:autofill:focus,
  input:-webkit-autofill,
  input:-webkit-autofill:hover,
  input:-webkit-autofill:focus,
  input:-webkit-autofill:active {
    -webkit-text-fill-color: var(--fg);
    caret-color: var(--fg);
    border-color: transparent;
    background-color: var(--field);
    background-image: none;
    color: var(--fg);
    box-shadow: inset 0 0 0 1000px var(--field);
    transition: background-color 99999s ease-out;
  }
  input:hover:autofill,
  input:hover:-webkit-autofill,
  input:focus-visible:autofill,
  input:focus-visible:-webkit-autofill {
    background-color: var(--lift);
    box-shadow: inset 0 0 0 1000px var(--lift);
  }
  .hint {
    margin: 0;
    font-size: 12px;
    color: var(--quiet);
  }
  button, a.primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    height: 40px;
    padding: 0 14px;
    border: 1px solid transparent;
    border-radius: var(--radius);
    background: var(--fill);
    color: var(--fill-fg);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    position: relative;
    transition: background-color var(--motion) ease;
  }
  button:hover, a.primary:hover { background: var(--fill-hover); }
  button:focus-visible, a.primary:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  a.secondary-link {
    display: block;
    margin-top: 14px;
    color: var(--accent);
    font-size: 13px;
    text-align: center;
    text-decoration: none;
  }
  a.secondary-link:hover { text-decoration: underline; }
  button:disabled { opacity: 0.4; cursor: default; }
  button.is-loading, a.primary.is-loading { opacity: 1; }
  button.is-loading > :not(.spinner),
  a.primary.is-loading > :not(.spinner) { opacity: 0; }
  .oauth {
    background: var(--google);
    color: var(--google-fg);
    border-color: var(--google-border);
  }
  .oauth:hover { background: var(--google-hover); }
  .theme-toggle {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 20;
    width: 40px;
    height: 40px;
    padding: 0;
    background: transparent;
    color: var(--muted);
  }
  .theme-toggle:hover {
    background: var(--surface);
    color: var(--fg);
  }
  .theme-toggle:disabled { opacity: 1; cursor: pointer; }
  .theme-toggle svg {
    width: 18px;
    height: 18px;
    flex: 0 0 18px;
  }
  html.light .icon-sun { display: none; }
  html:not(.light) .icon-moon { display: none; }
  .google-mark {
    width: 18px;
    height: 18px;
    flex: 0 0 18px;
  }
  .spinner {
    position: absolute;
    width: 16px;
    height: 16px;
    border: 2px solid color-mix(in srgb, currentColor 28%, transparent);
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.65s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .rule {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
    margin: 20px 0;
    color: var(--quiet);
    font-size: 12px;
  }
  .rule::before, .rule::after {
    content: "";
    height: 1px;
    background: var(--border);
  }
  .switch {
    margin: 20px 0 0;
    text-align: center;
    font-size: 13px;
    color: var(--muted);
  }
  .switch a {
    color: var(--accent);
    text-decoration: none;
    text-underline-offset: 2px;
  }
  .switch a:hover { text-decoration: underline; }
  .footnote {
    margin: 28px 0 0;
    text-align: center;
    font-size: 12px;
    line-height: 1.45;
    color: var(--quiet);
  }
  body.choose-plan {
    display: block;
    height: auto;
    min-height: 100%;
    min-width: 0;
    align-items: flex-start;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 48px 24px 160px;
  }
  html:has(body.choose-plan) {
    height: auto;
    min-height: 100%;
    overflow-y: auto;
  }
  body.choose-plan main {
    max-width: 980px;
    margin: 0 auto;
  }
  .who {
    margin: -12px 0 28px;
    color: var(--quiet);
    font-size: 13px;
  }
  .plan-tabs > input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }
  .tab-bar {
    display: flex;
    width: fit-content;
    margin: 0 auto 20px;
    padding: 4px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface);
  }
  .tab-bar label {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 36px;
    padding: 0 16px;
    border-radius: 999px;
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .tab-bar label:hover { color: var(--fg); }
  .plan-tabs:has(#tab-one-time:checked) label[for="tab-one-time"],
  .plan-tabs:has(#tab-subs:checked) label[for="tab-subs"] {
    background: var(--fg);
    color: var(--surface);
  }
  .plan-panel { display: none; }
  .plan-tabs:has(#tab-one-time:checked) .panel-one-time,
  .plan-tabs:has(#tab-subs:checked) .panel-subs { display: block; }
  .plans {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    align-items: stretch;
  }
  .plans.plans-subs {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .plan {
    display: flex;
    flex-direction: column;
    position: relative;
    min-width: 0;
    min-height: 100%;
    padding: 28px 24px 24px;
    border: 1px solid var(--border);
    border-radius: 24px;
    background: var(--surface);
    box-shadow: 0 10px 30px rgba(20, 15, 50, 0.08);
  }
  .plan-featured {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, var(--surface));
  }
  .plan-mark {
    margin: 0 0 12px;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.06em;
    line-height: 1;
  }
  .plan-featured .plan-mark { color: var(--accent); }
  .plan-badge {
    position: absolute;
    top: 14px;
    right: 14px;
    padding: 4px 8px;
    border-radius: 999px;
    background: var(--fill);
    color: var(--fill-fg);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.01em;
  }
  .plan h2 {
    margin: 0;
    font-family: "Instrument Serif", Georgia, serif;
    font-size: 28px;
    font-weight: 400;
    letter-spacing: -0.02em;
  }
  .plan-featured h2 { color: var(--accent); }
  .price {
    margin: 10px 0 0;
    font-family: "Instrument Serif", Georgia, serif;
    font-size: 42px;
    font-weight: 400;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .price .cents {
    margin-left: 1px;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0;
    color: var(--muted);
    vertical-align: super;
  }
  .plan-copy {
    margin: 10px 0 0;
    overflow-wrap: anywhere;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.5;
  }
  .features {
    list-style: none;
    display: grid;
    gap: 8px;
    flex: 1;
    margin: 18px 0 20px;
    padding: 0;
  }
  .features li {
    display: grid;
    grid-template-columns: 16px 1fr;
    gap: 8px;
    align-items: start;
    min-width: 0;
    font-size: 13px;
    line-height: 1.4;
  }
  .features li span { min-width: 0; overflow-wrap: anywhere; }
  .features .out { color: var(--quiet); }
  .tick, .dash {
    width: 16px;
    height: 16px;
    margin-top: 1px;
  }
  .plan form { margin-top: auto; }
  .plan:not(.plan-featured) button {
    background: transparent;
    color: var(--fg);
    border-color: var(--border);
  }
  .plan:not(.plan-featured) button:hover {
    background: var(--lift);
  }
  @media (max-width: 860px) {
    .plans, .plans.plans-subs { grid-template-columns: 1fr; }
  }
  body.choose-plan {
    --choose-bg: #1c1c1f;
    --choose-fg: #f3f3f5;
    --choose-muted: #a8a8b0;
    --choose-border: rgba(255, 255, 255, 0.08);
    --choose-card: #26262b;
    --choose-secondary: #303036;
    --choose-primary: #5b5fee;
    --choose-primary-hover: #514bd5;
    --choose-mint: #263b35;
    --choose-lavender: #302b45;
    --choose-yellow: #443a24;
    --choose-pink: #432d36;
    align-items: flex-start;
    display: block;
    height: auto;
    min-height: 100%;
    min-width: 0;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 88px 20px 72px;
    background:
      radial-gradient(55% 35% at 100% 0%, rgba(117, 95, 238, 0.18), transparent 70%),
      radial-gradient(55% 35% at 0% 100%, rgba(67, 118, 94, 0.16), transparent 70%),
      var(--choose-bg);
    color: var(--choose-fg);
  }
  html.light body.choose-plan {
    --choose-bg: #f8f6ff;
    --choose-fg: #1a1a1e;
    --choose-muted: #706a84;
    --choose-border: rgba(0, 0, 0, 0.08);
    --choose-card: #ffffff;
    --choose-secondary: #292440;
    --choose-primary: #635bdb;
    --choose-primary-hover: #5149c2;
    --choose-mint: #e2f4ed;
    --choose-lavender: #e9e4fb;
    --choose-yellow: #fff2c8;
    --choose-pink: #f9e4ea;
    background:
      radial-gradient(55% 35% at 100% 0%, rgba(190, 161, 255, 0.2), transparent 70%),
      radial-gradient(55% 35% at 0% 100%, rgba(117, 220, 190, 0.18), transparent 70%),
      var(--choose-bg);
  }
  body.choose-plan main {
    max-width: 1120px;
    padding: 0 0 120px;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }
  body.choose-plan .theme-toggle {
    color: var(--choose-muted);
  }
  body.choose-plan .theme-toggle:hover {
    background: var(--choose-card);
    color: var(--choose-fg);
  }
  body.choose-plan .mark {
    width: 44px;
    height: 44px;
    margin: 0 auto 22px;
  }
  body.choose-plan .eyebrow {
    margin: 0 0 8px;
    color: var(--choose-primary);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-align: center;
    text-transform: uppercase;
  }
  body.choose-plan h1 {
    max-width: 680px;
    margin: 0 auto 10px;
    color: var(--choose-fg);
    font-size: clamp(38px, 6vw, 64px);
    line-height: 1.02;
    text-align: center;
  }
  body.choose-plan .lede {
    max-width: 560px;
    margin: 0 auto 12px;
    color: var(--choose-muted);
    font-size: 15px;
    text-align: center;
  }
  body.choose-plan .who {
    margin: 0 auto 32px;
    color: var(--choose-muted);
    text-align: center;
  }
  body.choose-plan .tab-bar {
    margin-bottom: 16px;
    border-color: var(--choose-border);
    background: var(--choose-card);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  }
  body.choose-plan .tab-bar label {
    color: var(--choose-muted);
  }
  body.choose-plan .tab-tabs label:hover,
  body.choose-plan .tab-bar label:hover {
    color: var(--choose-fg);
  }
  body.choose-plan .plan-tabs:has(#tab-one-time:checked) label[for="tab-one-time"],
  body.choose-plan .plan-tabs:has(#tab-subs:checked) label[for="tab-subs"] {
    background: var(--choose-secondary);
    color: #ffffff;
  }
  body.choose-plan .plans {
    gap: 16px;
  }
  body.choose-plan .plan {
    min-width: 0;
    padding: 24px;
    border: 1px solid var(--choose-border);
    border-radius: 24px;
    background: var(--choose-card);
    box-shadow: none;
    transition: transform var(--motion) ease, box-shadow var(--motion) ease;
  }
  body.choose-plan .plan:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.12);
  }
  body.choose-plan .plan-free { background: var(--choose-mint); }
  body.choose-plan .plan-plus { background: var(--choose-lavender); }
  body.choose-plan .plan-pro { background: var(--choose-pink); }
  body.choose-plan .plan-weekly { background: var(--choose-card); }
  body.choose-plan .plan-yearly { background: var(--choose-card); }
  body.choose-plan .plan-featured {
    border: 2px solid var(--choose-primary);
    background: color-mix(in srgb, var(--choose-primary) 20%, var(--choose-card)) !important;
    box-shadow: 0 12px 28px color-mix(in srgb, var(--choose-primary) 16%, transparent);
  }
  body.choose-plan .plan-mark,
  body.choose-plan .plan h2,
  body.choose-plan .price {
    color: var(--choose-fg);
  }
  body.choose-plan .plan-featured .plan-mark,
  body.choose-plan .plan-featured h2 {
    color: var(--choose-primary);
  }
  body.choose-plan .plan-copy,
  body.choose-plan .price .cents,
  body.choose-plan .features .out {
    color: var(--choose-muted);
  }
  body.choose-plan .plan-badge {
    background: var(--choose-secondary);
    color: #ffffff;
  }
  body.choose-plan .plan:not(.plan-featured) button {
    border-color: var(--choose-border);
    background: var(--choose-secondary);
    color: #ffffff;
  }
  body.choose-plan .plan:not(.plan-featured) button:hover {
    background: color-mix(in srgb, var(--choose-secondary) 82%, #ffffff);
  }
  body.choose-plan .plan button {
    background: var(--choose-secondary);
    color: #ffffff;
  }
  body.choose-plan .plan-featured button {
    background: var(--choose-primary);
    color: #ffffff;
  }
  body.choose-plan .plan button:hover {
    background: color-mix(in srgb, var(--choose-secondary) 82%, #ffffff);
  }
  body.choose-plan .plan-featured button:hover {
    background: var(--choose-primary-hover);
  }
  body.choose-plan .footnote {
    margin-top: 30px;
    color: var(--choose-muted);
  }
  @media (max-width: 600px) {
    body.choose-plan { padding: 56px 16px 128px; }
    body.choose-plan .plans { gap: 14px; }
    body.choose-plan .plan { padding: 24px 20px 20px; }
  }
  ::selection {
    background: color-mix(in srgb, var(--accent) 28%, transparent);
  }
  @media (prefers-reduced-motion: reduce) {
    :root { --motion: 0ms; }
    .spinner { animation: none; opacity: 0.7; }
  }
`

const THEME_BOOT = `<script>
(function () {
  var light = false
  try {
    light = localStorage.getItem('tudso-theme') === 'light'
  } catch (e) {}
  if (light) document.documentElement.classList.add('light')
  var meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', light ? '#f8f6ff' : '#17152a')
})()
</script>`

const THEME_TOGGLE = `<button type="button" class="theme-toggle" id="theme-toggle" aria-label="Use light mode" title="Light mode">
    <svg class="icon-sun" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="3.25" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06"/>
    </svg>
    <svg class="icon-moon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" d="M13.5 9.2A5.5 5.5 0 1 1 6.8 2.5 4.25 4.25 0 0 0 13.5 9.2z"/>
    </svg>
  </button>`

function documentPage(title: string, body: string, bodyClass = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="application-name" content="Tudso">
  <meta name="apple-mobile-web-app-title" content="Tudso">
  <meta name="theme-color" content="#1c1c1f">
  <link rel="icon" href="/brand/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon-32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/brand/favicon-16.png">
  <link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">
  <link rel="manifest" href="/brand/site.webmanifest">
  <style>${STYLES}</style>
  ${THEME_BOOT}
  <script src="/brand/login.js" defer></script>
</head>
<body${bodyClass ? ` class="${escapeHtml(bodyClass)}"` : ''}>
${THEME_TOGGLE}
${body}
</body>
</html>`
}

function brandMark(): string {
  return `<img class="mark" src="/brand/icon.png" width="48" height="48" alt="Tudso">`
}

function googleButton(label: string, state: string, mode: 'login' | 'register'): string {
  return `<form method="POST" action="/auth/desktop/oauth">
      <input type="hidden" name="state" value="${state}">
      <input type="hidden" name="provider" value="google">
      <input type="hidden" name="mode" value="${mode}">
      <button type="submit" class="oauth">${GOOGLE_MARK}<span>${escapeHtml(label)}</span></button>
    </form>`
}

export function loginPage(params: { state: string; error?: string; mode?: 'login' | 'register' }): string {
  const { state, error } = params
  const isRegister = params.mode === 'register'
  const safeState = escapeHtml(state)
  const title = isRegister ? 'Create your Tudso account' : 'Sign in to Tudso'
  const heading = isRegister ? 'Create your account' : 'Sign in to Tudso'
  const lede = isRegister
    ? 'Set up Tudso so it can learn how you work.'
    : 'Your private real-time copilot for live interviews.'
  const googleLabel = isRegister ? 'Sign up with Google' : 'Continue with Google'
  const switchLine = isRegister
    ? `Already have an account? <a href="/auth/desktop?state=${encodeURIComponent(state)}">Sign in</a>`
    : `New to Tudso? <a href="/auth/desktop?state=${encodeURIComponent(state)}&mode=register">Create account</a>`
  const footnote = isRegister
    ? 'This window will close automatically after creating your account.'
    : 'This window will close automatically after signing in.'

  const fields = isRegister
    ? `<form method="POST" action="/auth/desktop/register">
      <input type="hidden" name="state" value="${safeState}">
      <div class="stack">
        <div class="field">
          <label for="name">Name</label>
          <input id="name" name="name" type="text" autocomplete="name" placeholder="Alex">
        </div>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" required autofocus autocomplete="email" placeholder="you@example.com">
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" required minlength="8" autocomplete="new-password" placeholder="Create a password">
          <p class="hint">Use at least 8 characters.</p>
        </div>
        <div class="field">
          <label for="passwordConfirm">Confirm password</label>
          <input id="passwordConfirm" name="passwordConfirm" type="password" required minlength="8" autocomplete="new-password" placeholder="Re-enter your password">
        </div>
        <button type="submit">Create account</button>
      </div>
    </form>`
    : `<form method="POST" action="/auth/desktop/login">
      <input type="hidden" name="state" value="${safeState}">
      <div class="stack">
        <div class="field">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" required autofocus autocomplete="email" placeholder="you@example.com">
        </div>
        <div class="field">
          <div class="field-head">
            <label for="password">Password</label>
            <a class="forgot" href="/auth/desktop/forgot?state=${encodeURIComponent(state)}">Forgot password?</a>
          </div>
          <input id="password" name="password" type="password" required autocomplete="current-password" placeholder="Your password">
        </div>
        <button type="submit">Continue with email</button>
      </div>
    </form>`

  const body = `  <main>
    ${brandMark()}
    <h1>${heading}</h1>
    <p class="lede">${lede}</p>
    ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
    ${googleButton(googleLabel, safeState, isRegister ? 'register' : 'login')}
    <div class="rule">or</div>
    ${fields}
    <p class="switch">${switchLine}</p>
    <p class="footnote">${footnote}</p>
  </main>`

  return documentPage(title, body)
}

export function authCompletePage(callbackUrl: string, copy?: { title?: string; lede?: string }): string {
  const safeUrl = escapeHtml(callbackUrl)
  const title = copy?.title ?? "You're signed in"
  const lede = copy?.lede ?? 'Returning to the Tudso app. You can close this tab after it opens.'
  const body = `  <main>
    ${brandMark()}
    <h1>${escapeHtml(title)}</h1>
    <p class="lede">${escapeHtml(lede)}</p>
    <a class="primary" href="${safeUrl}">Open Tudso</a>
    <a class="secondary-link" href="/dashboard">Continue in browser</a>
  </main>`
  return documentPage('Returning to Tudso', body)
}

const CHECK = `<svg class="tick" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M3.5 8.5 6.5 11.5 12.5 4.5"/></svg>`
const DASH = `<svg class="dash" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M4 8h8"/></svg>`

type PlanPrice = {
  id: PaidPlan
  amount: number | null
  currency: string
  interval: string
}

function formatPlanPrice(price?: PlanPrice, item?: PlanCatalogItem): string {
  const amount = price?.amount ?? item?.fallbackAmount
  if (amount == null) return ''
  if (amount <= 0) return 'Free'
  const dollars = Math.floor(Math.abs(amount) / 100)
  const cents = String(Math.abs(amount) % 100).padStart(2, '0')
  const suffix = item ? ` <span class="cents">/${planIntervalLabel(item.interval)}</span>` : ''
  return `$${dollars}<span class="cents">.${cents}</span>${suffix}`
}

export function subscribePage(params: {
  code: string
  state: string
  email: string
  prices: PlanPrice[]
  error?: string
}): string {
  const code = escapeHtml(params.code)
  const state = escapeHtml(params.state)
  const prices = Object.fromEntries(params.prices.map((price) => [price.id, price])) as Partial<Record<PaidPlan, PlanPrice>>
  const card = (plan: PlanCatalogItem) => {
    const price = formatPlanPrice(plan.id === 'free' ? undefined : prices[plan.id], plan)
    const features = plan.features.map((feature) => `
          <li class="${feature.included ? '' : 'out'}">${feature.included ? CHECK : DASH}<span>${escapeHtml(feature.text)}</span></li>`).join('')
    const badge = plan.badge ? `<span class="plan-badge">${escapeHtml(plan.badge)}</span>` : ''
    const actionLabel = plan.id === 'free' ? 'Get started free' : plan.action
    const action = plan.id === 'free'
      ? `<form method="POST" action="/auth/desktop/free">
          <input type="hidden" name="code" value="${code}">
          <input type="hidden" name="state" value="${state}">
          <button type="submit">${escapeHtml(actionLabel)}</button>
        </form>`
      : `<form method="POST" action="/auth/desktop/subscribe">
          <input type="hidden" name="code" value="${code}">
          <input type="hidden" name="state" value="${state}">
          <input type="hidden" name="plan" value="${plan.id}">
          <button type="submit">${escapeHtml(actionLabel)}</button>
        </form>`
    return `<article class="plan plan-${plan.id}${plan.featured ? ' plan-featured' : ''}">
        ${badge}
        <h2>${escapeHtml(plan.name)}</h2>
        ${price ? `<p class="price">${price}</p>` : ''}
        <p class="plan-copy">${escapeHtml(plan.description)}</p>
        <ul class="features">${features}
        </ul>
        ${action}
      </article>`
  }

  const body = `  <main>
    ${brandMark()}
    <p class="eyebrow">Plans &amp; access</p>
    <h1>Choose your edge.</h1>
    <p class="lede">Unlimited interview sessions on a subscription, or pay once for a session pack.</p>
    <p class="who">Billing for ${escapeHtml(params.email)}</p>
    ${params.error ? `<p class="error" role="alert">${escapeHtml(params.error)}</p>` : ''}
    <div class="plan-tabs">
      <input type="radio" name="plan-tab" id="tab-one-time">
      <input type="radio" name="plan-tab" id="tab-subs" checked>
      <div class="tab-bar" role="tablist" aria-label="Plan type">
        <label for="tab-subs" role="tab">Subscriptions</label>
        <label for="tab-one-time" role="tab">One-Time</label>
      </div>
      <section class="plan-panel panel-one-time">
        <div class="plans">
        ${ONE_TIME_PLAN_CATALOG.map(card).join('\n        ')}
        </div>
      </section>
      <section class="plan-panel panel-subs">
        <div class="plans plans-subs">
        ${SUBSCRIPTION_PLAN_CATALOG.map(card).join('\n        ')}
        </div>
      </section>
    </div>
  </main>`
  return documentPage('Choose a Tudso plan', body, 'choose-plan')
}

export function sessionExpiredPage(): string {
  const body = `  <main>
    ${brandMark()}
    <h1>Sign-in expired</h1>
    <p class="lede">Return to the Tudso app and sign in again to pick a plan.</p>
  </main>`
  return documentPage('Sign-in expired', body)
}

function signInLink(state?: string): string {
  const href = state
    ? `/login?state=${encodeURIComponent(state)}`
    : '/login'
  return `<p class="switch"><a href="${href}">Back to sign in</a></p>`
}

export function forgotPasswordPage(params: { state?: string; error?: string; email?: string }): string {
  const state = escapeHtml(params.state ?? '')
  const body = `  <main>
    ${brandMark()}
    <h1>Forgot your password?</h1>
    <p class="lede">Enter the email for your Tudso account. If it exists, we will send a reset link.</p>
    ${params.error ? `<p class="error" role="alert">${escapeHtml(params.error)}</p>` : ''}
    <form method="POST" action="/auth/desktop/forgot">
      ${state ? `<input type="hidden" name="state" value="${state}">` : ''}
      <div class="stack">
        <div class="field">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" required autofocus autocomplete="email" placeholder="you@example.com" value="${escapeHtml(params.email ?? '')}">
        </div>
        <button type="submit">Send reset link</button>
      </div>
    </form>
    ${signInLink(params.state)}
  </main>`
  return documentPage('Forgot password', body)
}

export function checkEmailPage(params: {
  title: string
  lede: string
  email?: string
  state?: string
  resendAction?: string
}): string {
  const resend = params.resendAction && params.email
    ? `<form method="POST" action="${escapeHtml(params.resendAction)}">
      ${params.state ? `<input type="hidden" name="state" value="${escapeHtml(params.state)}">` : ''}
      <input type="hidden" name="email" value="${escapeHtml(params.email)}">
      <button type="submit" class="oauth">Resend email</button>
    </form>`
    : ''
  const body = `  <main>
    ${brandMark()}
    <h1>${escapeHtml(params.title)}</h1>
    <p class="lede">${escapeHtml(params.lede)}</p>
    ${resend}
    ${signInLink(params.state)}
  </main>`
  return documentPage(params.title, body)
}

export function resetPasswordPage(params: { token: string; error?: string }): string {
  const token = escapeHtml(params.token)
  const body = `  <main>
    ${brandMark()}
    <h1>Choose a new password</h1>
    <p class="lede">Use at least 8 characters. You can sign in after this.</p>
    ${params.error ? `<p class="error" role="alert">${escapeHtml(params.error)}</p>` : ''}
    <form method="POST" action="/auth/reset-password">
      <input type="hidden" name="token" value="${token}">
      <div class="stack">
        <div class="field">
          <label for="password">New password</label>
          <input id="password" name="password" type="password" required minlength="8" autocomplete="new-password" placeholder="Create a password" autofocus>
        </div>
        <div class="field">
          <label for="passwordConfirm">Confirm password</label>
          <input id="passwordConfirm" name="passwordConfirm" type="password" required minlength="8" autocomplete="new-password" placeholder="Re-enter your password">
        </div>
        <button type="submit">Update password</button>
      </div>
    </form>
    ${signInLink()}
  </main>`
  return documentPage('Reset password', body)
}

export function confirmEmailChangePage(params: { token: string; error?: string }): string {
  const token = escapeHtml(params.token)
  const body = `  <main>
    ${brandMark()}
    <h1>Confirm your new email</h1>
    <p class="lede">Enter your current password to finish changing the email on this account.</p>
    ${params.error ? `<p class="error" role="alert">${escapeHtml(params.error)}</p>` : ''}
    <form method="POST" action="/auth/confirm-email-change">
      <input type="hidden" name="token" value="${token}">
      <div class="stack">
        <div class="field">
          <label for="password">Current password</label>
          <input id="password" name="password" type="password" required autocomplete="current-password" placeholder="Your password" autofocus>
        </div>
        <button type="submit">Confirm email</button>
      </div>
    </form>
  </main>`
  return documentPage('Confirm email change', body)
}

export function statusPage(params: { title: string; heading: string; lede: string; state?: string }): string {
  const body = `  <main>
    ${brandMark()}
    <h1>${escapeHtml(params.heading)}</h1>
    <p class="lede">${escapeHtml(params.lede)}</p>
    ${signInLink(params.state)}
  </main>`
  return documentPage(params.title, body)
}
