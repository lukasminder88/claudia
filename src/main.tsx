import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { initPwa } from './lib/pwa'
import { initSync } from './lib/sync'
import './styles.css'

initPwa()
initSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
