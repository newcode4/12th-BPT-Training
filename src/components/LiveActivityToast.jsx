import { useState, useEffect } from 'react'
import { Flame } from 'lucide-react'
import { supabase, supabaseConfigured } from '../utils/supabase'

const ACTIVE_WINDOW_MS = 5 * 60 * 1000 // 5분 안에 접속 기록이 있으면 "지금 활동 중"으로 친다
const FIRST_SHOW_DELAY_MS = 8000
const SHOW_DURATION_MS = 7000
const REPEAT_INTERVAL_MS = 5 * 60 * 1000 // 너무 자주 뜨면 스팸이라 5분에 한 번 정도만

const MESSAGES = [
  (n) => `지금 ${n}명이 불태우는 중이에요`,
  (n) => `${n}명이 함께 훈련하고 있어요`,
  (n) => `${n}명이 실전 감각을 키우는 중`,
  (n) => `${n}명이 오늘도 열공 중이에요`,
]

// 지금 몇 명이나 접속해서 연습 중인지, 하단에 잔잔하게 보여주는 동기부여용 토스트.
// 계속 떠 있으면 거슬리니 잠깐 나타났다 스스로 사라지고, 5분에 한 번 정도만 다시 뜬다.
export default function LiveActivityToast() {
  const [message, setMessage] = useState('')
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)

  const tryShow = async () => {
    if (!supabaseConfigured) return
    const staleBefore = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString()
    const { count, error } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .gte('last_seen', staleBefore)
    if (error || !count || count < 1) return
    const pick = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
    setMessage(pick(count))
    setClosing(false)
    setVisible(true)
  }

  useEffect(() => {
    const firstTimer = setTimeout(tryShow, FIRST_SHOW_DELAY_MS)
    const interval = setInterval(tryShow, REPEAT_INTERVAL_MS)
    return () => { clearTimeout(firstTimer); clearInterval(interval) }
  }, [])

  useEffect(() => {
    if (!visible) return
    const t = setTimeout(handleClose, SHOW_DURATION_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const handleClose = () => {
    setClosing(true)
    setTimeout(() => setVisible(false), 300)
  }

  if (!visible) return null

  return (
    <div
      className={`anim-rise fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-40 transition-opacity duration-300 ${
        closing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <button
        onClick={handleClose}
        className="flex items-center gap-2 bg-surface/95 backdrop-blur border border-brand/30 shadow-floating text-sm font-bold text-gray-100 px-4 py-2.5 rounded-full whitespace-nowrap"
      >
        <Flame size={15} className="text-brand" />
        {message}
      </button>
    </div>
  )
}
