import { useState, useEffect, useRef } from 'react'
import Navigation from './components/Navigation'
import ProfileModal from './components/ProfileModal'
import WelcomeModal from './components/WelcomeModal'
import Footer from './components/Footer'
import SimulatorShortcut from './components/SimulatorShortcut'
import VideoAnalysisRoom from './pages/VideoAnalysisRoom'
import QACommunity from './pages/QACommunity'
import PracticeRoom from './pages/PracticeRoom'
import { getSession, heartbeat } from './utils/auth'

const HEARTBEAT_MS = 30 * 1000

export default function App() {
  const [currentPage, setCurrentPage] = useState('analysis')
  const [pendingDraft, setPendingDraft] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const [session, setSession] = useState(() => getSession())
  const [checkingSession, setCheckingSession] = useState(true)
  const author = session?.name || ''
  const sessionRef = useRef(session)
  sessionRef.current = session

  useEffect(() => {
    let cancelled = false
    if (!getSession()) {
      setCheckingSession(false)
      return
    }
    heartbeat().then((alive) => {
      if (cancelled) return
      if (!alive) setSession(null)
      setCheckingSession(false)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const timer = setInterval(async () => {
      if (!sessionRef.current) return
      const alive = await heartbeat()
      if (!alive) {
        setSession(null)
        alert('다른 기기에서 로그인되어 자동으로 로그아웃되었습니다.')
      }
    }, HEARTBEAT_MS)
    return () => clearInterval(timer)
  }, [])

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
            onLogout={() => setSession(null)}
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

  if (checkingSession) {
    return <div className="min-h-screen bg-toss-bg" />
  }

  if (!session) {
    return (
      <WelcomeModal
        onComplete={(name) => setSession(getSession() || { name })}
      />
    )
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
      <SimulatorShortcut />

      {showProfile && (
        <ProfileModal
          author={author}
          onLoggedOut={() => { setShowProfile(false); setSession(null) }}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  )
}
