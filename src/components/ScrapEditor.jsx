import { useState } from 'react'
import { HelpCircle, X, Play } from 'lucide-react'
import { formatTime, formatDate } from '../utils/formatters'

export default function ScrapEditor({ scrap, onUpdate, onDelete, onAskQuestion, onPlay }) {
  const [note, setNote] = useState(scrap.screenAnalysis || '')

  const handleChange = (e) => {
    const value = e.target.value
    setNote(value)
    onUpdate(scrap.id, value, '')
  }

  return (
    <div className="p-4 border border-white/10 rounded-2xl bg-surface shadow-card">
      <div className="flex justify-between items-center mb-2">
        <button
          onClick={() => onPlay?.(scrap)}
          className="flex items-center gap-1 font-bold text-brand bg-brand-light hover:bg-red-500/20 px-2 py-0.5 rounded-lg text-sm font-mono transition"
        >
          <Play size={11} fill="currentColor" />
          {formatTime(scrap.timestamp)}
        </button>
        <button
          onClick={() => onDelete(scrap.id)}
          className="text-gray-600 hover:text-red-500 transition"
        >
          <X size={16} />
        </button>
      </div>

      <textarea
        value={note}
        onChange={handleChange}
        placeholder="이 순간 느낀 점, 개선하고 싶은 점을 자유롭게 적어보세요"
        className="w-full text-sm p-2.5 border border-white/10 rounded-xl resize-none focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        rows="2"
      />

      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-gray-500">{formatDate(scrap.createdAt)}</p>
        {onAskQuestion && (
          <button
            onClick={() => onAskQuestion(scrap)}
            className="flex items-center gap-1 text-xs font-bold text-brand bg-brand-light hover:bg-red-500/20 px-2.5 py-1 rounded-lg transition"
          >
            <HelpCircle size={12} />
            바로 질문하기
          </button>
        )}
      </div>
    </div>
  )
}
