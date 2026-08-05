import { useState, useEffect } from 'react'
import { Mic, Shuffle, AlertTriangle, Globe, Lock, Star, FolderOpen, Trash2, Tag, MessageCircle, Download, Loader2 } from 'lucide-react'
import { generateUUID, formatDate, getRandomItem } from '../utils/formatters'
import { getEmergencyItems, saveEmergencyItem, updateEmergencyItem, deleteEmergencyItem } from '../utils/storage'
import { supabase, supabaseConfigured } from '../utils/supabase'
import { WEEKS } from '../utils/weeks'
import AnswerPracticeModal from '../components/AnswerPracticeModal'

export default function PracticeRoom() {
  const [selectedWeek, setSelectedWeek] = useState('0')
  const [items, setItems] = useState([])
  const [folderOnly, setFolderOnly] = useState(false)
  const [situation, setSituation] = useState('')
  const [myAnswer, setMyAnswer] = useState('')
  const [category, setCategory] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('전체')
  const [visibility, setVisibility] = useState('shared')
  const [randomItem, setRandomItem] = useState(null)
  const [practiceItem, setPracticeItem] = useState(null)
  const author = localStorage.getItem('qa-author') || '익명'

  const [qaQuestions, setQaQuestions] = useState([])
  const [qaLoading, setQaLoading] = useState(false)
  const [qaOpen, setQaOpen] = useState(false)
  const [qaRandom, setQaRandom] = useState(null)

  useEffect(() => {
    setItems(getEmergencyItems())
  }, [])

  useEffect(() => {
    if (!supabaseConfigured) return
    setQaLoading(true)
    supabase
      .from('questions')
      .select('id, title, category, created_at')
      .eq('category', 'unexpected')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error) setQaQuestions(data || [])
        setQaLoading(false)
      })
  }, [])

  useEffect(() => {
    setCategoryFilter('전체')
  }, [selectedWeek])

  const weekItems = items.filter(i => i.week === selectedWeek)
  const weekCategories = ['전체', ...Array.from(new Set(weekItems.map(i => i.category).filter(Boolean)))]
  const categoryFiltered = categoryFilter === '전체' ? weekItems : weekItems.filter(i => i.category === categoryFilter)
  const visibleItems = folderOnly ? categoryFiltered.filter(i => i.isCollected) : categoryFiltered

  const handleAdd = () => {
    if (!situation.trim() || !myAnswer.trim()) {
      alert('돌발 상황과 내 답변을 모두 입력해주세요.')
      return
    }
    const item = {
      id: generateUUID(),
      week: selectedWeek,
      author,
      situation: situation.trim(),
      myAnswer: myAnswer.trim(),
      category: category.trim() || '기타',
      visibility,
      isCollected: false,
      createdAt: new Date().toISOString()
    }
    saveEmergencyItem(item)
    setItems([item, ...items])
    setSituation('')
    setMyAnswer('')
    setCategory('')
    setVisibility('shared')
  }

  const handleToggleCollect = (id) => {
    const target = items.find(i => i.id === id)
    if (!target) return
    const updated = { ...target, isCollected: !target.isCollected }
    updateEmergencyItem(id, updated)
    setItems(items.map(i => i.id === id ? updated : i))
  }

  const handleDelete = (id) => {
    if (confirm('정말로 삭제하시겠습니까?')) {
      deleteEmergencyItem(id)
      setItems(items.filter(i => i.id !== id))
      if (randomItem?.id === id) setRandomItem(null)
    }
  }

  const handleRandomPick = () => {
    const pool = visibleItems.length > 0 ? visibleItems : weekItems
    const picked = getRandomItem(pool)
    if (!picked) {
      alert('이번 주차에 등록된 돌발사항이 없어요. 먼저 추가해주세요.')
      return
    }
    setRandomItem(picked)
  }

  const handleQaRandomPick = () => {
    const picked = getRandomItem(qaQuestions)
    if (!picked) {
      alert('Q&A 커뮤니티에 등록된 돌발질문이 없어요.')
      return
    }
    setQaRandom(picked)
  }

  const handleQaPractice = (question) => {
    setPracticeItem({
      situation: question.title,
      myAnswer: '',
      fromQa: true
    })
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6">
        <h2 className="flex items-center gap-2 text-xl md:text-2xl font-extrabold mb-1">
          <Mic size={22} className="text-brand" />
          돌발 연습실
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          주차별 돌발 상황에 내 답변을 텍스트로 바로 적어보고, 랜덤으로 연습해보세요
        </p>

        {/* 주차 탭 */}
        <div className="flex gap-1 overflow-x-auto -mx-1 px-1">
          {WEEKS.map((w) => (
            <button
              key={w.id}
              onClick={() => { setSelectedWeek(w.id); setRandomItem(null) }}
              className={`shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition ${
                selectedWeek === w.id
                  ? 'bg-brand text-white'
                  : 'bg-surface-alt text-gray-400 hover:bg-white/10'
              }`}
            >
              {w.label} · {w.title} ({items.filter(i => i.week === w.id).length})
            </button>
          ))}
        </div>
      </div>

      {/* 랜덤 연습 */}
      <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6">
        <button
          onClick={handleRandomPick}
          className="w-full flex items-center justify-center gap-1.5 bg-brand hover:bg-brand-dark text-white font-bold py-3.5 rounded-xl transition"
        >
          <Shuffle size={16} />
          이번 주차 랜덤 돌발 연습
        </button>

        {randomItem && (
          <div className="mt-4 p-4 bg-brand-light border border-red-500/20 rounded-2xl space-y-2">
            <p className="flex items-center gap-1 text-xs font-bold text-brand">
              <AlertTriangle size={12} />
              돌발 상황
            </p>
            <p className="text-gray-100 whitespace-pre-wrap font-bold">{randomItem.situation}</p>
            <p className="text-xs font-bold text-gray-400 mt-2">내 답변</p>
            <p className="text-gray-200 whitespace-pre-wrap">{randomItem.myAnswer}</p>
            <button
              onClick={() => setPracticeItem(randomItem)}
              className="mt-2 w-full flex items-center justify-center gap-1.5 bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-xl transition"
            >
              <Mic size={15} />
              1분 말하기 연습
            </button>
          </div>
        )}
      </div>

      {/* Q&A 커뮤니티에서 가져오기 */}
      {supabaseConfigured && (
        <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-lg font-extrabold">
              <MessageCircle size={18} className="text-brand" />
              Q&A 커뮤니티에서 가져오기
            </h3>
            <button
              onClick={() => setQaOpen(!qaOpen)}
              className="text-xs font-bold text-gray-500 hover:text-brand"
            >
              {qaOpen ? '목록 닫기' : `목록 보기 (${qaQuestions.length})`}
            </button>
          </div>

          <button
            onClick={handleQaRandomPick}
            disabled={qaLoading}
            className="w-full flex items-center justify-center gap-1.5 bg-surface-alt hover:bg-white/10 text-gray-200 font-bold py-3 rounded-xl transition disabled:opacity-50"
          >
            {qaLoading ? <Loader2 size={15} className="animate-spin" /> : <Shuffle size={15} />}
            Q&A 돌발질문 랜덤으로 가져오기
          </button>

          {qaRandom && (
            <div className="p-4 bg-brand-light border border-red-500/20 rounded-2xl space-y-2">
              <p className="flex items-center gap-1 text-xs font-bold text-brand">
                <AlertTriangle size={12} />
                Q&A 돌발질문
              </p>
              <p className="text-gray-100 whitespace-pre-wrap font-bold">{qaRandom.title}</p>
              <button
                onClick={() => handleQaPractice(qaRandom)}
                className="mt-2 w-full flex items-center justify-center gap-1.5 bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-xl transition"
              >
                <Mic size={15} />
                1분 말하기 연습
              </button>
            </div>
          )}

          {qaOpen && (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {qaQuestions.length === 0 && !qaLoading && (
                <p className="text-sm text-gray-500 text-center py-4">Q&A 커뮤니티에 등록된 돌발질문이 없어요.</p>
              )}
              {qaQuestions.map((q) => (
                <div key={q.id} className="flex items-center gap-2 p-3 bg-surface-alt rounded-xl">
                  <p className="flex-1 text-sm text-gray-200 truncate">{q.title}</p>
                  <button
                    onClick={() => handleQaPractice(q)}
                    className="flex items-center gap-1 shrink-0 text-xs font-bold bg-brand hover:bg-brand-dark text-white px-2.5 py-1.5 rounded-lg transition"
                  >
                    <Download size={11} />
                    가져오기
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 돌발사항 추가 */}
      <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6 space-y-3">
        <h3 className="text-lg font-extrabold">돌발사항 추가</h3>
        <textarea
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
          placeholder="어떤 돌발 상황이었나요?"
          className="w-full p-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          rows="2"
        />
        <textarea
          value={myAnswer}
          onChange={(e) => setMyAnswer(e.target.value)}
          placeholder="나라면 이렇게 답하겠다..."
          className="w-full p-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          rows="3"
        />
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="카테고리 (예: 환불, 가격문의, 시간관리 - 비워두면 기타)"
          className="w-full p-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setVisibility('shared')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm transition ${
              visibility === 'shared' ? 'bg-brand text-white' : 'bg-surface-alt text-gray-400'
            }`}
          >
            <Globe size={14} />
            공유하기
          </button>
          <button
            onClick={() => setVisibility('private')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm transition ${
              visibility === 'private' ? 'bg-gray-600 text-white' : 'bg-surface-alt text-gray-400'
            }`}
          >
            <Lock size={14} />
            나만보기
          </button>
        </div>
        <button
          onClick={handleAdd}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition"
        >
          추가하기
        </button>
      </div>

      {/* 목록 */}
      <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold">
            {WEEKS.find(w => w.id === selectedWeek)?.label} 돌발사항 ({visibleItems.length})
          </h3>
          <button
            onClick={() => setFolderOnly(!folderOnly)}
            className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full transition ${
              folderOnly ? 'bg-brand text-white' : 'bg-surface-alt text-gray-400'
            }`}
          >
            <FolderOpen size={13} />
            내 폴더만
          </button>
        </div>

        {weekCategories.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {weekCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full transition ${
                  categoryFilter === cat ? 'bg-brand text-white' : 'bg-surface-alt text-gray-400 hover:bg-white/10'
                }`}
              >
                <Tag size={10} />
                {cat}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {visibleItems.map((item) => (
            <div key={item.id} className="p-4 bg-surface-alt rounded-2xl">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                  <Tag size={10} />
                  {item.category || '기타'}
                </span>
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                  item.visibility === 'private' ? 'bg-white/15 text-gray-300' : 'bg-brand-light text-brand'
                }`}>
                  {item.visibility === 'private' ? <Lock size={11} /> : <Globe size={11} />}
                  {item.visibility === 'private' ? '나만보기' : '공유'}
                </span>
                <span className="text-xs text-gray-500">{item.author} · {formatDate(item.createdAt)}</span>
              </div>
              <p className="font-bold text-gray-100 mb-1">{item.situation}</p>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{item.myAnswer}</p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleToggleCollect(item.id)}
                  className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg transition ${
                    item.isCollected ? 'bg-amber-500/20 text-amber-400' : 'bg-surface text-gray-400 border border-white/10'
                  }`}
                >
                  <Star size={12} fill={item.isCollected ? 'currentColor' : 'none'} />
                  {item.isCollected ? '담았음' : '폴더에 담기'}
                </button>
                <button
                  onClick={() => setPracticeItem(item)}
                  className="flex items-center gap-1 text-xs font-bold bg-brand hover:bg-brand-dark text-white px-2.5 py-1 rounded-lg transition"
                >
                  <Mic size={12} />
                  1분 연습
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-red-500 px-2.5 py-1 ml-auto"
                >
                  <Trash2 size={12} />
                  삭제
                </button>
              </div>
            </div>
          ))}
          {visibleItems.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">
              {folderOnly ? '내 폴더에 담은 돌발사항이 없어요' : '아직 등록된 돌발사항이 없어요'}
            </p>
          )}
        </div>
      </div>

      {practiceItem && (
        <AnswerPracticeModal
          answerContent={
            practiceItem.myAnswer
              ? `[돌발 상황]\n${practiceItem.situation}\n\n[내 답변]\n${practiceItem.myAnswer}`
              : `[돌발 상황]\n${practiceItem.situation}`
          }
          onClose={() => setPracticeItem(null)}
        />
      )}
    </div>
  )
}
