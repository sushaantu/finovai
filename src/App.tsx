import { useState } from 'react'
import { AuthProvider } from './hooks/useAuth'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Journey from './components/Journey'
import Features from './components/Features'
import Tools from './components/Tools'
import ToolPage from './components/ToolPage'
import FAQ from './components/FAQ'
import CTA from './components/CTA'
import Footer from './components/Footer'
import { ChatSidebar } from './components/chat'

function App() {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const pathname = typeof window !== 'undefined' ? window.location.pathname.replace(/\/+$/, '') || '/' : '/'

  const openChat = () => setIsChatOpen(true)
  const closeChat = () => setIsChatOpen(false)

  let page = 'home'

  if (pathname === '/tools/interes-compuesto') {
    page = 'compound'
  } else if (pathname === '/tools/regla-72') {
    page = 'rule72'
  } else if (pathname === '/tools/costo-oportunidad') {
    page = 'opportunity'
  }

  return (
    <AuthProvider>
    <div className="min-h-screen bg-[--color-bg]">
      {/* Navigation */}
      <Navbar onChatOpen={openChat} />

      {page === 'home' ? (
        <>
          {/* Hero with background image */}
          <Hero onChatOpen={openChat} />

          {/* Journey - How it works */}
          <Journey />

          {/* Features grid */}
          <Features />

          {/* Tools */}
          <Tools />

          {/* FAQ */}
          <FAQ />

          {/* CTA */}
          <CTA onChatOpen={openChat} />
        </>
      ) : (
        <ToolPage onChatOpen={openChat} tool={page} />
      )}

      {/* Footer */}
      <Footer />

      {/* Chat sidebar */}
      <ChatSidebar isOpen={isChatOpen} onClose={closeChat} />
    </div>
    </AuthProvider>
  )
}

export default App
