import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Auth0Provider } from '@auth0/auth0-react'
import './index.css'
import App from './App.jsx'

const domain   = import.meta.env.VITE_AUTH0_DOMAIN
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID
const audience = import.meta.env.VITE_AUTH0_AUDIENCE

// Use replaceState so Auth0 finishes writing the token before any navigation.
// A full page reload (window.location.href) can race ahead of localStorage writes
// and boot the app unauthenticated, causing an infinite redirect.
const onRedirectCallback = (appState) => {
  window.history.replaceState({}, document.title, appState?.returnTo ?? '/app')
}

// Only include audience when configured — passing undefined causes some
// Auth0 SDK versions to throw or produce a malformed authorization URL.
const authorizationParams = {
  redirect_uri: window.location.origin + '/app',
  ...(audience ? { audience } : {}),
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={authorizationParams}
      cacheLocation="localstorage"
      onRedirectCallback={onRedirectCallback}
    >
      <App />
    </Auth0Provider>
  </StrictMode>
)
