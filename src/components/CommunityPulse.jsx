import { useState, useEffect, useRef } from 'react'
import { Flame, PartyPopper } from 'lucide-react'
import { supabase, supabaseConfigured } from '../utils/supabase'

const CHANNEL_NAME = 'community-pulse'
const TOAST_DURATION_MS = 6000
const CHEER_LIFETIME_MS = 2600
const CHEER_COOLDOWN_MS = 1500 // 너무 연타하면 스팸이라 살짝 텀을 둔다

const CHEER_MESSAGES = [
  '화이팅!', '12기짱!', '할 수 있다!!', '레전드 12기 🔥', '오늘도 화이팅💪',
  '가보자고!', '최고예요!', '멋져요✨', '잘하고 있어요', '이 악물고 GO',
  '오늘도 성장 중', '박수👏👏', '기세 살아있다', '끝까지 가보자', '우리가 최강',
  '한 걸음 더!', '완전 잘함', '역시 12기', '발표력 폭발!', '지금 감 좋다',
  '목소리 좋다!', '흐름 탔다!', '텐션 올려!', '여기서 한 방!', '말맛 살아있다',
  '자신감 장착', '집중력 최고', '오늘 찢었다', '대답 깔끔!', '논리 탄탄!',
  '표정 좋고!', '호흡 좋고!', '시선 처리 굿', '끝맺음 완벽', '질문 와도 OK',
  '멘탈 단단!', '연습은 배신 안 함', '어제보다 낫다', '지금이 성장 타이밍', '실전 감각 ON',
  '마이크 잡자!', '무대 체질!', '말문 열렸다', '전달력 미쳤다', '자연스럽다!',
  '계속 밀어붙여!', '핵심 콕!',
  '리듬 좋다', '속도 딱 좋아', '여유 생겼다', '자세 좋다', '눈빛 살아있다',
  '진짜 늘었다', '포기 금지!', '기록이 쌓인다', '분위기 좋다', '완주 가자!',
  '12기 에너지!', '성장 곡선 상승', '자신 있게!', '깔끔하게 마무리!', '대본보다 자연스럽게',
  '오늘도 레벨업', '실수해도 계속!', '다시 하면 된다', '감 잡았다!', '좋은 질문!',
  '답변 센스 굿', '첫 문장 좋다', '근거 좋다', '사례 좋다', '요약 좋다',
  '임팩트 있다', '몰입감 좋다', '듣기 편하다', '설득력 있다', '한 번 더 가자',
  '지금 페이스 굿', '마지막까지 집중', '배운 거 바로 적용', '오늘의 MVP감', '박자 탔다!',
  '차분하게 GO', '에너지 충전!', '두려움보다 실행', '연습량이 실력', '결국 해낸다',
  '오늘도 전진', '말이 정리된다', '발성이 또렷해', '질문 대응 좋다',
  '자기소개 빛난다', '핵심 먼저!', '결론 선명!', '시간 관리 굿', '실전처럼!',
  '응원 도착!', '좋은 흐름!', '끝까지 밀자!', '지금 그대로!',
]

const CONFETTI_COLORS = ['#E5253A', '#FF9A3D', '#FFD166', '#4DD0E1', '#9575CD', '#81C784']
const CONFETTI_COUNT = 14

function randomKey() {
  return Math.random().toString(36).slice(2)
}

function makeConfettiBurst() {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => {
    const angle = Math.random() * Math.PI * 2
    const distance = 40 + Math.random() * 60
    return {
      id: `${Date.now()}-${i}`,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance - 30, // 살짝 위쪽으로 편향되게
      rot: Math.random() * 360 - 180,
    }
  })
}

// 접속자 수는 Supabase Realtime Presence로 진짜 실시간으로 잡는다 (DB 폴링이 아니라
// 소켓 연결 자체가 곧 "지금 접속 중"이라는 신호). 응원 버튼은 같은 채널에 브로드캐스트로
// 보내서, 나를 포함한 지금 접속한 모두의 화면에 동시에 리액션이 떠오른다.
export default function CommunityPulse({ author, raised = false }) {
  const [onlineCount, setOnlineCount] = useState(0)
  const [toastVisible, setToastVisible] = useState(false)
  const [toastClosing, setToastClosing] = useState(false)
  const [cheers, setCheers] = useState([])
  const [confetti, setConfetti] = useState([])
  const channelRef = useRef(null)
  const toastTimerRef = useRef(null)
  const lastCountRef = useRef(0)
  const lastCheerAtRef = useRef(0)

  useEffect(() => {
    if (!supabaseConfigured || !author) return
    const channel = supabase.channel(CHANNEL_NAME, {
      config: {
        presence: { key: randomKey() },
        broadcast: { self: true },
      },
    })
    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        const count = Object.keys(channel.presenceState()).length
        setOnlineCount(count)
        if (count !== lastCountRef.current) {
          lastCountRef.current = count
          showToast()
        }
      })
      .on('broadcast', { event: 'cheer' }, ({ payload }) => {
        spawnCheer(payload.text)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ author, at: Date.now() })
        }
      })

    return () => {
      clearTimeout(toastTimerRef.current)
      channel.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author])

  const showToast = () => {
    setToastClosing(false)
    setToastVisible(true)
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(handleCloseToast, TOAST_DURATION_MS)
  }

  const handleCloseToast = () => {
    setToastClosing(true)
    setTimeout(() => setToastVisible(false), 300)
  }

  const spawnCheer = (text) => {
    const id = randomKey()
    const leftPercent = 30 + Math.random() * 40 // 화면 중앙 부근에서만 태어나게
    setCheers((prev) => [...prev, { id, text, left: leftPercent }])
    setTimeout(() => {
      setCheers((prev) => prev.filter((c) => c.id !== id))
    }, CHEER_LIFETIME_MS)
  }

  const sendCheer = () => {
    const now = Date.now()
    if (now - lastCheerAtRef.current < CHEER_COOLDOWN_MS) return
    lastCheerAtRef.current = now
    const text = CHEER_MESSAGES[Math.floor(Math.random() * CHEER_MESSAGES.length)]
    channelRef.current?.send({ type: 'broadcast', event: 'cheer', payload: { text, author } })
    // 축포는 브로드캐스트 없이 누른 사람 화면에서만 작게 터뜨린다 (모두에게 쏘면 정신없어서)
    const burstId = randomKey()
    const particles = makeConfettiBurst()
    setConfetti((prev) => [...prev, { id: burstId, particles }])
    setTimeout(() => {
      setConfetti((prev) => prev.filter((b) => b.id !== burstId))
    }, 900)
  }

  if (!supabaseConfigured) return null

  return (
    <>
      {/* 실시간 접속자 토스트 — flex로 가운데 정렬해서, 버튼 폭이나 조상 요소 상태와
          상관없이 항상 화면 정중앙에 뜨게 한다 */}
      {toastVisible && (
        <div className="fixed inset-x-0 bottom-24 md:bottom-8 z-40 flex justify-center px-4 pointer-events-none">
          <button
            onClick={handleCloseToast}
            className={`pointer-events-auto anim-rise flex items-center gap-2 bg-surface/95 backdrop-blur border border-brand/30 shadow-floating text-sm font-bold text-gray-100 px-4 py-2.5 rounded-full whitespace-nowrap transition-opacity duration-300 ${
              toastClosing ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <Flame size={15} className="text-brand" />
            지금 실시간 {onlineCount}명이 불태우는 중이에요
          </button>
        </div>
      )}

      {/* 응원 리액션이 떠오르는 자리 — 화면 전체를 덮되 클릭은 통과시킨다 */}
      <div className="fixed inset-0 z-30 pointer-events-none overflow-hidden">
        {cheers.map((c) => (
          <span
            key={c.id}
            className="anim-float-up absolute bottom-24 md:bottom-16 text-base font-extrabold text-brand drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] whitespace-nowrap"
            style={{ left: `${c.left}%` }}
          >
            {c.text}
          </span>
        ))}
      </div>

      {/* 응원 보내기 버튼 — 시뮬레이터 바로가기 바로 위, 적당한 간격을 두고 쌓는다.
          둘 다 빨간 계열이면 붙여놨을 때 구분이 안 가서, 응원 버튼은 앰버색으로 차별화한다 */}
      <div
        className={`fixed ${raised ? 'bottom-60' : 'bottom-40'} md:bottom-44 right-4 md:right-8 z-20`}
      >
        <button
          onClick={sendCheer}
          title="응원 보내기"
          className="shine anim-pop relative flex items-center justify-center gap-1.5 bg-surface/95 backdrop-blur border border-amber-400/40 hover:border-amber-400 hover:bg-amber-500 text-amber-400 hover:text-white font-bold w-12 h-12 md:w-auto md:h-auto md:pl-3.5 md:pr-4 md:py-2.5 rounded-full shadow-floating transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <PartyPopper size={16} className="shrink-0" />
          <span className="hidden md:inline text-xs whitespace-nowrap">응원 보내기</span>

          {/* 축포 — 버튼 중앙에서 작은 색종이 조각들이 터져 나간다 */}
          {confetti.map((burst) => (
            <span key={burst.id} className="absolute inset-0 pointer-events-none">
              {burst.particles.map((p) => (
                <span
                  key={p.id}
                  className="anim-confetti absolute top-1/2 left-1/2 rounded-sm"
                  style={{
                    width: 5,
                    height: 5,
                    marginTop: -2.5,
                    marginLeft: -2.5,
                    backgroundColor: p.color,
                    '--dx': `${p.dx}px`,
                    '--dy': `${p.dy}px`,
                    '--rot': `${p.rot}deg`,
                  }}
                />
              ))}
            </span>
          ))}
        </button>
      </div>
    </>
  )
}
