import { useState, useEffect } from 'react'
import {
  MessageCircle, AlertTriangle, MessageSquare, Star, ThumbsUp, Mic,
  PenSquare, ArrowLeft, Trash2
} from 'lucide-react'
import { generateUUID, formatDate } from '../utils/formatters'
import { getQuestions, saveQuestion, updateQuestion, deleteQuestion } from '../utils/storage'
import AnswerPracticeModal from '../components/AnswerPracticeModal'
import ProfileModal from '../components/ProfileModal'

const CATEGORIES = [
  { id: 'all', label: '전체' },
  { id: 'unexpected', label: '돌발질문' },
  { id: 'general', label: '일반질문' },
]

export default function QACommunity({ author, onAuthorChange, pendingDraft, onDraftConsumed }) {
  const [questions, setQuestions] = useState([])
  const [showProfileModal, setShowProfileModal] = useState(false)

  const [view, setView] = useState('list') // 'list' | 'write' | 'detail'
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [selectedQuestion, setSelectedQuestion] = useState(null)
  const [answerContent, setAnswerContent] = useState('')
  const [practiceAnswer, setPracticeAnswer] = useState(null)

  const [newCategory, setNewCategory] = useState('unexpected')
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newTags, setNewTags] = useState('')

  useEffect(() => {
    setQuestions(getQuestions())
  }, [])

  useEffect(() => {
    if (!pendingDraft) return
    setNewTitle(pendingDraft.title || '')
    setNewContent(pendingDraft.content || '')
    setNewCategory('unexpected')
    setView('write')
    onDraftConsumed?.()
  }, [pendingDraft])

  const handleCreateQuestion = () => {
    if (!newTitle.trim() || !newContent.trim()) {
      alert('제목과 내용을 입력해주세요.')
      return
    }

    const tags = newTags.split(',').map((t) => t.trim()).filter(Boolean)

    const question = {
      id: generateUUID(),
      category: newCategory,
      title: newTitle,
      content: newContent,
      tags,
      author,
      createdAt: new Date().toISOString(),
      answers: []
    }

    saveQuestion(question)
    setQuestions([question, ...questions])
    setNewTitle('')
    setNewContent('')
    setNewTags('')
    setNewCategory('unexpected')
    setView('list')
  }

  const handleAddAnswer = () => {
    if (!answerContent.trim() || !selectedQuestion) return

    const answer = {
      id: generateUUID(),
      content: answerContent,
      author,
      likes: 0,
      createdAt: new Date().toISOString(),
      isPinned: false
    }

    const updatedQuestion = {
      ...selectedQuestion,
      answers: [...(selectedQuestion.answers || []), answer]
    }

    updateQuestion(selectedQuestion.id, updatedQuestion)
    setSelectedQuestion(updatedQuestion)
    setQuestions(questions.map(q => q.id === selectedQuestion.id ? updatedQuestion : q))
    setAnswerContent('')
  }

  const handleLikeAnswer = (answerId) => {
    if (!selectedQuestion) return
    const updatedQuestion = {
      ...selectedQuestion,
      answers: selectedQuestion.answers.map(a =>
        a.id === answerId ? { ...a, likes: a.likes + 1 } : a
      )
    }
    updateQuestion(selectedQuestion.id, updatedQuestion)
    setSelectedQuestion(updatedQuestion)
    setQuestions(questions.map(q => q.id === selectedQuestion.id ? updatedQuestion : q))
  }

  const handlePinAnswer = (answerId) => {
    if (!selectedQuestion) return
    const updatedQuestion = {
      ...selectedQuestion,
      answers: selectedQuestion.answers.map(a =>
        a.id === answerId ? { ...a, isPinned: !a.isPinned } : { ...a, isPinned: false }
      )
    }
    updateQuestion(selectedQuestion.id, updatedQuestion)
    setSelectedQuestion(updatedQuestion)
    setQuestions(questions.map(q => q.id === selectedQuestion.id ? updatedQuestion : q))
  }

  const handleDeleteQuestion = (id) => {
    if (confirm('정말로 삭제하시겠습니까?')) {
      deleteQuestion(id)
      setQuestions(questions.filter(q => q.id !== id))
      setSelectedQuestion(null)
      setView('list')
    }
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
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter((question) => {
        const inTitle = question.title.toLowerCase().includes(q)
        const inContent = question.content.toLowerCase().includes(q)
        const inTags = (question.tags || []).some((tag) => tag.toLowerCase().includes(q))
        return inTitle || inContent || inTags
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

  const getTopAcrossResults = (list) => {
    let best = null
    list.forEach((question) => {
      const answer = getBestAnswerOf(question)
      if (answer && (!best || answer.likes > best.answer.likes)) {
        best = { question, answer }
      }
    })
    return best
  }

  const visibleQuestions = getVisibleQuestions()
  const topResult = searchQuery.trim() ? getTopAcrossResults(visibleQuestions) : null
  const pinnedAnswers = (selectedQuestion?.answers || []).filter(a => a.isPinned)
  const unpinnedAnswers = (selectedQuestion?.answers || []).filter(a => !a.isPinned)
  const sortedAnswers = [...pinnedAnswers, ...unpinnedAnswers]

  const categoryBadge = (category) => {
    const isUnexpected = category !== 'general'
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
          isUnexpected ? 'bg-brand-light text-brand' : 'bg-blue-500/10 text-blue-400'
        }`}
      >
        {isUnexpected ? <AlertTriangle size={11} /> : <MessageSquare size={11} />}
        {isUnexpected ? '돌발질문' : '일반질문'}
      </span>
    )
  }

  return (
    <div className="space-y-6 relative">
      {/* 닉네임 설정 모달 (첫 방문 시 강제, 이후 선택) */}
      {showProfileModal && (
        <ProfileModal
          onClose={(savedName) => {
            if (savedName) onAuthorChange(savedName)
            setShowProfileModal(false)
          }}
        />
      )}

      {view === 'list' && (
        <>
          <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-xl md:text-2xl font-extrabold">
                <MessageCircle size={22} className="text-brand" />
                Q&A 커뮤니티
              </h2>
              {author && (
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="text-xs text-gray-500 hover:text-brand"
                >
                  {author} 님 · 닉네임 변경
                </button>
              )}
            </div>

            <input
              type="text"
              placeholder="키워드 또는 태그로 검색 (예: 시간, 조회수, 환불)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-3 border border-white/10 rounded-xl text-base focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand mb-4"
            />

            {topResult && (
              <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold mb-1">
                  <Star size={14} fill="currentColor" />
                  베스트 대처 답변
                </div>
                <p className="text-sm text-gray-400 mb-2">{topResult.question.title}</p>
                <p className="text-gray-100 whitespace-pre-wrap mb-2">{topResult.answer.content}</p>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-sm text-brand font-bold">
                    <ThumbsUp size={13} />
                    {topResult.answer.likes}
                  </span>
                  <button
                    onClick={() => setPracticeAnswer(topResult.answer.content)}
                    className="flex items-center gap-1.5 text-sm bg-brand hover:bg-brand-dark text-white font-bold px-3 py-1.5 rounded-lg transition"
                  >
                    <Mic size={13} />
                    1분 연습하기
                  </button>
                </div>
              </div>
            )}

            {/* 카테고리 탭 */}
            <div className="flex gap-1 overflow-x-auto -mx-1 px-1 mb-3">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoryFilter(c.id)}
                  className={`shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition ${
                    categoryFilter === c.id
                      ? 'bg-brand text-white'
                      : 'bg-surface-alt text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">{visibleQuestions.length}개의 글</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-sm p-1.5 border border-white/10 rounded-lg"
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
                  className="w-full text-left p-4 rounded-2xl bg-surface border border-white/10 shadow-card hover:bg-surface-alt active:bg-white/10 transition"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {categoryBadge(q.category)}
                    <span className="text-xs text-gray-500">답변 {q.answers?.length || 0}</span>
                  </div>
                  <h4 className="font-bold">{q.title}</h4>
                  <p className="text-xs text-gray-400 mt-0.5">{q.author}</p>
                  {(q.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {q.tags.map((tag) => (
                        <span key={tag} className="text-xs bg-white/10 text-gray-400 px-2 py-0.5 rounded-full">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {best && (
                    <p className="flex items-center gap-1 text-xs text-amber-400 mt-2 line-clamp-1">
                      <Star size={11} fill="currentColor" />
                      {best.content}
                    </p>
                  )}
                </button>
              )
            })}
            {visibleQuestions.length === 0 && (
              <div className="text-center text-gray-500 py-12 bg-surface rounded-2xl border border-white/10">
                아직 등록된 글이 없어요
              </div>
            )}
          </div>

          {/* 글쓰기 플로팅 버튼 */}
          <button
            onClick={() => setView('write')}
            className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-20 flex items-center gap-1.5 bg-brand hover:bg-brand-dark active:scale-95 text-white font-bold px-5 py-3.5 rounded-full shadow-floating transition"
          >
            <PenSquare size={16} />
            글쓰기
          </button>
        </>
      )}

      {view === 'write' && (
        <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setView('list')} className="text-gray-500 hover:text-gray-200">
              <ArrowLeft size={20} />
            </button>
            <h2 className="text-xl font-extrabold">글쓰기</h2>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              {CATEGORIES.filter(c => c.id !== 'all').map((c) => (
                <button
                  key={c.id}
                  onClick={() => setNewCategory(c.id)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition ${
                    newCategory === c.id
                      ? 'bg-brand text-white'
                      : 'bg-surface-alt text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="질문 제목"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full p-3 border border-white/10 rounded-xl focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <textarea
              placeholder="질문 내용"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="w-full p-3 border border-white/10 rounded-xl focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              rows="6"
            />
            <input
              type="text"
              placeholder="태그 (쉼표로 구분, 예: 시간, 환불, 조회수)"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              className="w-full p-3 border border-white/10 rounded-xl focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <button
              onClick={handleCreateQuestion}
              className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-3.5 rounded-xl transition"
            >
              등록하기
            </button>
          </div>
        </div>
      )}

      {view === 'detail' && selectedQuestion && (
        <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6 space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('list')} className="text-gray-500 hover:text-gray-200">
              <ArrowLeft size={20} />
            </button>
            <button
              onClick={() => handleDeleteQuestion(selectedQuestion.id)}
              className="ml-auto flex items-center gap-1 text-sm text-red-400 hover:text-red-600"
            >
              <Trash2 size={14} />
              삭제
            </button>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              {categoryBadge(selectedQuestion.category)}
            </div>
            <h3 className="text-2xl font-extrabold mb-2">{selectedQuestion.title}</h3>
            <p className="text-sm text-gray-400 mb-2">
              {selectedQuestion.author} · {formatDate(selectedQuestion.createdAt)}
            </p>
            {(selectedQuestion.tags || []).length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {selectedQuestion.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-white/10 text-gray-400 px-2 py-0.5 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <p className="text-gray-200 whitespace-pre-wrap">{selectedQuestion.content}</p>
          </div>

          <hr className="border-white/10" />

          <div className="space-y-3">
            <h4 className="font-bold text-lg">답변 ({selectedQuestion.answers?.length || 0})</h4>

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
                <p className="text-sm text-gray-400 mb-2">
                  {answer.author} · {formatDate(answer.createdAt)}
                </p>
                <p className="text-gray-200 whitespace-pre-wrap mb-3">{answer.content}</p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleLikeAnswer(answer.id)}
                    className="flex items-center gap-1 text-sm font-bold text-brand bg-surface px-2.5 py-1 rounded-lg border border-white/10"
                  >
                    <ThumbsUp size={13} />
                    {answer.likes}
                  </button>
                  <button
                    onClick={() => handlePinAnswer(answer.id)}
                    className={`flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-lg border ${
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
                    className="flex items-center gap-1 text-sm font-bold bg-brand hover:bg-brand-dark text-white px-2.5 py-1 rounded-lg transition"
                  >
                    <Mic size={13} />
                    1분 연습하기
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
              className="w-full p-3 border border-white/10 rounded-xl focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              rows="4"
            />
            <button
              onClick={handleAddAnswer}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition"
            >
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
