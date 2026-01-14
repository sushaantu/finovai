import { useState } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Journey from './components/Journey'
import Features from './components/Features'
import FinancialIndex from './components/FinancialIndex'
import FAQ from './components/FAQ'
import CTA from './components/CTA'
import Footer from './components/Footer'
import ChatBot from './components/ChatBot'

function App() {
  const [isChatOpen, setIsChatOpen] = useState(false)

  const openChat = () => setIsChatOpen(true)
  const closeChat = () => setIsChatOpen(false)

  return (
    <div className="min-h-screen bg-stone-950">
      {/* Navigation */}
      <Navbar onChatOpen={openChat} />

      {/* Hero with background image */}
      <Hero onChatOpen={openChat} />

      {/* Journey - How it works */}
      <Journey />

      {/* Features grid */}
      <Features />

      {/* Financial Index Quiz */}
      <FinancialIndex />

      {/* FAQ */}
      <FAQ />

      {/* CTA */}
      <CTA onChatOpen={openChat} />

      {/* Footer */}
      <Footer />

      {/* Chat modal */}
      <ChatBot isOpen={isChatOpen} onClose={closeChat} />
    </div>
  )
}

export default App
