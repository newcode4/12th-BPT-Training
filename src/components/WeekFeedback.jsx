import { useState, useEffect } from 'react'
import { PenLine } from 'lucide-react'
import { getWeekFeedback, saveWeekFeedback } from '../utils/storage'

export default function WeekFeedback({ week }) {
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(true)

  useEffect(() => {
    setText(getWeekFeedback(week))
    setSaved(true)
  }, [week])

  const handleChange = (e) => {
    setText(e.target.value)
    setSaved(false)
  }

  const handleSave = () => {
    saveWeekFeedback(week, text)
    setSaved(true)
  }

  return (
    <div className="bg-surface-alt rounded-2xl p-4 space-y-2">
      <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-gray-200">
        <PenLine size={16} className="text-brand" />
        이번 주 나의 피드백
      </h3>
      <textarea
        value={text}
        onChange={handleChange}
        placeholder="이번 주 나에게 부족했던 점, 느낀 점을 자유롭게 적어보세요"
        className="w-full p-3 border border-white/10 rounded-xl text-sm bg-surface focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        rows="4"
      />
      <button
        onClick={handleSave}
        disabled={saved}
        className="w-full bg-brand hover:bg-brand-dark disabled:bg-white/15 disabled:text-gray-500 text-white font-bold py-2.5 rounded-xl text-sm transition"
      >
        {saved ? '저장됨' : '저장하기'}
      </button>
    </div>
  )
}
