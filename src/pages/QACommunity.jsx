import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  MessageCircle, AlertTriangle, MessageSquare, Star, ThumbsUp, Mic, PenLine,
  PenSquare, ArrowLeft, Trash2, Loader2, CloudOff, Search, Check, ChevronLeft, ChevronRight, RefreshCw
} from 'lucide-react'
import { formatDate, generateUUID } from '../utils/formatters'
import { supabase, supabaseConfigured } from '../utils/supabase'
import { WEEKS } from '../utils/weeks'
import { TOPICS, parseTags, buildTags } from '../utils/qaTags'
import { listRecords, putRecord, removeRecord } from '../utils/cloudStore'
import AnswerPracticeModal from '../components/AnswerPracticeModal'
import ScriptPracticeModal from '../components/ScriptPracticeModal'
import ProfileModal from '../components/ProfileModal'
import { isAdminMode } from '../utils/admin'

const CATEGORIES = [
  { id: 'all', label: '전체' },
  { id: 'unexpected', label: '돌발질문' },
  { id: 'general', label: '일반질문' },
]

const PAGE_SIZE = 15
const QA_LAST_VIEW_KEY = 'pt-qa-last-view'

function mapAnswer(a) {
  return {
    id: a.id,
    content: a.content,
    author: a.author,
    likes: a.likes,
    createdAt: a.created_at,
  }
}

function mapQuestion(q) {
  const { week, topic, tags } = parseTags(q.tags)
  return {
    id: q.id,
    category: q.category,
    title: q.title,
    content: q.content,
    week,
    topic,
    tags,
    author: q.author,
    createdAt: q.created_at,
    answers: (q.answers || [])
      .map(mapAnswer)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
  }
}

function Chip({ active, onClick, children, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-bold transition active:scale-95 ${
        active
          ? 'bg-brand text-white shadow-floating'
          : 'bg-surface-alt text-gray-400 hover:bg-white/10 hover:text-gray-200'
      } ${className}`}
    >
      {children}
    </button>
  )
}

export default function QACommunity({ author, onLogout }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [showProfileModal, setShowProfileModal] = useState(false)

  const [view, setView] = useState('list') // 'list' | 'write' | 'detail'
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [topicFilter, setTopicFilter] = useState('all')
  const [weekFilter, setWeekFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)
  const [selectedQuestion, setSelectedQuestion] = useState(null)
  const [answerContent, setAnswerContent] = useState('')
  const [practiceAnswer, setPracticeAnswer] = useState(null)
  const [scriptPracticeOpen, setScriptPracticeOpen] = useState(false)
  const [answerSort, setAnswerSort] = useState('recommended') // 'recommended' | 'newest'
  const [likedAnswers, setLikedAnswers] = useState(() => new Map()) // answerId -> like 레코드 id
  const [scripts, setScripts] = useState({}) // questionId -> { id, text } (돌발질문 전용 개인 원고, 돌발 연습실과 공유)
  const [submitting, setSubmitting] = useState(false)

  const [newCategory, setNewCategory] = useState('unexpected')
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const admin = isAdminMode()
  const [newWeek, setNewWeek] = useState('')
  const [newTopic, setNewTopic] = useState('')
  const [showContentField, setShowContentField] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editingAnswerId, setEditingAnswerId] = useState(null)
  const [editAnswerText, setEditAnswerText] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const restoredViewRef = useRef(false)

  const loadQuestions = async () => {
    if (!supabaseConfigured) {
      setLoading(false)
      setLoadError('설정 없음')
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('questions')
      .select('*, answers(*)')
      .order('created_at', { ascending: false })
    if (error) {
      setLoadError(error.message)
    } else {
      setQuestions((data || []).map(mapQuestion))
      setLoadError(null)
    }
    setLoading(false)
  }

  // 전체 로딩 스피너 없이 목록만 새로고침 — 새 글이 올라왔는지 가볍게 다시 확인할 때 쓴다
  const refreshQuestions = async () => {
    if (!supabaseConfigured) return
    setRefreshing(true)
    const { data, error } = await supabase
      .from('questions')
      .select('*, answers(*)')
      .order('created_at', { ascending: false })
    if (!error) {
      setQuestions((data || []).map(mapQuestion))
      setLoadError(null)
    }
    setRefreshing(false)
  }

  useEffect(() => {
    loadQuestions()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [categoryFilter, topicFilter, weekFilter, searchQuery, sortBy])

  // 새로고침해도 보고 있던 글이 그대로 열려 있게 한다 (전엔 항상 목록으로 돌아갔다)
  useEffect(() => {
    if (restoredViewRef.current || loading || questions.length === 0) return
    restoredViewRef.current = true
    try {
      const saved = JSON.parse(sessionStorage.getItem(QA_LAST_VIEW_KEY) || 'null')
      if (saved?.questionId) {
        const q = questions.find((q) => q.id === saved.questionId)
        if (q) {
          setSelectedQuestion(q)
          setView('detail')
        }
      }
    } catch {}
  }, [loading, questions])

  useEffect(() => {
    // 복원 시도가 끝나기 전에 이 effect가 먼저 돌면, 아직 읽지도 않은 저장값을
    // 초기 상태(view='list')를 보고 지워버린다 — 그래서 복원이 끝난 뒤에만 기록한다
    if (!restoredViewRef.current) return
    if (view === 'detail' && selectedQuestion) {
      sessionStorage.setItem(QA_LAST_VIEW_KEY, JSON.stringify({ questionId: selectedQuestion.id }))
    } else if (view === 'list') {
      sessionStorage.removeItem(QA_LAST_VIEW_KEY)
    }
  }, [view, selectedQuestion])

  // 목록에서 스크롤을 내린 채로 글을 선택하면, 상세 화면도 그 위치 그대로 이어져
  // 제목/본문 윗부분이 화면 위로 잘려 보인다. 화면(글쓰기/상세)이 바뀔 때는 맨 위로 올린다.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [view])

  // 돌발 연습실에서 원고를 저장하면 공개 답변도 같이 바뀌므로, 상세 화면을 새로 불러와 반영한다
  const refreshSelectedQuestion = async () => {
    if (!selectedQuestion) return
    const { data, error } = await supabase
      .from('questions')
      .select('*, answers(*)')
      .eq('id', selectedQuestion.id)
      .single()
    if (error) return
    const updated = mapQuestion(data)
    setSelectedQuestion(updated)
    setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)))
  }

  // 추천(좋아요)은 1인당 1회만 — 이미 누른 답변 목록을 미리 불러온다
  useEffect(() => {
    if (!author) return
    listRecords('like', { author })
      .then((rows) => setLikedAnswers(new Map(rows.map((r) => [r.answerId, r.id]))))
      .catch((e) => console.error('추천 목록 불러오기 실패', e))
  }, [author])

  // 돌발질문 개인 원고는 돌발 연습실과 같은 저장소를 공유한다 ("답변하기"= "원고쓰기")
  useEffect(() => {
    if (!author) return
    listRecords('script', { author })
      .then((rows) => {
        const map = {}
        for (const r of rows) if (r.questionId) map[r.questionId] = { id: r.id, text: r.text }
        setScripts(map)
      })
      .catch(e => console.error('원고 불러오기 실패', e))
  }, [author])

  const resetWriteForm = () => {
    setNewTitle('')
    setNewContent('')
    setNewWeek('')
    setNewTopic('')
    setNewCategory('unexpected')
    setShowContentField(false)
    setEditingId(null)
  }

  const handleStartEdit = (question) => {
    setEditingId(question.id)
    setNewCategory(question.category || 'unexpected')
    setNewTitle(question.title || '')
    setNewContent(question.content || '')
    setNewWeek(question.week || '')
    setNewTopic(question.topic || '')
    setShowContentField(Boolean(question.content))
    setView('write')
  }

  const handleSubmitQuestion = async () => {
    if (!newTitle.trim()) {
      alert('질문을 입력해주세요.')
      return
    }
    if (newCategory === 'unexpected' && !newWeek) {
      alert('주차를 선택해주세요.')
      return
    }
    setSubmitting(true)
    const tags = newCategory === 'unexpected'
      ? buildTags({ week: newWeek, topic: newTopic })
      : []
    const payload = {
      category: newCategory,
      title: newTitle.trim(),
      content: newContent.trim(),
      tags,
    }

    if (editingId) {
      const { data, error } = await supabase
        .from('questions')
        .update(payload)
        .eq('id', editingId)
        .select('*, answers(*)')
        .single()

      setSubmitting(false)
      if (error) {
        alert('수정에 실패했어요: ' + error.message)
        return
      }
      const updated = mapQuestion(data)
      setQuestions(questions.map(q => (q.id === editingId ? updated : q)))
      setSelectedQuestion(updated)
      resetWriteForm()
      setView('detail')
      return
    }

    const { data, error } = await supabase
      .from('questions')
      .insert({ ...payload, author })
      .select('*, answers(*)')
      .single()

    setSubmitting(false)
    if (error) {
      alert('등록에 실패했어요: ' + error.message)
      return
    }
    setQuestions([mapQuestion(data), ...questions])
    resetWriteForm()
    setView('list')
  }

  const handleAddAnswer = async () => {
    if (!answerContent.trim() || !selectedQuestion) return
    setSubmitting(true)
    const { data, error } = await supabase
      .from('answers')
      .insert({ question_id: selectedQuestion.id, content: answerContent, author })
      .select()
      .single()
    setSubmitting(false)

    if (error) {
      alert('답변 등록에 실패했어요: ' + error.message)
      return
    }

    const updatedQuestion = { ...selectedQuestion, answers: [...selectedQuestion.answers, mapAnswer(data)] }
    setSelectedQuestion(updatedQuestion)
    setQuestions(questions.map(q => q.id === selectedQuestion.id ? updatedQuestion : q))
    setAnswerContent('')
  }

  const handleLikeAnswer = async (answerId) => {
    if (!selectedQuestion || !author) return
    const target = selectedQuestion.answers.find(a => a.id === answerId)
    if (!target) return
    const alreadyLiked = likedAnswers.has(answerId)
    const newLikes = Math.max(0, target.likes + (alreadyLiked ? -1 : 1))

    const { error } = await supabase.from('answers').update({ likes: newLikes }).eq('id', answerId)
    if (error) return

    if (alreadyLiked) {
      const recordId = likedAnswers.get(answerId)
      await removeRecord('like', recordId).catch((e) => console.error('추천 취소 실패', e))
      setLikedAnswers((prev) => {
        const next = new Map(prev)
        next.delete(answerId)
        return next
      })
    } else {
      const recordId = generateUUID()
      await putRecord('like', { id: recordId, answerId, author }, { author }).catch((e) => console.error('추천 저장 실패', e))
      setLikedAnswers((prev) => new Map(prev).set(answerId, recordId))
    }

    const updatedQuestion = {
      ...selectedQuestion,
      answers: selectedQuestion.answers.map(a => a.id === answerId ? { ...a, likes: newLikes } : a)
    }
    setSelectedQuestion(updatedQuestion)
    setQuestions(questions.map(q => q.id === selectedQuestion.id ? updatedQuestion : q))
  }

  const canModerate = (item) => admin || item.author === author

  const handleStartEditAnswer = (answer) => {
    setEditingAnswerId(answer.id)
    setEditAnswerText(answer.content)
  }

  const handleSaveAnswerEdit = async (answerId) => {
    const text = editAnswerText.trim()
    if (!text || !selectedQuestion) return
    const { error } = await supabase.from('answers').update({ content: text }).eq('id', answerId)
    if (error) {
      alert('답변 수정에 실패했어요: ' + error.message)
      return
    }
    const updatedQuestion = {
      ...selectedQuestion,
      answers: selectedQuestion.answers.map(a => a.id === answerId ? { ...a, content: text } : a)
    }
    setSelectedQuestion(updatedQuestion)
    setQuestions(questions.map(q => q.id === selectedQuestion.id ? updatedQuestion : q))
    setEditingAnswerId(null)
  }

  const handleDeleteAnswer = async (answerId) => {
    if (!selectedQuestion) return
    if (!confirm('이 답변을 삭제하시겠습니까?')) return
    const { error } = await supabase.from('answers').delete().eq('id', answerId)
    if (error) {
      alert('삭제에 실패했어요: ' + error.message)
      return
    }
    const updatedQuestion = {
      ...selectedQuestion,
      answers: selectedQuestion.answers.filter(a => a.id !== answerId)
    }
    setSelectedQuestion(updatedQuestion)
    setQuestions(questions.map(q => q.id === selectedQuestion.id ? updatedQuestion : q))
  }

  const handleDeleteQuestion = async (id) => {
    if (!confirm('정말로 삭제하시겠습니까?')) return
    const { error } = await supabase.from('questions').delete().eq('id', id)
    if (error) {
      alert('삭제에 실패했어요: ' + error.message)
      return
    }
    setQuestions(questions.filter(q => q.id !== id))
    setSelectedQuestion(null)
    setView('list')
  }

  const getBestAnswerOf = (question) => {
    const answers = question.answers || []
    if (answers.length === 0) return null
    return answers.reduce((best, a) => (a.likes > best.likes ? a : best), answers[0])
  }

  const getVisibleQuestions = () => {
    let list = [...questions]
    if (categoryFilter !== 'all') {
      list = list.filter(q => (q.category || 'unexpected') === categoryFilter)
    }
    if (topicFilter !== 'all') {
      list = list.filter(q => q.topic === topicFilter)
    }
    if (weekFilter !== 'all') {
      list = list.filter(q => q.week === weekFilter)
    }
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter((question) => {
        const inTitle = question.title.toLowerCase().includes(q)
        const inContent = (question.content || '').toLowerCase().includes(q)
        const inTopic = (question.topic || '').toLowerCase().includes(q)
        return inTitle || inContent || inTopic
      })
    }
    if (sortBy === 'newest') {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    } else {
      list.sort((a, b) => {
        const aLikes = (a.answers || []).reduce((sum, ans) => sum + ans.likes, 0)
        const bLikes = (b.answers || []).reduce((sum, ans) => sum + ans.likes, 0)
        return bLikes - aLikes
      })
    }
    // 돌발질문만 볼 때는 아직 원고를 안 쓴 글을 위로 올린다 — 뭐부터 연습해야 할지
    // 한눈에 보이게. sort는 안정 정렬이라 같은 그룹 안에서는 위 정렬 순서가 유지된다.
    if (categoryFilter === 'unexpected') {
      list.sort((a, b) => {
        const aDone = Boolean(scripts[a.id]?.text)
        const bDone = Boolean(scripts[b.id]?.text)
        if (aDone === bDone) return 0
        return aDone ? 1 : -1
      })
    }
    return list
  }

  const visibleQuestions = getVisibleQuestions()
  const totalPages = Math.max(1, Math.ceil(visibleQuestions.length / PAGE_SIZE))
  const pagedQuestions = visibleQuestions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  // 실제로 글이 존재하는 유형만 필터로 노출해 빈 칩이 쌓이지 않게 한다
  const usedTopics = TOPICS.filter(t => questions.some(q => q.topic === t))
  const sortedAnswers = [...(selectedQuestion?.answers || [])].sort((a, b) => (
    answerSort === 'recommended'
      ? (b.likes - a.likes) || (new Date(b.createdAt) - new Date(a.createdAt))
      : new Date(b.createdAt) - new Date(a.createdAt)
  ))

  const categoryBadge = (category) => {
    const isUnexpected = category !== 'general'
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
          isUnexpected ? 'bg-brand-light text-brand' : 'bg-blue-500/10 text-blue-400'
        }`}
      >
        {isUnexpected ? <AlertTriangle size={10} /> : <MessageSquare size={10} />}
        {isUnexpected ? '돌발' : '일반'}
      </span>
    )
  }

  const metaBadge = (text) => (
    <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
      {text}
    </span>
  )

  if (!supabaseConfigured) {
    return (
      <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-8 text-center space-y-2">
        <CloudOff size={28} className="mx-auto text-gray-500" />
        <h2 className="text-lg font-extrabold">Q&A 커뮤니티 연결 안 됨</h2>
        <p className="text-sm text-gray-500">.env에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 설정해주세요.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 size={24} className="animate-spin" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-8 text-center space-y-2">
        <CloudOff size={28} className="mx-auto text-gray-500" />
        <h2 className="text-lg font-extrabold">불러오기에 실패했어요</h2>
        <p className="text-sm text-gray-500">{loadError}</p>
        <button onClick={loadQuestions} className="text-sm font-bold text-brand hover:underline">다시 시도</button>
      </div>
    )
  }

  return (
    <div className="space-y-4 relative">
      {showProfileModal && (
        <ProfileModal
          author={author}
          onLoggedOut={() => { setShowProfileModal(false); onLogout?.() }}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {view === 'list' && (
        <>
          <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-xl md:text-2xl font-extrabold min-w-0">
                <MessageCircle size={22} className="text-brand shrink-0" />
                <span className="truncate">Q&A 커뮤니티</span>
              </h2>
              {author && (
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="shrink-0 text-xs text-gray-500 hover:text-brand"
                >
                  {author} 님
                </button>
              )}
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

            {/* 카테고리 */}
            <div className="flex gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
              {CATEGORIES.map((c) => (
                <Chip
                  key={c.id}
                  active={categoryFilter === c.id}
                  onClick={() => { setCategoryFilter(c.id); setTopicFilter('all'); setWeekFilter('all') }}
                >
                  {c.label}
                </Chip>
              ))}
            </div>

            {/* 돌발질문 주차 필터 */}
            {categoryFilter !== 'general' && (
              <div className="flex gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
                <Chip active={weekFilter === 'all'} onClick={() => setWeekFilter('all')} className="!text-xs !py-1.5">
                  전체 주차
                </Chip>
                {WEEKS.map((w) => (
                  <Chip key={w.id} active={weekFilter === w.id} onClick={() => setWeekFilter(w.id)} className="!text-xs !py-1.5">
                    {w.label}
                  </Chip>
                ))}
              </div>
            )}

            {/* 돌발질문 유형 필터 */}
            {categoryFilter !== 'general' && usedTopics.length > 0 && (
              <div className="flex gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
                <Chip active={topicFilter === 'all'} onClick={() => setTopicFilter('all')} className="!text-xs !py-1.5">
                  전체 유형
                </Chip>
                {usedTopics.map((t) => (
                  <Chip key={t} active={topicFilter === t} onClick={() => setTopicFilter(t)} className="!text-xs !py-1.5">
                    {t}
                  </Chip>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">{visibleQuestions.length}개의 글</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={refreshQuestions}
                  disabled={refreshing}
                  title="새로고침"
                  className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-brand bg-surface-alt hover:bg-white/10 px-3 py-2 rounded-lg border border-white/10 transition disabled:opacity-50"
                >
                  <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                  새로고침
                </button>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="text-sm p-2 border border-white/10 rounded-lg bg-surface-alt"
                >
                  <option value="newest">최신순</option>
                  <option value="popular">인기순</option>
                </select>
              </div>
            </div>
          </div>

          {/* 질문 목록 */}
          <div className="stagger space-y-2">
            {pagedQuestions.map((q) => {
              const best = getBestAnswerOf(q)
              const isUnexpected = (q.category || 'unexpected') !== 'general'
              const hasScript = isUnexpected && Boolean(scripts[q.id]?.text)
              return (
                <button
                  key={q.id}
                  onClick={() => { setSelectedQuestion(q); setView('detail') }}
                  className={`lift w-full text-left p-4 rounded-2xl bg-surface border border-white/10 shadow-card hover:border-brand/40 ${
                    isUnexpected && hasScript ? 'opacity-70' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                    {categoryBadge(q.category)}
                    {q.topic && metaBadge(q.topic)}
                    {q.week && metaBadge(WEEKS.find(w => w.id === q.week)?.label || `${q.week}주차`)}
                    {isUnexpected && (
                      hasScript ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                          <Check size={10} />
                          스크립트 작성함
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                          <PenLine size={10} />
                          스크립트 미작성
                        </span>
                      )
                    )}
                  </div>
                  <h4 className="font-bold leading-snug">{q.title}</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    {q.author} · 답변 {q.answers?.length || 0}
                  </p>
                  {best && (
                    <p className="flex items-start gap-1 text-xs text-amber-400 mt-2 line-clamp-2">
                      <Star size={11} fill="currentColor" className="shrink-0 mt-0.5" />
                      {best.content}
                    </p>
                  )}
                </button>
              )
            })}
            {visibleQuestions.length === 0 && (
              <div className="text-center py-12 bg-surface rounded-2xl border border-white/10 space-y-1">
                <p className="text-gray-400 font-bold">아직 등록된 글이 없어요</p>
                <p className="text-xs text-gray-600">오른쪽 아래 글쓰기 버튼으로 첫 질문을 남겨보세요</p>
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

          {/*
            main에 걸린 anim-rise 등장 애니메이션이 transform을 만들어서, 이 버튼이 그 안에
            있으면 position:fixed가 화면이 아니라 main 박스 기준으로 붙어버려 스크롤을 내려야만
            보였다. body로 포탈해서 항상 화면에 바로 보이게 한다.
          */}
          {createPortal(
            <button
              onClick={() => setView('write')}
              className="shine glow-breathe anim-pop fixed bottom-24 md:bottom-8 right-4 md:right-8 z-20 flex items-center gap-1.5 bg-brand hover:bg-brand-dark hover:scale-105 active:scale-95 text-white font-bold px-5 py-3.5 rounded-full shadow-floating transition-transform duration-300"
            >
              <PenSquare size={16} />
              글쓰기
            </button>,
            document.body
          )}
        </>
      )}

      {view === 'write' && (
        <div className="anim-rise bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6">
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={() => {
                const back = editingId ? 'detail' : 'list'
                resetWriteForm()
                setView(back)
              }}
              className="text-gray-500 hover:text-gray-200"
            >
              <ArrowLeft size={20} />
            </button>
            <h2 className="text-xl font-extrabold">{editingId ? '글 수정' : '글쓰기'}</h2>
          </div>

          {!editingId && (
            <div className="flex items-start gap-2 bg-surface-alt border border-white/10 rounded-xl p-3 mb-5">
              <Search size={14} className="text-gray-500 shrink-0 mt-0.5" />
              <p className="text-xs text-gray-400 leading-relaxed">
                혹시 중복될 수 있으니, 검색을 해보고 없으면 진행 부탁드립니다.
              </p>
            </div>
          )}

          <div className="space-y-5">
            <div className="flex gap-2">
              {CATEGORIES.filter(c => c.id !== 'all').map((c) => (
                <button
                  key={c.id}
                  onClick={() => setNewCategory(c.id)}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition active:scale-95 ${
                    newCategory === c.id
                      ? 'bg-brand text-white'
                      : 'bg-surface-alt text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {newCategory === 'unexpected' && (
              <>
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-2 block">
                    주차 <span className="text-brand">*</span>
                  </label>
                  <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
                    {WEEKS.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => setNewWeek(w.id)}
                        className={`shrink-0 flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-bold transition active:scale-95 ${
                          newWeek === w.id
                            ? 'bg-brand text-white'
                            : 'bg-surface-alt text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        {newWeek === w.id && <Check size={12} className="shrink-0" />}
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 mb-2 block">돌발질문 유형 (선택)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TOPICS.map((t) => (
                      <button
                        key={t}
                        onClick={() => setNewTopic(newTopic === t ? '' : t)}
                        className={`flex items-center justify-center gap-1 px-2 py-2.5 rounded-xl text-sm font-bold transition active:scale-95 ${
                          newTopic === t
                            ? 'bg-brand text-white'
                            : 'bg-surface-alt text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        {newTopic === t && <Check size={13} className="shrink-0" />}
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-bold text-gray-400 mb-2 block">
                질문 <span className="text-brand">*</span>
              </label>
              <input
                type="text"
                placeholder={newCategory === 'unexpected' ? '예: 썸네일을 골라주시면 안되요?' : '무엇이 궁금한가요?'}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitQuestion()}
                autoFocus
                className="w-full p-3.5 bg-surface-alt border border-white/10 rounded-xl text-base focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>

            {showContentField ? (
              <textarea
                placeholder="상황을 더 자세히 적어주세요 (선택)"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                spellCheck={false}
                className="w-full p-3.5 bg-surface-alt border border-white/10 rounded-xl focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                rows="5"
              />
            ) : (
              <button
                onClick={() => setShowContentField(true)}
                className="text-xs font-bold text-gray-500 hover:text-brand"
              >
                + 자세한 설명 추가 (선택)
              </button>
            )}

            <button
              onClick={handleSubmitQuestion}
              disabled={submitting}
              className="shine relative w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark disabled:opacity-60 text-white font-bold py-4 rounded-xl transition active:scale-95"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {editingId ? '수정 완료' : '등록하기'}
            </button>
          </div>
        </div>
      )}

      {view === 'detail' && selectedQuestion && (
        <div className="anim-rise bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6 space-y-5">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('list')} className="text-gray-500 hover:text-gray-200">
              <ArrowLeft size={20} />
            </button>
            {canModerate(selectedQuestion) && (
              <div className="ml-auto flex items-center gap-3">
                {admin && selectedQuestion.author !== author && (
                  <span className="text-[10px] font-bold text-brand bg-brand-light px-2 py-1 rounded-full whitespace-nowrap">
                    관리자 권한
                  </span>
                )}
                <button
                  onClick={() => handleStartEdit(selectedQuestion)}
                  className="flex items-center gap-1 text-sm text-gray-400 hover:text-brand"
                >
                  <PenSquare size={14} />
                  수정
                </button>
                <button
                  onClick={() => handleDeleteQuestion(selectedQuestion.id)}
                  className="flex items-center gap-1 text-sm text-red-400 hover:text-red-600"
                >
                  <Trash2 size={14} />
                  삭제
                </button>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              {categoryBadge(selectedQuestion.category)}
              {selectedQuestion.topic && metaBadge(selectedQuestion.topic)}
              {selectedQuestion.week && metaBadge(
                WEEKS.find(w => w.id === selectedQuestion.week)?.label || `${selectedQuestion.week}주차`
              )}
            </div>
            <h3 className="text-xl md:text-2xl font-extrabold mb-2 leading-snug">{selectedQuestion.title}</h3>
            <p className="text-sm text-gray-500 mb-3">
              {selectedQuestion.author} · {formatDate(selectedQuestion.createdAt)}
            </p>
            {selectedQuestion.content && (
              <p className="text-gray-200 whitespace-pre-wrap leading-relaxed">{selectedQuestion.content}</p>
            )}
          </div>

          {selectedQuestion.category !== 'general' ? (
            <button
              onClick={() => setScriptPracticeOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 bg-brand-light hover:bg-red-500/20 text-brand font-bold py-3 rounded-xl transition active:scale-95"
            >
              <PenLine size={15} />
              {scripts[selectedQuestion.id]?.text ? '내 원고 확인 · 이어쓰기' : '내 원고 쓰기 · 연습하기'}
            </button>
          ) : (
            <button
              onClick={() => setPracticeAnswer(selectedQuestion.title)}
              className="w-full flex items-center justify-center gap-1.5 bg-brand-light hover:bg-red-500/20 text-brand font-bold py-3 rounded-xl transition active:scale-95"
            >
              <Mic size={15} />
              이 질문으로 1분 연습하기
            </button>
          )}

          <hr className="border-white/10" />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold">답변 ({selectedQuestion.answers?.length || 0})</h4>
              <div className="flex gap-1 bg-surface-alt rounded-lg p-0.5">
                {[{ id: 'recommended', label: '추천순' }, { id: 'newest', label: '최신순' }].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setAnswerSort(opt.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                      answerSort === opt.id ? 'bg-brand text-white' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {sortedAnswers.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-6">
                아직 답변이 없어요. 첫 대처법을 공유해주세요!
              </p>
            )}

            {sortedAnswers.map((answer) => {
              const isEditing = editingAnswerId === answer.id
              return (
              <div key={answer.id} className="p-4 rounded-2xl border bg-surface-alt border-white/10">
                <p className="text-xs text-gray-500 mb-2">
                  {answer.author} · {formatDate(answer.createdAt)}
                </p>
                {isEditing ? (
                  <div className="space-y-2 mb-3">
                    <textarea
                      value={editAnswerText}
                      onChange={(e) => setEditAnswerText(e.target.value)}
                      spellCheck={false}
                      rows="4"
                      autoFocus
                      className="w-full p-3 bg-surface border border-brand rounded-xl text-gray-200 leading-relaxed focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingAnswerId(null)}
                        className="flex-1 bg-white/10 hover:bg-white/15 text-gray-300 font-bold py-2 rounded-lg text-sm transition"
                      >
                        취소
                      </button>
                      <button
                        onClick={() => handleSaveAnswerEdit(answer.id)}
                        className="flex-1 bg-brand hover:bg-brand-dark text-white font-bold py-2 rounded-lg text-sm transition"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-200 whitespace-pre-wrap mb-3 leading-relaxed">{answer.content}</p>
                )}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleLikeAnswer(answer.id)}
                    className={`flex items-center gap-1 text-sm font-bold px-3 py-1.5 rounded-lg border active:scale-95 transition ${
                      likedAnswers.has(answer.id)
                        ? 'text-white bg-brand border-brand'
                        : 'text-brand bg-surface border-white/10'
                    }`}
                  >
                    <ThumbsUp size={13} fill={likedAnswers.has(answer.id) ? 'currentColor' : 'none'} />
                    {answer.likes}
                  </button>
                  <button
                    onClick={() => setPracticeAnswer(answer.content)}
                    className="flex items-center gap-1 text-sm font-bold bg-brand hover:bg-brand-dark text-white px-3 py-1.5 rounded-lg transition active:scale-95"
                  >
                    <Mic size={13} />
                    연습
                  </button>
                  {canModerate(answer) && !isEditing && (
                    <>
                      <button
                        onClick={() => handleStartEditAnswer(answer)}
                        className="flex items-center gap-1 text-sm font-bold text-gray-400 hover:text-brand bg-surface px-3 py-1.5 rounded-lg border border-white/10 active:scale-95 transition"
                      >
                        <PenSquare size={13} />
                        수정
                      </button>
                      <button
                        onClick={() => handleDeleteAnswer(answer.id)}
                        className="flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-red-500 bg-surface px-3 py-1.5 rounded-lg border border-white/10 active:scale-95 transition"
                      >
                        <Trash2 size={13} />
                        삭제
                      </button>
                    </>
                  )}
                </div>
              </div>
              )
            })}
          </div>

          <hr className="border-white/10" />

          {selectedQuestion.category === 'general' ? (
            <div className="space-y-3">
              <h4 className="font-bold">답변하기</h4>
              <textarea
                placeholder="대처 방법을 입력해주세요..."
                value={answerContent}
                onChange={(e) => setAnswerContent(e.target.value)}
                spellCheck={false}
                className="w-full p-3.5 bg-surface-alt border border-white/10 rounded-xl focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                rows="4"
              />
              <button
                onClick={handleAddAnswer}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition active:scale-95"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                답변 등록
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-500 text-center">
              돌발질문은 위쪽 "내 원고 쓰기 · 연습하기" 버튼으로 답변해요. 한 사람당 답변은 하나만 유지돼요.
            </p>
          )}
        </div>
      )}

      {practiceAnswer && (
        <AnswerPracticeModal
          answerContent={practiceAnswer}
          onClose={() => setPracticeAnswer(null)}
        />
      )}

      {scriptPracticeOpen && selectedQuestion && (
        <ScriptPracticeModal
          questionId={selectedQuestion.id}
          questionTitle={selectedQuestion.title}
          questionContent={selectedQuestion.content}
          existing={scripts[selectedQuestion.id]}
          author={author}
          syncAnswers
          onAnswerSynced={refreshSelectedQuestion}
          onSaved={(questionId, record) =>
            setScripts((prev) => {
              const next = { ...prev }
              if (record) next[questionId] = { id: record.id, text: record.text }
              else delete next[questionId]
              return next
            })
          }
          onClose={() => { setScriptPracticeOpen(false); refreshSelectedQuestion() }}
        />
      )}
    </div>
  )
}
