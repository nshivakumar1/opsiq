import { useAuth0 } from '@auth0/auth0-react'
import { useEffect } from 'react'

export default function AuthGuard({ children }) {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      loginWithRedirect({
        appState: { returnTo: '/app' }
      })
    }
  }, [isLoading, isAuthenticated, loginWithRedirect])

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#070b10',
        color: '#00d4aa',
        fontFamily: 'JetBrains Mono, monospace',
        gap: '16px'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '2px solid #0f6e56',
          borderTop: '2px solid #00d4aa',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <span style={{ fontSize: '13px', color: '#7d8590' }}>
          Authenticating...
        </span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return children
}
