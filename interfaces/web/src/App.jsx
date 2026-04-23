import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Chat from './pages/Chat.jsx'
import AuthGuard from './components/AuthGuard.jsx'

export default function App() {
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
