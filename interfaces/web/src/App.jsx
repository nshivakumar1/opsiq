import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Chat from './pages/Chat.jsx'
import AuthGuard from './components/AuthGuard.jsx'

// BrowserRouter lives in main.jsx (wrapping Auth0Provider so useNavigate works
// inside onRedirectCallback). App only owns the route table.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={
        <AuthGuard>
          <Chat />
        </AuthGuard>
      } />
    </Routes>
  )
}
