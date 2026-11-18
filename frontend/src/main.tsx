import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '@fontsource-variable/onest'
import '@fontsource-variable/jetbrains-mono'
import './theme/theme.css'
import './theme/shell.css'
import App from './App'
import { LanguageProvider } from './i18n/LanguageProvider'

const queryClient = new QueryClient()
const root = document.getElementById('root')
if (!root) throw new Error('The application root is missing')

createRoot(root).render(
  <StrictMode>
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </MotionConfig>
      </QueryClientProvider>
    </LanguageProvider>
  </StrictMode>,
)
