import { useState, useEffect, useRef } from 'react'
import Navigation from './components/Navigation'
import ProfileModal from './components/ProfileModal'
import WelcomeModal from './components/WelcomeModal'
import Footer from './components/Footer'
import SimulatorShortcut from './components/SimulatorShortcut'
import FeedbackDigest from './components/FeedbackDigest'
import UnansweredNudge from './components/UnansweredNudge'
import VideoAnalysisRoom from './pages/VideoAnalysisRoom'
import QACommunity from './pages/QACommunity'
import PracticeRoom from './pages/PracticeRoom'
import { getSession, heartbeat } from './utils/auth'

const HEARTBEAT_MS = 30 * 1000

export default function App() {
  const [currentPage, setCurrentPage] = useState('analysis')
  const [showProfile, setShowProfile] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [jumpWeek, setJumpWeek] = useState(null)
  const [practiceInitialFilter, setPracticeInitialFilter] = useState(null)
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

  const handleJumpToWeek = (week) => {
    setJumpWeek(week)
    setCurrentPage('analysis')
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'analysis':
        return <VideoAnalysisRoom jumpWeek={jumpWeek} onJumpConsumed={() => setJumpWeek(null)} />
      case 'qa':
        return <QACommunity author={author} onLogout={() => setSession(null)} />
      case 'practice':
        return (
          <PracticeRoom
            initialScriptFilter={practiceInitialFilter}
            onInitialFilterConsumed={() => setPracticeInitialFilter(null)}
          />
        )
      default:
        return <VideoAnalysisRoom jumpWeek={jumpWeek} onJumpConsumed={() => setJumpWeek(null)} />
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
        onOpenFeedback={() => setShowFeedback(true)}
      />
      {/* key를 바꿔 페이지가 바뀔 때마다 등장 모션이 다시 돈다 */}
      <main key={currentPage} className="anim-rise flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        {renderPage()}
      </main>
      <Footer />
      <SimulatorShortcut raised={currentPage === 'qa'} />

      <UnansweredNudge
        author={author}
        onGoToPractice={() => { setCurrentPage('practice'); setPracticeInitialFilter('unwritten') }}
      />

      {showProfile && (
        <ProfileModal
          author={author}
          onLoggedOut={() => { setShowProfile(false); setSession(null) }}
          onClose={() => setShowProfile(false)}
        />
      )}

      {showFeedback && (
        <FeedbackDigest
          onJumpToWeek={handleJumpToWeek}
          onClose={() => setShowFeedback(false)}
        />
      )}
    </div>
  )
}
