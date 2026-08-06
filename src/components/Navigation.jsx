import { Video, MessageCircle, PenLine, Trophy, Rocket, User, PartyPopper, Sparkles, PlayCircle } from 'lucide-react'

const navItems = [
  { id: 'analysis', label: '시뮬레이션 분석실', short: '분석실', icon: Video },
  { id: 'qa', label: 'Q&A 커뮤니티', short: 'Q&A', icon: MessageCircle },
  { id: 'practice', label: '돌발 연습실', short: '돌발연습', icon: PenLine },
  { id: 'ranking', label: '랭킹', short: '랭킹', icon: Trophy },
]

const SIMULATOR_URL = 'https://azuremooni.github.io/businesspt-simulator/'

// 새로 생긴 기능이라는 걸 알려주는 작은 빨간 점 — 한 번 눌러보면(App.jsx에서 seen 처리) 사라진다
function NewDot() {
  return (
    <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-brand ring-2 ring-surface" />
  )
}

export default function Navigation({ currentPage, setCurrentPage, onOpenProfile, onOpenFeedback, onOpenGuide, showGuideBadge, showRankingBadge }) {
  return (
    <>
      {/* 상단 바 */}
      <nav className="sticky top-0 z-30 bg-surface/90 backdrop-blur border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setCurrentPage('analysis')}
                title="12기 BPT 성장 커뮤니티"
                className="text-base md:text-xl font-extrabold text-brand shrink-0 tracking-tight hover:opacity-80 transition whitespace-nowrap"
              >
                <span className="sm:hidden">BPT 성장 커뮤니티</span>
                <span className="hidden sm:inline">12기 BPT 성장 커뮤니티</span>
              </button>
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold bg-gradient-to-r from-brand to-orange-500 text-white px-2 sm:px-2.5 py-1 rounded-full whitespace-nowrap overflow-hidden">
                <PartyPopper size={12} className="shrink-0" />
                <span className="hidden sm:inline">레전드 12기 화이팅</span>
                <span className="sm:hidden">12기</span>
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <div className="hidden md:flex gap-1 mr-1">
                {navItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      onClick={() => setCurrentPage(item.id)}
                      title={item.label}
                      className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all duration-300 active:scale-95 whitespace-nowrap ${
                        currentPage === item.id
                          ? 'bg-brand text-white shadow-floating scale-105'
                          : 'text-gray-400 hover:bg-white/10 hover:text-gray-100'
                      }`}
                    >
                      <Icon size={16} />
                      {item.short}
                      {item.id === 'ranking' && showRankingBadge && <NewDot />}
                    </button>
                  )
                })}
              </div>

              <a
                href={SIMULATOR_URL}
                target="_blank"
                rel="noopener noreferrer"
                title="시뮬레이션 바로가기"
                className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-alt hover:bg-brand-light text-gray-400 hover:text-brand transition"
              >
                <Rocket size={17} />
              </a>
              <button
                onClick={onOpenGuide}
                title="시뮬레이션 활용법 (안내 영상)"
                className="relative w-9 h-9 flex items-center justify-center rounded-full bg-surface-alt hover:bg-brand-light text-gray-400 hover:text-brand transition"
              >
                <PlayCircle size={17} />
                {showGuideBadge && <NewDot />}
              </button>
              <button
                onClick={onOpenFeedback}
                title="피드백 모음"
                className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-alt hover:bg-brand-light text-gray-400 hover:text-brand transition"
              >
                <Sparkles size={17} />
              </button>
              <button
                onClick={onOpenProfile}
                title="내 프로필"
                className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-alt hover:bg-brand-light text-gray-400 hover:text-brand transition"
              >
                <User size={17} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 모바일 하단 탭바 */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-white/10 grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-bold transition active:scale-90 ${
                currentPage === item.id ? 'text-brand' : 'text-gray-500'
              }`}
            >
              {currentPage === item.id && (
                <span className="anim-fade absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-brand shadow-floating" />
              )}
              <span className="relative">
                <Icon
                  size={20}
                  className={`transition-transform duration-300 ${
                    currentPage === item.id ? 'scale-110 -translate-y-0.5' : ''
                  }`}
                />
                {item.id === 'ranking' && showRankingBadge && <NewDot />}
              </span>
              <span className="whitespace-nowrap">{item.short}</span>
            </button>
          )
        })}
      </nav>

    </>
  )
}
