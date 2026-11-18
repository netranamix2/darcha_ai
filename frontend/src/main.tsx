import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '@fontsource-variable/source-serif-4/standard.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
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
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </LanguageProvider>
  </StrictMode>,
)
