import { useState, useEffect } from 'react'
import {
  MessageCircle, AlertTriangle, MessageSquare, Star, ThumbsUp, Mic,
  PenSquare, ArrowLeft, Trash2, Loader2, CloudOff, Search, Check
} from 'lucide-react'
import { formatDate } from '../utils/formatters'
import { supabase, supabaseConfigured } from '../utils/supabase'
import { WEEKS } from '../utils/weeks'
import { TOPICS, parseTags, buildTags } from '../utils/qaTags'
import AnswerPracticeModal from '../components/AnswerPracticeModal'
import ProfileModal from '../components/ProfileModal'

const CATEGORIES = [
  { id: 'all', label: '전체' },
  { id: 'unexpected', label: '돌발질문' },
  { id: 'general', label: '일반질문' },
]

function mapAnswer(a) {
  return {
    id: a.id,
    content: a.content,
    author: a.author,
    likes: a.likes,
    isPinned: a.is_pinned,
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

export default function QACommunity({ author, onLogout, pendingDraft, onDraftConsumed }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [showProfileModal, setShowProfileModal] = useState(false)

  const [view, setView] = useState('list') // 'list' | 'write' | 'detail'
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [topicFilter, setTopicFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [selectedQuestion, setSelectedQuestion] = useState(null)
  const [answerContent, setAnswerContent] = useState('')
  const [practiceAnswer, setPracticeAnswer] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [newCategory, setNewCategory] = useState('unexpected')
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newWeek, setNewWeek] = useState('')
  const [newTopic, setNewTopic] = useState('')
  const [showContentField, setShowContentField] = useState(false)
  const [editingId, setEditingId] = useState(null)

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

  useEffect(() => {
    loadQuestions()
  }, [])

  useEffect(() => {
    if (!pendingDraft) return
    setNewTitle(pendingDraft.title || '')
    setNewContent(pendingDraft.content || '')
    setNewCategory('unexpected')
    setShowContentField(Boolean(pendingDraft.content))
    setView('write')
    onDraftConsumed?.()
  }, [pendingDraft])

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
    if (!selectedQuestion) return
    const target = selectedQuestion.answers.find(a => a.id === answerId)
    if (!target) return
    const newLikes = target.likes + 1

    const { error } = await supabase.from('answers').update({ likes: newLikes }).eq('id', answerId)
    if (error) return

    const updatedQuestion = {
      ...selectedQuestion,
      answers: selectedQuestion.answers.map(a => a.id === answerId ? { ...a, likes: newLikes } : a)
    }
    setSelectedQuestion(updatedQuestion)
    setQuestions(questions.map(q => q.id === selectedQuestion.id ? updatedQuestion : q))
  }

  const handlePinAnswer = async (answerId) => {
    if (!selectedQuestion) return
    const target = selectedQuestion.answers.find(a => a.id === answerId)
    if (!target) return
    const nextPinned = !target.isPinned

    await supabase.from('answers').update({ is_pinned: false }).eq('question_id', selectedQuestion.id)
    await supabase.from('answers').update({ is_pinned: nextPinned }).eq('id', answerId)

    const updatedQuestion = {
      ...selectedQuestion,
      answers: selectedQuestion.answers.map(a => ({ ...a, isPinned: a.id === answerId ? nextPinned : false }))
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
    return list
  }

  const visibleQuestions = getVisibleQuestions()
  // 실제로 글이 존재하는 유형만 필터로 노출해 빈 칩이 쌓이지 않게 한다
  const usedTopics = TOPICS.filter(t => questions.some(q => q.topic === t))
  const pinnedAnswers = (selectedQuestion?.answers || []).filter(a => a.isPinned)
  const unpinnedAnswers = (selectedQuestion?.answers || []).filter(a => !a.isPinned)
  const sortedAnswers = [...pinnedAnswers, ...unpinnedAnswers]

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
                  onClick={() => { setCategoryFilter(c.id); setTopicFilter('all') }}
                >
                  {c.label}
                </Chip>
              ))}
            </div>

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

          {/* 질문 목록 */}
          <div className="space-y-2">
            {visibleQuestions.map((q) => {
              const best = getBestAnswerOf(q)
              return (
                <button
                  key={q.id}
                  onClick={() => { setSelectedQuestion(q); setView('detail') }}
                  className="w-full text-left p-4 rounded-2xl bg-surface border border-white/10 shadow-card hover:border-brand/40 active:scale-[0.99] transition"
                >
                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                    {categoryBadge(q.category)}
                    {q.topic && metaBadge(q.topic)}
                    {q.week && metaBadge(WEEKS.find(w => w.id === q.week)?.label || `${q.week}주차`)}
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
          </div>

          {/* 글쓰기 플로팅 버튼 */}
          <button
            onClick={() => setView('write')}
            className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-20 flex items-center gap-1.5 bg-brand hover:bg-brand-dark active:scale-95 text-white font-bold px-5 py-3.5 rounded-full shadow-floating transition"
          >
            <PenSquare size={16} />
            글쓰기
          </button>
        </>
      )}

      {view === 'write' && (
        <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6">
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
              className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark disabled:opacity-60 text-white font-bold py-4 rounded-xl transition active:scale-95"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {editingId ? '수정 완료' : '등록하기'}
            </button>
          </div>
        </div>
      )}

      {view === 'detail' && selectedQuestion && (
        <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6 space-y-5">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('list')} className="text-gray-500 hover:text-gray-200">
              <ArrowLeft size={20} />
            </button>
            <button
              onClick={() => handleStartEdit(selectedQuestion)}
              className="ml-auto flex items-center gap-1 text-sm text-gray-400 hover:text-brand"
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

          <button
            onClick={() => setPracticeAnswer(selectedQuestion.title)}
            className="w-full flex items-center justify-center gap-1.5 bg-brand-light hover:bg-red-500/20 text-brand font-bold py-3 rounded-xl transition active:scale-95"
          >
            <Mic size={15} />
            이 질문으로 1분 연습하기
          </button>

          <hr className="border-white/10" />

          <div className="space-y-3">
            <h4 className="font-bold">답변 ({selectedQuestion.answers?.length || 0})</h4>

            {sortedAnswers.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-6">
                아직 답변이 없어요. 첫 대처법을 공유해주세요!
              </p>
            )}

            {sortedAnswers.map((answer) => (
              <div
                key={answer.id}
                className={`p-4 rounded-2xl border ${
                  answer.isPinned ? 'bg-amber-500/10 border-amber-500/30' : 'bg-surface-alt border-white/10'
                }`}
              >
                {answer.isPinned && (
                  <div className="flex items-center gap-1.5 text-amber-400 text-sm font-bold mb-2">
                    <Star size={13} fill="currentColor" />
                    베스트 대처법
                  </div>
                )}
                <p className="text-xs text-gray-500 mb-2">
                  {answer.author} · {formatDate(answer.createdAt)}
                </p>
                <p className="text-gray-200 whitespace-pre-wrap mb-3 leading-relaxed">{answer.content}</p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleLikeAnswer(answer.id)}
                    className="flex items-center gap-1 text-sm font-bold text-brand bg-surface px-3 py-1.5 rounded-lg border border-white/10 active:scale-95 transition"
                  >
                    <ThumbsUp size={13} />
                    {answer.likes}
                  </button>
                  <button
                    onClick={() => handlePinAnswer(answer.id)}
                    className={`flex items-center gap-1 text-sm font-bold px-3 py-1.5 rounded-lg border active:scale-95 transition ${
                      answer.isPinned
                        ? 'text-amber-400 bg-surface border-amber-500/30'
                        : 'text-gray-400 bg-surface border-white/10'
                    }`}
                  >
                    <Star size={13} fill={answer.isPinned ? 'currentColor' : 'none'} />
                    {answer.isPinned ? '고정됨' : '고정'}
                  </button>
                  <button
                    onClick={() => setPracticeAnswer(answer.content)}
                    className="flex items-center gap-1 text-sm font-bold bg-brand hover:bg-brand-dark text-white px-3 py-1.5 rounded-lg transition active:scale-95"
                  >
                    <Mic size={13} />
                    연습
                  </button>
                </div>
              </div>
            ))}
          </div>

          <hr className="border-white/10" />

          <div className="space-y-3">
            <h4 className="font-bold">답변하기</h4>
            <textarea
              placeholder="대처 방법을 입력해주세요..."
              value={answerContent}
              onChange={(e) => setAnswerContent(e.target.value)}
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
        </div>
      )}

      {practiceAnswer && (
        <AnswerPracticeModal
          answerContent={practiceAnswer}
          onClose={() => setPracticeAnswer(null)}
        />
      )}
    </div>
  )
}
