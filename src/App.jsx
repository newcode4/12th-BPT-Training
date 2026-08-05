import { useState } from 'react'
import Navigation from './components/Navigation'
import ProfileModal from './components/ProfileModal'
import WelcomeModal from './components/WelcomeModal'
import Footer from './components/Footer'
import VideoAnalysisRoom from './pages/VideoAnalysisRoom'
import QACommunity from './pages/QACommunity'
import PracticeRoom from './pages/PracticeRoom'

export default function App() {
  const [currentPage, setCurrentPage] = useState('analysis')
  const [pendingDraft, setPendingDraft] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const [author, setAuthor] = useState(() => localStorage.getItem('qa-author') || '')
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem('qa-author'))

  const handleAskQuestion = (draft) => {
    setPendingDraft(draft)
    setCurrentPage('qa')
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'analysis':
        return <VideoAnalysisRoom onAskQuestion={handleAskQuestion} />
      case 'qa':
        return (
          <QACommunity
            author={author}
            onAuthorChange={setAuthor}
            pendingDraft={pendingDraft}
            onDraftConsumed={() => setPendingDraft(null)}
          />
        )
      case 'practice':
        return <PracticeRoom />
      default:
        return <VideoAnalysisRoom onAskQuestion={handleAskQuestion} />
    }
  }

  return (
    <div className="min-h-screen bg-toss-bg flex flex-col">
      <Navigation
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        onOpenProfile={() => setShowProfile(true)}
      />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        {renderPage()}
      </main>
      <Footer />

      {showWelcome && (
        <WelcomeModal
          onComplete={(name) => {
            setAuthor(name)
            setShowWelcome(false)
          }}
        />
      )}

      {showProfile && (
        <ProfileModal
          onClose={(name) => {
            if (name) setAuthor(name)
            setShowProfile(false)
          }}
        />
      )}
    </div>
  )
}
