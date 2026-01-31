import { useState } from 'react'
import { AuthProvider } from './hooks/useAuth'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Journey from './components/Journey'
import Features from './components/Features'
import FAQ from './components/FAQ'
import CTA from './components/CTA'
import Footer from './components/Footer'
import { ChatSidebar } from './components/chat'

function App() {
  const [isChatOpen, setIsChatOpen] = useState(false)

  const openChat = () => setIsChatOpen(true)
  const closeChat = () => setIsChatOpen(false)

  return (
    <AuthProvider>
    <div className="min-h-screen bg-[--color-bg]">
      {/* Navigation */}
      <Navbar onChatOpen={openChat} />

      {/* Hero with background image */}
      <Hero onChatOpen={openChat} />

      {/* Journey - How it works */}
      <Journey />

      {/* Features grid */}
      <Features />

      {/* FAQ */}
      <FAQ />

      {/* CTA */}
      <CTA onChatOpen={openChat} />

      {/* Footer */}
      <Footer />

      {/* Chat sidebar */}
      <ChatSidebar isOpen={isChatOpen} onClose={closeChat} />
    </div>
    </AuthProvider>
  )
}

export default App
