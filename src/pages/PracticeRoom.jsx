import { useState, useEffect } from 'react'
import { PenLine, Shuffle, AlertTriangle, Loader2, CloudOff, Search, Check, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { getRandomItem } from '../utils/formatters'
import { supabase, supabaseConfigured } from '../utils/supabase'
import { WEEKS } from '../utils/weeks'
import { TOPICS, parseTags } from '../utils/qaTags'
import { listRecords } from '../utils/cloudStore'
import ScriptPracticeModal from '../components/ScriptPracticeModal'

const PAGE_SIZE = 15
const TITLE_CLAMP_THRESHOLD = 60

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-bold transition active:scale-95 ${
        active
          ? 'bg-brand text-white shadow-floating'
          : 'bg-surface-alt text-gray-400 hover:bg-white/10 hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  )
}

export default function PracticeRoom({ initialScriptFilter, onInitialFilterConsumed }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [weekFilter, setWeekFilter] = useState('all')
  const [topicFilter, setTopicFilter] = useState('all')
  const [scriptFilter, setScriptFilter] = useState('all') // 'all' | 'unwritten' | 'written'
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const [weekPickerOpen, setWeekPickerOpen] = useState(false)

  const [practiceQuestion, setPracticeQuestion] = useState(null)
  const [practiceBlind, setPracticeBlind] = useState(false)
  // questionId -> { id, text } (내가 쓴 스크립트만)
  const [scripts, setScripts] = useState({})
  const author = localStorage.getItem('qa-author') || '익명'

  useEffect(() => {
    listRecords('script', { author })
      .then((rows) => {
        const map = {}
        for (const r of rows) if (r.questionId) map[r.questionId] = { id: r.id, text: r.text }
        setScripts(map)
      })
      .catch(e => console.error('스크립트 불러오기 실패', e))
  }, [author])

  // 메인 화면의 미답변 알림 팝업에서 "답변 작성하러 가기"를 누르고 들어온 경우,
  // 미작성 필터를 자동으로 켜준다.
  useEffect(() => {
    if (!initialScriptFilter) return
    setScriptFilter(initialScriptFilter)
    onInitialFilterConsumed?.()
  }, [initialScriptFilter, onInitialFilterConsumed])

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false)
      setLoadError('설정 없음')
      return
    }
    supabase
      .from('questions')
      .select('id, title, content, tags, author, created_at')
      .eq('category', 'unexpected')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setLoadError(error.message)
        else {
          setQuestions((data || []).map(q => {
            const { week, topic } = parseTags(q.tags)
            return { ...q, week, topic }
          }))
        }
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    setPage(1)
  }, [weekFilter, topicFilter, scriptFilter, searchQuery])

  const visible = questions.filter((q) => {
    if (weekFilter !== 'all' && q.week !== weekFilter) return false
    if (topicFilter !== 'all' && q.topic !== topicFilter) return false
    const hasScript = Boolean(scripts[q.id]?.text)
    if (scriptFilter === 'unwritten' && hasScript) return false
    if (scriptFilter === 'written' && !hasScript) return false
    const s = searchQuery.trim().toLowerCase()
    if (s && !q.title.toLowerCase().includes(s)) return false
    return true
  })
  // 아직 원고를 안 쓴 질문을 위로 올려서 뭐부터 연습할지 한눈에 보이게 한다.
  // sort는 안정 정렬이라 같은 그룹 안에서는 최신순이 그대로 유지된다.
  visible.sort((a, b) => {
    const aDone = Boolean(scripts[a.id]?.text)
    const bDone = Boolean(scripts[b.id]?.text)
    if (aDone === bDone) return 0
    return aDone ? 1 : -1
  })

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const pagedVisible = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const usedTopics = TOPICS.filter(t => questions.some(q => q.topic === t))

  const openPractice = (question, blind) => {
    setPracticeQuestion(question)
    setPracticeBlind(blind)
  }

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 목적은 "안 보고 말하기" — 랜덤 뽑기는 항상 블라인드 모드로 연다
  const handleRandom = () => {
    const picked = getRandomItem(visible)
    if (!picked) {
      alert('조건에 맞는 돌발질문이 없어요. 필터를 바꾸거나 Q&A에서 먼저 등록해주세요.')
      return
    }
    openPractice(picked, true)
  }

  const handleRandomWeek = (weekId) => {
    const pool = questions.filter((q) => q.week === weekId)
    const picked = getRandomItem(pool)
    setWeekPickerOpen(false)
    if (!picked) {
      alert(`${WEEKS.find(w => w.id === weekId)?.label || weekId}에는 등록된 돌발질문이 없어요.`)
      return
    }
    openPractice(picked, true)
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6 space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl md:text-2xl font-extrabold mb-1">
            <PenLine size={22} className="text-brand shrink-0" />
            돌발 연습실
          </h2>
          <p className="text-sm text-gray-400">
            Q&A 커뮤니티에 올라온 돌발질문에 어떻게 답할지 스크립트를 써보세요
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => setWeekPickerOpen((o) => !o)}
            className="mx-auto flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-brand transition"
          >
            주차별 랜덤 뽑기
            <ChevronDown size={13} className={`transition-transform ${weekPickerOpen ? 'rotate-180' : ''}`} />
          </button>
          {weekPickerOpen && (
            <div className="anim-pop flex gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
              {WEEKS.map((w) => (
                <button
                  key={w.id}
                  onClick={() => handleRandomWeek(w.id)}
                  className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold bg-surface-alt text-gray-300 hover:bg-brand hover:text-white transition active:scale-95"
                >
                  {w.label}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={handleRandom}
            disabled={loading}
            className="shine relative glow-breathe w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-bold py-4 rounded-xl transition active:scale-95 shadow-floating"
          >
            {loading ? <Loader2 size={17} className="animate-spin" /> : <Shuffle size={17} />}
            랜덤으로 하나 뽑기
          </button>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="질문 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-3 bg-surface-alt border border-white/10 rounded-xl text-base focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
        </div>

        {/* 주차 필터 */}
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
          <Chip active={weekFilter === 'all'} onClick={() => setWeekFilter('all')}>전체 주차</Chip>
          {WEEKS.map((w) => (
            <Chip key={w.id} active={weekFilter === w.id} onClick={() => setWeekFilter(w.id)}>
              {w.label}
            </Chip>
          ))}
        </div>

        {/* 유형 필터 */}
        {usedTopics.length > 0 && (
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
            <Chip active={topicFilter === 'all'} onClick={() => setTopicFilter('all')}>전체 유형</Chip>
            {usedTopics.map((t) => (
              <Chip key={t} active={topicFilter === t} onClick={() => setTopicFilter(t)}>{t}</Chip>
            ))}
          </div>
        )}
      </div>

      {/* 질문 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : loadError ? (
        <div className="bg-surface rounded-2xl border border-white/10 p-8 text-center space-y-2">
          <CloudOff size={28} className="mx-auto text-gray-500" />
          <p className="text-sm text-gray-500">{loadError}</p>
        </div>
      ) : (
        <div className="stagger space-y-2">
          <div className="flex items-center justify-between px-1 gap-2">
            <p className="text-sm text-gray-400 shrink-0">{visible.length}개의 돌발질문</p>
            {/* 작성 여부 토글 — 세로로 필터 줄을 하나 더 늘리는 대신 여기 오른쪽에 붙인다 */}
            <div className="inline-flex shrink-0 rounded-full bg-surface-alt p-0.5 text-[11px] font-bold">
              {[
                { id: 'all', label: '전체' },
                { id: 'unwritten', label: '미작성' },
                { id: 'written', label: '작성함' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setScriptFilter(f.id)}
                  className={`px-2.5 py-1 rounded-full transition ${
                    scriptFilter === f.id ? 'bg-brand text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          {pagedVisible.map((q) => {
            const hasScript = Boolean(scripts[q.id]?.text)
            const isExpanded = expandedIds.has(q.id)
            const isLong = q.title.length > TITLE_CLAMP_THRESHOLD
            return (
            <div
              key={q.id}
              onClick={() => openPractice(q, false)}
              className={`lift p-4 bg-surface rounded-2xl border border-white/10 shadow-card cursor-pointer ${hasScript ? 'opacity-70' : ''}`}
            >
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-light text-brand">
                  <AlertTriangle size={10} />
                  돌발
                </span>
                {q.topic && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                    {q.topic}
                  </span>
                )}
                {q.week && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                    {WEEKS.find(w => w.id === q.week)?.label || `${q.week}주차`}
                  </span>
                )}
                {hasScript && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                    <Check size={10} />
                    스크립트 작성함
                  </span>
                )}
              </div>
              <p className={`font-bold text-gray-100 leading-snug ${isExpanded ? '' : 'line-clamp-3'}`}>
                {q.title}
              </p>
              {isLong && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleExpand(q.id) }}
                  className="text-[11px] font-bold text-brand mt-1"
                >
                  {isExpanded ? '접기' : '더보기'}
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); openPractice(q, false) }}
                className="w-full flex items-center justify-center gap-1.5 bg-brand-light hover:bg-red-500/20 text-brand font-bold py-2.5 rounded-xl text-sm transition active:scale-95 mt-3"
              >
                <PenLine size={14} />
                {hasScript ? '스크립트 확인 · 이어쓰기' : '스크립트 작성하기'}
              </button>
            </div>
            )
          })}
          {visible.length === 0 && (
            <div className="text-center py-12 bg-surface rounded-2xl border border-white/10 space-y-1">
              <p className="text-gray-400 font-bold">조건에 맞는 돌발질문이 없어요</p>
              <p className="text-xs text-gray-600">Q&A 커뮤니티에서 돌발질문을 먼저 등록해주세요</p>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg bg-surface-alt text-gray-400 disabled:opacity-30 hover:bg-white/10 transition"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-bold text-gray-400">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-lg bg-surface-alt text-gray-400 disabled:opacity-30 hover:bg-white/10 transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {practiceQuestion && (
        <ScriptPracticeModal
          questionId={practiceQuestion.id}
          questionTitle={practiceQuestion.title}
          questionContent={practiceQuestion.content}
          existing={scripts[practiceQuestion.id]}
          author={author}
          blind={practiceBlind}
          syncAnswers
          onSaved={(questionId, record) =>
            setScripts((prev) => {
              const next = { ...prev }
              if (record) next[questionId] = { id: record.id, text: record.text }
              else delete next[questionId]
              return next
            })
          }
          onClose={() => setPracticeQuestion(null)}
        />
      )}
    </div>
  )
}
