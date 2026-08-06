import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, PenLine, Trophy } from 'lucide-react'
import { supabase, supabaseConfigured } from '../utils/supabase'
import { listRecords } from '../utils/cloudStore'
import { ROSTER } from '../utils/auth'

const NUDGE_INTERVAL_MS = 30 * 60 * 1000 // 매번 뜨면 스팸이라 최소 30분 간격을 둔다
const CHECK_DELAY_MS = 1500 // 페이지 들어오자마자 뜨면 정신없으니 살짝 늦춘다

function storageKey(author) {
  return `pt-unanswered-nudge-${author}`
}

function readState(author) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(author))) || {}
  } catch {
    return {}
  }
}

function writeState(author, state) {
  localStorage.setItem(storageKey(author), JSON.stringify(state))
}

// 어느 페이지에 있든(메인 화면 포함) 아직 안 쓴 돌발질문이 있으면 한 번씩 알려준다.
// 페이지를 옮길 때마다 새로 뜨지 않도록 App 최상단에 한 번만 마운트해서 쓴다.
export default function UnansweredNudge({ author, onGoToPractice }) {
  const [count, setCount] = useState(0)
  const [visible, setVisible] = useState(false)
  const [percent, setPercent] = useState(null)
  const [rank, setRank] = useState(null)

  // 개발 모드(StrictMode)는 effect를 mount→cleanup→mount로 두 번 돌린다.
  // "한 번만 실행" 표시를 타이머 예약 전에 남기면, 첫 mount의 cleanup이 타이머를
  // 지운 뒤 두 번째 mount가 그 표시 때문에 아예 다시 예약을 못 하는 문제가 생긴다.
  // 그래서 별도 ref 없이 cancelled 플래그로만 취소를 관리한다.
  useEffect(() => {
    if (!author || !supabaseConfigured) return
    let cancelled = false

    const timer = setTimeout(async () => {
      if (cancelled) return
      try {
        // 랭킹 계산까지 하려면 전체 학생의 스크립트가 다 필요해서, author 없이 통째로 받아온다
        const [{ data: questions }, allScripts] = await Promise.all([
          supabase.from('questions').select('id').eq('category', 'unexpected'),
          listRecords('script'),
        ])
        if (cancelled) return

        const total = (questions || []).length
        const writtenByAuthor = {}
        for (const s of allScripts) {
          if (!s.text?.trim() || !s.author) continue
          writtenByAuthor[s.author] = writtenByAuthor[s.author] || new Set()
          writtenByAuthor[s.author].add(s.questionId)
        }

        const myWritten = writtenByAuthor[author]?.size || 0
        const unwritten = Math.max(0, total - myWritten)
        if (unwritten === 0) return

        const state = readState(author)
        const now = Date.now()
        if (state.hideUntil && now < state.hideUntil) return
        if (state.lastShown && now - state.lastShown < NUDGE_INTERVAL_MS) return

        // 등수는 작성한 스크립트 개수로 매긴다 — 동점이면 같은 등수(1,2,2,4식)
        const counts = ROSTER.map((name) => writtenByAuthor[name]?.size || 0).sort((a, b) => b - a)
        const myRank = counts.findIndex((c) => c <= myWritten) + 1

        writeState(author, { ...state, lastShown: now })
        setCount(unwritten)
        setPercent(total > 0 ? Math.round((myWritten / total) * 100) : 0)
        setRank(myRank || null)
        setVisible(true)
      } catch (e) {
        console.error('미답변 알림 확인 실패', e)
      }
    }, CHECK_DELAY_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [author])

  const handleHideToday = () => {
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)
    writeState(author, { ...readState(author), hideUntil: endOfDay.getTime() })
    setVisible(false)
  }

  if (!visible) return null

  return createPortal(
    <div
      className="anim-fade fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={() => setVisible(false)}
    >
      <div
        className="anim-modal bg-surface rounded-2xl shadow-xl w-full max-w-sm p-6 border border-white/10 text-center space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto w-12 h-12 rounded-full bg-brand-light flex items-center justify-center">
          <AlertTriangle size={22} className="text-brand" />
        </div>
        <div>
          <p className="font-extrabold text-lg">돌발을 마스터하면 더 이상 떨리지 않아요</p>
          <p className="text-sm text-gray-400 mt-1">아직 답변하지 않은 돌발질문이 {count}개 있어요</p>
        </div>

        {(percent !== null || rank !== null) && (
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {percent !== null && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-brand bg-brand-light px-2.5 py-1 rounded-full">
                작성률 {percent}%
              </span>
            )}
            {rank !== null && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                <Trophy size={11} />
                내 등수 {rank}위
              </span>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setVisible(false)}
            className="flex-1 bg-white/10 hover:bg-white/15 text-gray-300 font-bold py-2.5 rounded-xl text-sm transition"
          >
            나중에
          </button>
          <button
            onClick={() => { setVisible(false); onGoToPractice?.() }}
            className="flex-1 flex items-center justify-center gap-1.5 bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-xl text-sm transition active:scale-95"
          >
            <PenLine size={14} />
            답변 작성하러 가기
          </button>
        </div>
        <button
          onClick={handleHideToday}
          className="text-[11px] text-gray-600 hover:text-gray-400"
        >
          오늘 하루 보지 않기
        </button>
      </div>
    </div>,
    document.body
  )
}
