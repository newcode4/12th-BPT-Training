import { useState } from 'react'
import { X, Play, Flag, Repeat } from 'lucide-react'
import { formatTime, formatDate } from '../utils/formatters'

export default function ScrapEditor({ scrap, onUpdate, onDelete, onPlay, onSetEnd }) {
  const [title, setTitle] = useState(scrap.title || '')
  const [note, setNote] = useState(scrap.screenAnalysis || '')

  const handleTitleChange = (e) => {
    const value = e.target.value
    setTitle(value)
    onUpdate(scrap.id, note, '', value)
  }

  const handleChange = (e) => {
    const value = e.target.value
    setNote(value)
    onUpdate(scrap.id, value, '', title)
  }

  const hasRange = scrap.endTime != null && scrap.endTime > scrap.timestamp

  return (
    <div className="p-4 border border-white/10 rounded-2xl bg-surface shadow-card">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onPlay?.(scrap)}
            className="flex items-center gap-1 font-bold text-brand bg-brand-light hover:bg-red-500/20 px-2 py-0.5 rounded-lg text-sm font-mono transition"
          >
            {hasRange ? <Repeat size={11} /> : <Play size={11} fill="currentColor" />}
            {formatTime(scrap.timestamp)}
            {hasRange && <span className="opacity-70">→ {formatTime(scrap.endTime)}</span>}
          </button>
          {onSetEnd && !hasRange && (
            <button
              onClick={() => onSetEnd(scrap)}
              title="지금 재생 위치를 구간의 끝으로 지정"
              className="flex items-center gap-1 text-xs font-bold text-gray-400 bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded-lg transition"
            >
              <Flag size={11} />
              구간 끝 지정
            </button>
          )}
        </div>
        <button
          onClick={() => onDelete(scrap.id)}
          className="text-gray-600 hover:text-red-500 transition"
        >
          <X size={16} />
        </button>
      </div>

      {hasRange && (
        <p className="text-[11px] text-gray-500 mb-2">이 구간을 반복 재생해요 — 다시 클릭하면 계속 반복돼요</p>
      )}

      <input
        type="text"
        value={title}
        onChange={handleTitleChange}
        placeholder="소제목 (예: 가격 질문 대처)"
        className="w-full text-sm font-bold p-2.5 mb-2 border border-white/10 rounded-xl focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
      />

      <textarea
        value={note}
        onChange={handleChange}
        placeholder="이 순간 느낀 점, 개선하고 싶은 점을 자유롭게 적어보세요"
        spellCheck={false}
        className="w-full text-sm p-2.5 border border-white/10 rounded-xl resize-none focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        rows="2"
      />

      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-gray-500">{formatDate(scrap.createdAt)}</p>
      </div>
    </div>
  )
}
