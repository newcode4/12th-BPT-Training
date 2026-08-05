import { useState, useEffect } from 'react'
import { Mic, Shuffle, AlertTriangle, Loader2, CloudOff, Search } from 'lucide-react'
import { getRandomItem } from '../utils/formatters'
import { supabase, supabaseConfigured } from '../utils/supabase'
import { WEEKS } from '../utils/weeks'
import { TOPICS, parseTags } from '../utils/qaTags'
import AnswerPracticeModal from '../components/AnswerPracticeModal'

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

export default function PracticeRoom() {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [weekFilter, setWeekFilter] = useState('all')
  const [topicFilter, setTopicFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [practiceQuestion, setPracticeQuestion] = useState(null)

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

  const visible = questions.filter((q) => {
    if (weekFilter !== 'all' && q.week !== weekFilter) return false
    if (topicFilter !== 'all' && q.topic !== topicFilter) return false
    const s = searchQuery.trim().toLowerCase()
    if (s && !q.title.toLowerCase().includes(s)) return false
    return true
  })

  const usedTopics = TOPICS.filter(t => questions.some(q => q.topic === t))

  const handleRandom = () => {
    const picked = getRandomItem(visible)
    if (!picked) {
      alert('조건에 맞는 돌발질문이 없어요. 필터를 바꾸거나 Q&A에서 먼저 등록해주세요.')
      return
    }
    setPracticeQuestion(picked)
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6 space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl md:text-2xl font-extrabold mb-1">
            <Mic size={22} className="text-brand shrink-0" />
            돌발 연습실
          </h2>
          <p className="text-sm text-gray-400">
            Q&A 커뮤니티에 올라온 돌발질문으로 1분 말하기를 연습해보세요
          </p>
        </div>

        <button
          onClick={handleRandom}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-bold py-4 rounded-xl transition active:scale-95 shadow-floating"
        >
          {loading ? <Loader2 size={17} className="animate-spin" /> : <Shuffle size={17} />}
          랜덤으로 하나 뽑기
        </button>

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
        <div className="space-y-2">
          <p className="text-sm text-gray-400 px-1">{visible.length}개의 돌발질문</p>
          {visible.map((q) => (
            <div
              key={q.id}
              className="p-4 bg-surface rounded-2xl border border-white/10 shadow-card"
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
              </div>
              <p className="font-bold text-gray-100 leading-snug mb-3">{q.title}</p>
              <button
                onClick={() => setPracticeQuestion(q)}
                className="w-full flex items-center justify-center gap-1.5 bg-brand-light hover:bg-red-500/20 text-brand font-bold py-2.5 rounded-xl text-sm transition active:scale-95"
              >
                <Mic size={14} />
                1분 말하기 연습
              </button>
            </div>
          ))}
          {visible.length === 0 && (
            <div className="text-center py-12 bg-surface rounded-2xl border border-white/10 space-y-1">
              <p className="text-gray-400 font-bold">조건에 맞는 돌발질문이 없어요</p>
              <p className="text-xs text-gray-600">Q&A 커뮤니티에서 돌발질문을 먼저 등록해주세요</p>
            </div>
          )}
        </div>
      )}

      {practiceQuestion && (
        <AnswerPracticeModal
          answerContent={
            practiceQuestion.content
              ? `${practiceQuestion.title}\n\n${practiceQuestion.content}`
              : practiceQuestion.title
          }
          onClose={() => setPracticeQuestion(null)}
        />
      )}
    </div>
  )
}
