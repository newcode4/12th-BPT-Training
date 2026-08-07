import { useState, useEffect, useRef } from 'react'
import Navigation from './components/Navigation'
import ProfileModal from './components/ProfileModal'
import WelcomeModal from './components/WelcomeModal'
import Footer from './components/Footer'
import SimulatorShortcut from './components/SimulatorShortcut'
import FeedbackDigest from './components/FeedbackDigest'
import UnansweredNudge from './components/UnansweredNudge'
import CommunityPulse from './components/CommunityPulse'
import SimulatorGuideModal from './components/SimulatorGuideModal'
import VideoAnalysisRoom from './pages/VideoAnalysisRoom'
import QACommunity from './pages/QACommunity'
import PracticeRoom from './pages/PracticeRoom'
import RankingPage from './pages/RankingPage'
import { getSession, heartbeat } from './utils/auth'
import { listRecords, putRecord } from './utils/cloudStore'
import { generateUUID } from './utils/formatters'

const HEARTBEAT_MS = 30 * 1000

const CURRENT_PAGE_KEY = 'pt-current-page'

export default function App() {
  // 새로고침해도 방금 있던 탭(분석실/Q&A/돌발연습)에 그대로 남아있게 한다.
  // 예전엔 항상 'analysis'로 초기화돼서, Q&A를 보다가 새로고침하면 메인으로 튕겨나갔다.
  const [currentPage, setCurrentPage] = useState(() => sessionStorage.getItem(CURRENT_PAGE_KEY) || 'analysis')
  const [showProfile, setShowProfile] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
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

  useEffect(() => {
    sessionStorage.setItem(CURRENT_PAGE_KEY, currentPage)
  }, [currentPage])

  // 시뮬레이션 활용법 안내 영상 — 계정마다 최초 1번만 자동으로 띄운다.
  // 한 번 닫으면 다시 자동으로는 안 뜨고, 필요하면 상단 가이드 버튼으로 언제든 다시 볼 수 있다.
  useEffect(() => {
    if (!author) return
    const key = `pt-guide-seen-${author}`
    if (localStorage.getItem(key)) return
    const timer = setTimeout(() => setShowGuide(true), 1000)
    return () => clearTimeout(timer)
  }, [author])

  // 새로 생긴 "가이드"/"랭킹"에 빨간 점을 붙여서 눈에 띄게 한다 — 한 번 열어보면 사라진다.
  // pt-guide-seen과는 별개의 키를 쓴다 — pt-guide-seen은 "자동 팝업을 한 번 띄웠는지"만 추적해서,
  // 이 배지 기능이 생기기 전에 이미 안내 영상을 본 사람은 그 키가 이미 true라 배지가 아예 안 뜨는
  // 문제가 있었다. 배지는 배지대로 독립적으로, 이번에 각 버튼을 눌러봤는지만 따진다.
  // localStorage만 갱신하고 끝내면 그 값을 다시 읽어줄 리렌더가 안 일어나서 점이 안 사라지니,
  // 상태로도 같이 들고 있는다.
  const [showGuideBadge, setShowGuideBadge] = useState(false)
  const [showRankingBadge, setShowRankingBadge] = useState(false)

  useEffect(() => {
    if (!author) return
    setShowGuideBadge(!localStorage.getItem(`pt-badge-seen-guide-${author}`))
    setShowRankingBadge(!localStorage.getItem(`pt-badge-seen-ranking-${author}`))
  }, [author])

  // 관리자가 "누가 안내 영상을 봤는지" 확인할 수 있어야 해서, 로컬 저장뿐 아니라 서버에도
  // 한 번만(중복 없이) 기록해둔다. 로컬 플래그는 자동 팝업/배지 제어용으로 계속 따로 쓴다.
  const markGuideSeenOnServer = async () => {
    if (!author) return
    try {
      const existing = await listRecords('guide_seen', { author })
      if (existing.length === 0) {
        await putRecord('guide_seen', { id: generateUUID(), author, seenAt: new Date().toISOString() }, { author })
      }
    } catch (e) {
      console.error('안내 영상 시청 기록 실패', e)
    }
  }

  const closeGuide = () => {
    setShowGuide(false)
    if (author) {
      localStorage.setItem(`pt-guide-seen-${author}`, 'true')
      localStorage.setItem(`pt-badge-seen-guide-${author}`, 'true')
    }
    setShowGuideBadge(false)
    markGuideSeenOnServer()
  }

  useEffect(() => {
    if (currentPage === 'ranking' && author) {
      localStorage.setItem(`pt-badge-seen-ranking-${author}`, 'true')
      setShowRankingBadge(false)
    }
  }, [currentPage, author])

  const handleJumpToWeek = (week) => {
    setJumpWeek(week)
    setCurrentPage('analysis')
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'analysis':
        return <VideoAnalysisRoom jumpWeek={jumpWeek} onJumpConsumed={() => setJumpWeek(null)} onOpenFeedback={() => setShowFeedback(true)} />
      case 'qa':
        return <QACommunity author={author} onLogout={() => { setSession(null); setCurrentPage('analysis') }} />
      case 'practice':
        return (
          <PracticeRoom
            initialScriptFilter={practiceInitialFilter}
            onInitialFilterConsumed={() => setPracticeInitialFilter(null)}
          />
        )
      case 'ranking':
        return <RankingPage author={author} />
      default:
        return <VideoAnalysisRoom jumpWeek={jumpWeek} onJumpConsumed={() => setJumpWeek(null)} onOpenFeedback={() => setShowFeedback(true)} />
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
        onOpenGuide={() => setShowGuide(true)}
        showGuideBadge={showGuideBadge}
        showRankingBadge={showRankingBadge}
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
      <CommunityPulse author={author} raised={currentPage === 'qa'} />

      {showProfile && (
        <ProfileModal
          author={author}
          onLoggedOut={() => { setShowProfile(false); setSession(null); setCurrentPage('analysis') }}
          onClose={() => setShowProfile(false)}
        />
      )}

      {showFeedback && (
        <FeedbackDigest
          onJumpToWeek={handleJumpToWeek}
          onClose={() => setShowFeedback(false)}
        />
      )}

      {showGuide && <SimulatorGuideModal onClose={closeGuide} />}
    </div>
  )
}
