import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import { desktop, isElectron } from '@/lib/desktop'
import '@/styles/globals.css'

if (isElectron) {
  document.documentElement.dataset.platform = desktop.platform
  window.confirm = (message?: string) => desktop.app.confirm(String(message ?? ''))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
