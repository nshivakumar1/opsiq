import { useState, useRef, useEffect } from 'react'
import { useAuth0 } from '@auth0/auth0-react'

function Avatar({ user }) {
  const [imgError, setImgError] = useState(false)

  if (user?.picture && !imgError) {
    return (
      <img
        src={user.picture}
        alt={user.name || 'User'}
        onError={() => setImgError(true)}
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          objectFit: 'cover',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      />
    )
  }

  // Initials fallback
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <div style={{
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #00d4aa, #7c3aed)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px',
      fontWeight: '700',
      color: 'white',
      fontFamily: 'sans-serif',
      flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

export default function UserMenu({ user }) {
  const { logout } = useAuth0()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // returnTo must also be listed in Auth0 dashboard → Applications → [app] → Allowed Logout URLs
  function handleSignOut() {
    logout({ logoutParams: { returnTo: window.location.origin } })
  }

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '50%',
          padding: '2px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,212,170,0.5)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
      >
        <Avatar user={user} />
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 'calc(100% + 8px)',
          minWidth: '200px',
          background: '#0f1520',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          zIndex: 100,
        }}>
          {/* Email */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <p style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: '11px',
              fontFamily: 'sans-serif',
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {user?.email ?? ''}
            </p>
          </div>

          {/* Settings (placeholder) */}
          <a
            href="/settings"
            style={{
              display: 'block',
              padding: '10px 16px',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '13px',
              fontFamily: 'sans-serif',
              textDecoration: 'none',
              transition: 'background 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,170,0.08)'; e.currentTarget.style.color = '#00d4aa' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
          >
            Settings
          </a>

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '13px',
              fontFamily: 'sans-serif',
              cursor: 'pointer',
              transition: 'background 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; e.currentTarget.style.color = '#f87171' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
