import { useState, useEffect, useMemo } from 'react'
import { X, Users, LogIn, CalendarCheck2, MessageSquareText, Circle, Zap, Bookmark, LayoutGrid, PenLine, PlayCircle, Check, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { supabase } from '../utils/supabase'
import { listRecords } from '../utils/cloudStore'
import { ROSTER } from '../utils/auth'

const STALE_MS = 5 * 60 * 1000 // sessions.js와 동일한 "지금 접속 중" 기준

function dateKeyOf(iso) {
  // 로그인 시각을 "그 사람이 접속한 하루"로 셀 때는 로컬 날짜 기준이 맞다
  return new Date(iso).toLocaleDateString('ko-KR')
}

// 열 이름 → 클릭 시 정렬에 쓸 값 계산 함수. name은 가나다순, 나머지는 숫자 비교.
const SORT_COLUMNS = {
  name: { label: '이름', get: (r) => r.name, type: 'text' },
  online: { label: '접속', get: (r) => (r.online ? 1 : 0), type: 'number' },
  loginCount: { label: '로그인', get: (r) => r.loginCount, type: 'number' },
  attendanceDays: { label: '출석일', get: (r) => r.attendanceDays, type: 'number' },
  commentCount: { label: '댓글', get: (r) => r.commentCount, type: 'number' },
  unexpectedCount: { label: '돌발질문', get: (r) => r.unexpectedCount, type: 'number' },
  scrapCount: { label: '스크랩', get: (r) => r.scrapCount, type: 'number' },
  simCount: { label: '시뮬레이션', get: (r) => r.simCount, type: 'number' },
  simFeedbackCount: { label: '시뮬 피드백', get: (r) => r.simFeedbackCount, type: 'number' },
  guideWatched: { label: '안내영상', get: (r) => (r.guideWatched ? 1 : 0), type: 'number' },
}

function SortHeader({ label, icon, sortKey, current, dir, onSort, align = 'center', className = '' }) {
  const active = current === sortKey
  const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`flex items-center gap-1 whitespace-nowrap hover:text-gray-200 transition ${className} ${
        align === 'left' ? 'justify-start' : 'justify-center'
      } ${active ? 'text-gray-200' : ''}`}
    >
      {icon}
      {label}
      <Icon size={11} className={active ? 'text-brand' : 'text-gray-600'} />
    </button>
  )
}

// 관리자 전용 — 학생별 로그인 횟수, 출석 일수, 지금 접속 중인지, 댓글(답변) 작성 수를 한눈에 본다.
export default function AdminDashboard({ onClose }) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  // 아무것도 안 눌렀을 때 기본 정렬: 접속 중인 사람 먼저, 그다음 로그인 많은 순
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const staleBefore = new Date(Date.now() - STALE_MS).toISOString()
        const [loginEvents, sessionsRes, answersRes, questionsRes, analysisRecords, feedbackRecords, guideSeenRecords] = await Promise.all([
          listRecords('login_event'),
          supabase.from('sessions').select('name, last_seen').gte('last_seen', staleBefore),
          supabase.from('answers').select('author'),
          supabase.from('questions').select('author, category').eq('category', 'unexpected'),
          listRecords('analysis'),
          listRecords('feedback'),
          listRecords('guide_seen'),
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
        // 영상만 걸어두고 실제로는 스크랩(복습 메모)을 안 남기는 학생을 가려낼 수 있다.
        // "내 시뮬레이션 모아보기"에 등록한 유튜브 링크 개수도 같은 레코드에서 센다.
        const scrapCountByName = {}
        const simCountByName = {}
        for (const a of analysisRecords) {
          if (!a.author) continue
          scrapCountByName[a.author] = (scrapCountByName[a.author] || 0) + (a.scraps?.length || 0)
          if (a.source === 'youtube') {
            simCountByName[a.author] = (simCountByName[a.author] || 0) + 1
          }
        }

        // 시뮬레이션 카드 안에서 남긴 피드백만 센다(analysisId가 있는 것) — 인사이트 쪽
        // "피드백 모음"에서 일반적으로 쓴 피드백까지 섞으면 "거기서 쓴 것"이 아니게 된다
        const simFeedbackCountByName = {}
        for (const f of feedbackRecords) {
          if (!f.author || !f.analysisId) continue
          simFeedbackCountByName[f.author] = (simFeedbackCountByName[f.author] || 0) + 1
        }

        const guideWatchedNames = new Set(guideSeenRecords.map((r) => r.author).filter(Boolean))

        const built = ROSTER.map((name) => ({
          name,
          online: onlineNames.has(name),
          loginCount: loginCountByName[name] || 0,
          attendanceDays: attendanceDaysByName[name]?.size || 0,
          commentCount: commentCountByName[name] || 0,
          unexpectedCount: unexpectedCountByName[name] || 0,
          scrapCount: scrapCountByName[name] || 0,
          simCount: simCountByName[name] || 0,
          simFeedbackCount: simFeedbackCountByName[name] || 0,
          guideWatched: guideWatchedNames.has(name),
        }))

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
  const guideWatchedCount = rows.filter((r) => r.guideWatched).length

  const sortedRows = useMemo(() => {
    if (!sortKey) {
      // 기본 정렬: 접속 중인 사람 먼저, 그다음 로그인 많은 순
      return [...rows].sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1
        return b.loginCount - a.loginCount
      })
    }
    const { get, type } = SORT_COLUMNS[sortKey]
    const dirMul = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = get(a)
      const bv = get(b)
      if (type === 'text') return av.localeCompare(bv, 'ko') * dirMul
      return (av - bv) * dirMul
    })
  }, [rows, sortKey, sortDir])

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // 이름은 가나다순(오름차순)이 자연스럽고, 나머지 숫자 지표는 큰 값부터 보는 게 유용하다
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="anim-modal bg-surface rounded-2xl shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col border border-white/10">
        <div className="flex items-center justify-between p-4 md:p-6 pb-3 border-b border-white/10">
          <h3 className="flex items-center gap-2 text-base md:text-lg font-extrabold">
            <Users size={18} className="text-brand" />
            학생 활동 대시보드
            <span className="text-xs font-bold text-emerald-400">(지금 {onlineCount}명 접속 중)</span>
            <span className="text-xs font-bold text-brand">(안내영상 {guideWatchedCount}/{ROSTER.length}명 시청)</span>
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
              {/* 모바일에서는 헤더 그리드가 안 보이니, 정렬 기준을 고를 수 있는 드롭다운을 따로 둔다 */}
              <div className="md:hidden flex items-center gap-2 px-1 pb-1">
                <span className="text-[11px] font-bold text-gray-500">정렬</span>
                <select
                  value={sortKey || 'default'}
                  onChange={(e) => handleSort(e.target.value === 'default' ? null : e.target.value)}
                  className="flex-1 min-w-0 bg-surface-alt border border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none"
                >
                  <option value="default">기본순 (접속 중 → 로그인 많은순)</option>
                  {Object.entries(SORT_COLUMNS).map(([key, col]) => (
                    <option key={key} value={key}>{col.label}</option>
                  ))}
                </select>
                {sortKey && (
                  <button
                    onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                    className="shrink-0 flex items-center gap-1 bg-surface-alt border border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-300"
                  >
                    {sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                    {sortDir === 'asc' ? '오름차순' : '내림차순'}
                  </button>
                )}
              </div>
              {/* 열이 9개라 좁은 화면에서는 줄바꿈되며 깨지므로, 가로 스크롤 컨테이너 안에
                  최소 폭을 고정해서 항상 한 줄로 유지하고 필요하면 옆으로 스크롤하게 한다 */}
              <div className="hidden md:block overflow-x-auto">
              <div className="min-w-[760px]">
              <div className="grid grid-cols-[96px_60px_68px_68px_64px_76px_68px_88px_88px_68px] gap-2 px-3 text-[11px] font-bold text-gray-500">
                <SortHeader label="이름" sortKey="name" align="left" current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHeader label="접속" sortKey="online" onSort={handleSort} current={sortKey} dir={sortDir} />
                <SortHeader label="로그인" icon={<LogIn size={11} />} sortKey="loginCount" onSort={handleSort} current={sortKey} dir={sortDir} />
                <SortHeader label="출석일" icon={<CalendarCheck2 size={11} />} sortKey="attendanceDays" onSort={handleSort} current={sortKey} dir={sortDir} />
                <SortHeader label="댓글" icon={<MessageSquareText size={11} />} sortKey="commentCount" onSort={handleSort} current={sortKey} dir={sortDir} />
                <SortHeader label="돌발질문" icon={<Zap size={11} />} sortKey="unexpectedCount" onSort={handleSort} current={sortKey} dir={sortDir} />
                <SortHeader label="스크랩" icon={<Bookmark size={11} />} sortKey="scrapCount" onSort={handleSort} current={sortKey} dir={sortDir} />
                <SortHeader label="시뮬레이션" icon={<LayoutGrid size={11} />} sortKey="simCount" onSort={handleSort} current={sortKey} dir={sortDir} />
                <SortHeader label="시뮬 피드백" icon={<PenLine size={11} />} sortKey="simFeedbackCount" onSort={handleSort} current={sortKey} dir={sortDir} />
                <SortHeader label="안내영상" icon={<PlayCircle size={11} />} sortKey="guideWatched" onSort={handleSort} current={sortKey} dir={sortDir} />
              </div>
              <div className="space-y-1.5 mt-1.5">
              {sortedRows.map((r) => (
                <div
                  key={r.name}
                  className="grid grid-cols-[96px_60px_68px_68px_64px_76px_68px_88px_88px_68px] gap-2 items-center bg-surface-alt rounded-xl px-3 py-2.5"
                >
                  <span className="font-bold text-sm flex items-center gap-1.5 truncate">
                    {r.online && <Circle size={7} className="fill-emerald-400 text-emerald-400 shrink-0" />}
                    {r.name}
                  </span>
                  <span className="text-center text-xs font-bold text-gray-400">
                    {r.online ? <span className="text-emerald-400">접속 중</span> : '오프라인'}
                  </span>
                  <span className="text-center text-sm font-bold text-gray-200">{r.loginCount}회</span>
                  <span className="text-center text-sm font-bold text-gray-200">{r.attendanceDays}일</span>
                  <span className="text-center text-sm font-bold text-gray-200">{r.commentCount}개</span>
                  <span className="text-center text-sm font-bold text-gray-200">{r.unexpectedCount}개</span>
                  <span className="text-center text-sm font-bold text-gray-200">{r.scrapCount}개</span>
                  <span className="text-center text-sm font-bold text-gray-200">{r.simCount}개</span>
                  <span className="text-center text-sm font-bold text-gray-200">{r.simFeedbackCount}개</span>
                  <span className="flex items-center justify-center">
                    {r.guideWatched
                      ? <Check size={15} className="text-emerald-400" />
                      : <span className="text-gray-600">—</span>}
                  </span>
                </div>
              ))}
              </div>
              </div>
              </div>

              {/* 모바일: 가로 그리드 대신 이름당 카드 하나에 라벨을 붙여 세로로 보여준다 */}
              <div className="md:hidden space-y-2">
                {sortedRows.map((r) => (
                  <div key={r.name} className="bg-surface-alt rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm flex items-center gap-1.5">
                        {r.online && <Circle size={7} className="fill-emerald-400 text-emerald-400 shrink-0" />}
                        {r.name}
                      </span>
                      <span className="text-xs font-bold text-gray-400">
                        {r.online ? <span className="text-emerald-400">접속 중</span> : '오프라인'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div><p className="text-[10px] text-gray-500">로그인</p><p className="text-sm font-bold text-gray-200">{r.loginCount}회</p></div>
                      <div><p className="text-[10px] text-gray-500">출석일</p><p className="text-sm font-bold text-gray-200">{r.attendanceDays}일</p></div>
                      <div><p className="text-[10px] text-gray-500">댓글</p><p className="text-sm font-bold text-gray-200">{r.commentCount}개</p></div>
                      <div><p className="text-[10px] text-gray-500">돌발질문</p><p className="text-sm font-bold text-gray-200">{r.unexpectedCount}개</p></div>
                      <div><p className="text-[10px] text-gray-500">스크랩</p><p className="text-sm font-bold text-gray-200">{r.scrapCount}개</p></div>
                      <div><p className="text-[10px] text-gray-500">시뮬레이션</p><p className="text-sm font-bold text-gray-200">{r.simCount}개</p></div>
                      <div><p className="text-[10px] text-gray-500">시뮬 피드백</p><p className="text-sm font-bold text-gray-200">{r.simFeedbackCount}개</p></div>
                      <div>
                        <p className="text-[10px] text-gray-500">안내영상</p>
                        <p className="text-sm font-bold text-gray-200">
                          {r.guideWatched ? <Check size={15} className="text-emerald-400 mx-auto" /> : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
