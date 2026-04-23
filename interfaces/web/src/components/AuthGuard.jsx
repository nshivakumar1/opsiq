import { useAuth0 } from '@auth0/auth0-react'

export default function AuthGuard({ children }) {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0()

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#070b10',
        gap: '20px',
      }}>
        {/* OpsIQ logo */}
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: '#7c3aed',
          boxShadow: '0 0 32px rgba(124,58,237,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
        }}>
          ⚡
        </div>

        {/* Spinner */}
        <div style={{
          width: '24px',
          height: '24px',
          border: '2px solid rgba(0,212,170,0.2)',
          borderTopColor: '#00d4aa',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />

        <span style={{
          color: 'rgba(255,255,255,0.45)',
          fontSize: '13px',
          fontFamily: 'sans-serif',
          letterSpacing: '0.02em',
        }}>
          Authenticating...
        </span>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  if (!isAuthenticated) {
    loginWithRedirect()
    return null
  }

  return children
}
