import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import Landing from './pages/Landing.jsx'
import Chat from './pages/Chat.jsx'
import AuthGuard from './components/AuthGuard.jsx'

export default function App() {
  const { isLoading } = useAuth0()

  if (isLoading) return null

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={
          <AuthGuard>
            <Chat />
          </AuthGuard>
        } />
      </Routes>
    </BrowserRouter>
  )
}
