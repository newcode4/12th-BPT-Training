import { useState, useEffect } from 'react'
import { X, Users, LogIn, CalendarCheck2, MessageSquareText, Circle, Zap, Bookmark } from 'lucide-react'
import { supabase } from '../utils/supabase'
import { listRecords } from '../utils/cloudStore'
import { ROSTER } from '../utils/auth'

const STALE_MS = 5 * 60 * 1000 // sessions.js와 동일한 "지금 접속 중" 기준

function dateKeyOf(iso) {
  // 로그인 시각을 "그 사람이 접속한 하루"로 셀 때는 로컬 날짜 기준이 맞다
  return new Date(iso).toLocaleDateString('ko-KR')
}

// 관리자 전용 — 학생별 로그인 횟수, 출석 일수, 지금 접속 중인지, 댓글(답변) 작성 수를 한눈에 본다.
export default function AdminDashboard({ onClose }) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const staleBefore = new Date(Date.now() - STALE_MS).toISOString()
        const [loginEvents, sessionsRes, answersRes, questionsRes, analysisRecords] = await Promise.all([
          listRecords('login_event'),
          supabase.from('sessions').select('name, last_seen').gte('last_seen', staleBefore),
          supabase.from('answers').select('author'),
          supabase.from('questions').select('author, category').eq('category', 'unexpected'),
          listRecords('analysis'),
        ])
        if (cancelled) return

        const onlineNames = new Set((sessionsRes.data || []).map((s) => s.name))

        const loginCountByName = {}
        const attendanceDaysByName = {}
        for (const ev of loginEvents) {
          if (!ev.name) continue
          loginCountByName[ev.name] = (loginCountByName[ev.name] || 0) + 1
          attendanceDaysByName[ev.name] = attendanceDaysByName[ev.name] || new Set()
          attendanceDaysByName[ev.name].add(dateKeyOf(ev.at))
        }

        const commentCountByName = {}
        for (const a of answersRes.data || []) {
          if (!a.author) continue
          commentCountByName[a.author] = (commentCountByName[a.author] || 0) + 1
        }

        const unexpectedCountByName = {}
        for (const q of questionsRes.data || []) {
          if (!q.author) continue
          unexpectedCountByName[q.author] = (unexpectedCountByName[q.author] || 0) + 1
        }

        // 스크랩은 시뮬레이션(analysis) 레코드 안에 배열로 들어있어서, 학생별로 다 더한다 —
        // 영상만 걸어두고 실제로는 스크랩(복습 메모)을 안 남기는 학생을 가려낼 수 있다
        const scrapCountByName = {}
        for (const a of analysisRecords) {
          if (!a.author) continue
          scrapCountByName[a.author] = (scrapCountByName[a.author] || 0) + (a.scraps?.length || 0)
        }

        const built = ROSTER.map((name) => ({
          name,
          online: onlineNames.has(name),
          loginCount: loginCountByName[name] || 0,
          attendanceDays: attendanceDaysByName[name]?.size || 0,
          commentCount: commentCountByName[name] || 0,
          unexpectedCount: unexpectedCountByName[name] || 0,
          scrapCount: scrapCountByName[name] || 0,
        })).sort((a, b) => {
          if (a.online !== b.online) return a.online ? -1 : 1
          return b.loginCount - a.loginCount
        })

        setRows(built)
        setLoading(false)
      } catch (e) {
        if (cancelled) return
        setError(e.message || '불러오기에 실패했어요.')
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const onlineCount = rows.filter((r) => r.online).length

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="anim-modal bg-surface rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-white/10">
        <div className="flex items-center justify-between p-4 md:p-6 pb-3 border-b border-white/10">
          <h3 className="flex items-center gap-2 text-base md:text-lg font-extrabold">
            <Users size={18} className="text-brand" />
            학생 활동 대시보드
            <span className="text-xs font-bold text-emerald-400">(지금 {onlineCount}명 접속 중)</span>
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 md:p-6 pt-3">
          {loading && <p className="text-sm text-gray-500 text-center py-8">불러오는 중...</p>}
          {error && <p className="text-sm text-red-400 text-center py-8">{error}</p>}

          {!loading && !error && (
            <div className="space-y-1.5">
              <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-3 px-3 text-[11px] font-bold text-gray-500">
                <span>이름</span>
                <span className="w-16 text-center">접속</span>
                <span className="w-20 text-center flex items-center justify-center gap-1"><LogIn size={11} />로그인</span>
                <span className="w-20 text-center flex items-center justify-center gap-1"><CalendarCheck2 size={11} />출석일</span>
                <span className="w-20 text-center flex items-center justify-center gap-1"><MessageSquareText size={11} />댓글</span>
                <span className="w-20 text-center flex items-center justify-center gap-1"><Zap size={11} />돌발질문</span>
                <span className="w-20 text-center flex items-center justify-center gap-1"><Bookmark size={11} />스크랩</span>
              </div>
              {rows.map((r) => (
                <div
                  key={r.name}
                  className="grid grid-cols-2 md:grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-2 md:gap-3 items-center bg-surface-alt rounded-xl px-3 py-2.5"
                >
                  <span className="font-bold text-sm flex items-center gap-1.5 truncate">
                    {r.online && <Circle size={7} className="fill-emerald-400 text-emerald-400 shrink-0" />}
                    {r.name}
                  </span>
                  <span className="md:w-16 text-right md:text-center text-xs font-bold text-gray-400">
                    {r.online ? <span className="text-emerald-400">접속 중</span> : '오프라인'}
                  </span>
                  <span className="md:w-20 text-right md:text-center text-sm font-bold text-gray-200">{r.loginCount}회</span>
                  <span className="md:w-20 text-right md:text-center text-sm font-bold text-gray-200">{r.attendanceDays}일</span>
                  <span className="md:w-20 text-right md:text-center text-sm font-bold text-gray-200">{r.commentCount}개</span>
                  <span className="md:w-20 text-right md:text-center text-sm font-bold text-gray-200">{r.unexpectedCount}개</span>
                  <span className="md:w-20 text-right md:text-center text-sm font-bold text-gray-200">{r.scrapCount}개</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
