const THEME_KEY = 'tudso-theme'

function isLight() {
  return document.documentElement.classList.contains('light')
}

function syncThemeButton() {
  const button = document.getElementById('theme-toggle')
  if (!button) return
  const light = isLight()
  button.setAttribute('aria-label', light ? 'Use dark mode' : 'Use light mode')
  button.setAttribute('title', light ? 'Dark mode' : 'Light mode')
}

function applyTheme(light) {
  document.documentElement.classList.toggle('light', light)
  try {
    localStorage.setItem(THEME_KEY, light ? 'light' : 'dark')
  } catch (e) {}
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', light ? '#f4f4f5' : '#1c1c1f')
  syncThemeButton()
}

document.getElementById('theme-toggle')?.addEventListener('click', () => {
  applyTheme(!isLight())
})
syncThemeButton()

function markLoading(button) {
  if (!(button instanceof HTMLElement) || button.classList.contains('is-loading')) return
  button.classList.add('is-loading')
  button.setAttribute('aria-busy', 'true')
  const spin = document.createElement('span')
  spin.className = 'spinner'
  spin.setAttribute('aria-hidden', 'true')
  button.append(spin)
}

function lockPage(active) {
  document.querySelectorAll('button:not(.theme-toggle)').forEach((button) => {
    button.disabled = true
  })
  document.querySelectorAll('.switch a, a.forgot').forEach((link) => {
    link.setAttribute('aria-disabled', 'true')
    link.dataset.locked = '1'
  })
  markLoading(active)
}

document.querySelectorAll('form').forEach((form) => {
  form.addEventListener('submit', (event) => {
    if (form.dataset.busy === '1') {
      event.preventDefault()
      return
    }
    form.dataset.busy = '1'
    const submitter = event.submitter instanceof HTMLElement
      ? event.submitter
      : form.querySelector('button[type="submit"]')
    lockPage(submitter)
  })
})

document.querySelectorAll('a.primary').forEach((link) => {
  link.addEventListener('click', () => {
    markLoading(link)
  })
})

document.querySelectorAll('.switch a, a.forgot').forEach((link) => {
  link.addEventListener('click', (event) => {
    if (link.dataset.locked === '1') event.preventDefault()
  })
})
