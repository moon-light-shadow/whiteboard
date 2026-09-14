import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyThemeClass, getInitialTheme } from './store/ui-store'
import './styles/global.css'

applyThemeClass(getInitialTheme())

const container = document.getElementById('root')
if (container) {
  container.innerHTML = ''
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
