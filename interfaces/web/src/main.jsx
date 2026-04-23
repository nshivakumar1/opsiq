import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useNavigate } from 'react-router-dom'
import { Auth0Provider } from '@auth0/auth0-react'
import './index.css'
import App from './App.jsx'

const domain   = import.meta.env.VITE_AUTH0_DOMAIN
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID
const audience = import.meta.env.VITE_AUTH0_AUDIENCE

// Auth0Provider needs useNavigate, which requires being inside BrowserRouter.
// So BrowserRouter wraps Auth0Provider here — NOT inside App.
function Auth0ProviderWithNavigate({ children }) {
  const navigate = useNavigate()

  const onRedirectCallback = (appState) => {
    // Use React Router navigate so the router's internal location stays in sync.
    // replaceState / window.location.href both bypass React Router and can
    // cause the BrowserRouter to re-read a stale URL, producing an auth loop.
    navigate(appState?.returnTo ?? '/app', { replace: true })
  }

  const authorizationParams = {
    redirect_uri: window.location.origin + '/app',
    scope: 'openid profile email',
    // Only include audience when configured — undefined audience can produce
    // a malformed authorization URL in some SDK versions.
    ...(audience ? { audience } : {}),
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={authorizationParams}
      cacheLocation="localstorage"
      onRedirectCallback={onRedirectCallback}
    >
      {children}
    </Auth0Provider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Auth0ProviderWithNavigate>
        <App />
      </Auth0ProviderWithNavigate>
    </BrowserRouter>
  </StrictMode>
)
