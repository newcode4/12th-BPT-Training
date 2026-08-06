import { useState, useEffect, useRef } from 'react'
import { Flame, PartyPopper } from 'lucide-react'
import { supabase, supabaseConfigured } from '../utils/supabase'

const CHANNEL_NAME = 'community-pulse'
const TOAST_DURATION_MS = 6000
const CHEER_LIFETIME_MS = 2600
const CHEER_COOLDOWN_MS = 1500 // 너무 연타하면 스팸이라 살짝 텀을 둔다

const CHEER_MESSAGES = ['화이팅!', '12기짱!', '할 수 있다!!', '레전드 12기 🔥', '오늘도 화이팅💪', '가보자고!']

function randomKey() {
  return Math.random().toString(36).slice(2)
}

// 접속자 수는 Supabase Realtime Presence로 진짜 실시간으로 잡는다 (DB 폴링이 아니라
// 소켓 연결 자체가 곧 "지금 접속 중"이라는 신호). 응원 버튼은 같은 채널에 브로드캐스트로
// 보내서, 나를 포함한 지금 접속한 모두의 화면에 동시에 리액션이 떠오른다.
export default function CommunityPulse({ author }) {
  const [onlineCount, setOnlineCount] = useState(0)
  const [toastVisible, setToastVisible] = useState(false)
  const [toastClosing, setToastClosing] = useState(false)
  const [cheers, setCheers] = useState([])
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

      {/* 응원 보내기 버튼 — 재미 요소, 시뮬레이터 바로가기와 겹치지 않게 반대편(왼쪽)에 둔다 */}
      <button
        onClick={sendCheer}
        title="응원 보내기"
        className="shine anim-pop fixed bottom-20 md:bottom-24 left-4 md:left-8 z-20 flex items-center justify-center gap-1.5 bg-surface/95 backdrop-blur border border-brand/40 hover:border-brand hover:bg-brand text-brand hover:text-white font-bold w-12 h-12 md:w-auto md:h-auto md:pl-3.5 md:pr-4 md:py-2.5 rounded-full shadow-floating transition-all duration-300 hover:scale-105 active:scale-95"
      >
        <PartyPopper size={16} className="shrink-0" />
        <span className="hidden md:inline text-xs whitespace-nowrap">응원 보내기</span>
      </button>
    </>
  )
}
