import { useState, useEffect } from 'react'
import { PenLine, Trash2 } from 'lucide-react'
import { generateUUID } from '../utils/formatters'
import { listRecords, putRecord, removeRecord } from '../utils/cloudStore'

const CATEGORIES = [
  { id: 'self', label: '셀프 피드백' },
  { id: 'presentation', label: '발표 후 받은 피드백' },
]

export default function WeekFeedback({ week }) {
  const [entries, setEntries] = useState([])
  const [text, setText] = useState('')
  const [category, setCategory] = useState('self')
  // 나의 피드백은 개인 기록이라 내가 쓴 것만 불러온다 (기기만 바뀌어도 그대로 보이게)
  const author = localStorage.getItem('qa-author') || '익명'

  useEffect(() => {
    let cancelled = false
    setEntries([])
    setText('')
    setCategory('self')
    listRecords('feedback', { week, author })
      .then((rows) => {
        if (cancelled) return
        setEntries(rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
      })
      .catch(e => console.error('피드백 불러오기 실패', e))
    return () => { cancelled = true }
  }, [week, author])

  const handleAdd = () => {
    if (!text.trim()) return
    const entry = {
      id: generateUUID(),
      week,
      category,
      text: text.trim(),
      author,
      createdAt: new Date().toISOString(),
    }
    setEntries([entry, ...entries])
    setText('')
    putRecord('feedback', entry, { author, week })
      .catch(e => console.error('피드백 저장 실패', e))
  }

  const handleDelete = (id) => {
    setEntries(entries.filter((e) => e.id !== id))
    removeRecord('feedback', id).catch(e => console.error('피드백 삭제 실패', e))
  }

  return (
    <div className="bg-surface-alt rounded-2xl p-4 space-y-3">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-gray-200">
          <PenLine size={16} className="text-brand" />
          이번 주 나의 피드백
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">스크랩과는 별개로, 느낀 점이나 발표 후 받은 피드백을 자유롭게 계속 남겨보세요</p>
      </div>

      <div className="flex gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
              category === c.id ? 'bg-brand text-white' : 'bg-surface text-gray-400 border border-white/10'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="느낀 점, 부족했던 점, 받은 피드백을 적어보세요"
        spellCheck={false}
        className="w-full p-3 border border-white/10 rounded-xl text-sm bg-surface focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        rows="3"
      />
      <button
        onClick={handleAdd}
        className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-xl text-sm transition"
      >
        기록 추가
      </button>

      <div className="space-y-2">
        {entries.map((entry) => (
          <div key={entry.id} className="p-3 bg-surface rounded-xl">
            <div className="flex items-center justify-between mb-1">
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  entry.category === 'presentation' ? 'bg-brand-light text-brand' : 'bg-white/10 text-gray-400'
                }`}
              >
                {CATEGORIES.find((c) => c.id === entry.category)?.label || '셀프 피드백'}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500">
                  {new Date(entry.createdAt).toLocaleString('ko-KR')}
                </span>
                <button onClick={() => handleDelete(entry.id)} className="text-gray-600 hover:text-red-500">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{entry.text}</p>
          </div>
        ))}
        {entries.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-3">아직 기록한 피드백이 없어요</p>
        )}
      </div>
    </div>
  )
}
