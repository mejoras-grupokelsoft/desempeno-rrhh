import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.tsx'
import { AppProvider } from './context/AppContext.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <GoogleOAuthProvider clientId={clientId}>
        <AppProvider>
          <App />
        </AppProvider>
      </GoogleOAuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
