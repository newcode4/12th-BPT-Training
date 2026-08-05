import { useState, useEffect } from 'react'
import { ChevronDown, Sparkles, Trash2 } from 'lucide-react'
import { listRecords, removeRecord } from '../utils/cloudStore'
import { WEEKS } from '../utils/weeks'

const CATEGORY_LABEL = {
  self: '셀프 피드백',
  presentation: '발표 후 받은 피드백',
}

// 모든 주차의 "나의 피드백"을 한눈에 모아보는 상단 요약 (WeekFeedback과 같은 저장소를 공유한다)
export default function FeedbackDigest({ onJumpToWeek }) {
  const [open, setOpen] = useState(true)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [weekFilter, setWeekFilter] = useState('all')
  const author = localStorage.getItem('qa-author') || '익명'

  useEffect(() => {
    listRecords('feedback', { author })
      .then((rows) => {
        setEntries(rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
        setLoading(false)
      })
      .catch((e) => { console.error('피드백 모음 불러오기 실패', e); setLoading(false) })
  }, [author])

  const handleDelete = (id) => {
    setEntries(entries.filter((e) => e.id !== id))
    removeRecord('feedback', id).catch((e) => console.error('피드백 삭제 실패', e))
  }

  const visible = weekFilter === 'all' ? entries : entries.filter((e) => String(e.week) === weekFilter)
  const usedWeeks = WEEKS.filter((w) => entries.some((e) => String(e.week) === w.id))

  return (
    <div className="bg-surface rounded-2xl shadow-card border border-white/10 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 md:p-6"
      >
        <span className="flex items-center gap-2 text-sm font-extrabold text-gray-200">
          <Sparkles size={16} className="text-brand" />
          피드백 모음 {!loading && `(${entries.length})`}
        </span>
        <ChevronDown size={18} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="p-4 md:p-6 pt-0 space-y-3">
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-4">불러오는 중...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              아직 기록한 피드백이 없어요. 아래 주차별 "인사이트 & 피드백"에서 남겨보세요.
            </p>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
                <button
                  onClick={() => setWeekFilter('all')}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition ${
                    weekFilter === 'all' ? 'bg-brand text-white' : 'bg-surface-alt text-gray-400 hover:bg-white/10'
                  }`}
                >
                  전체 주차
                </button>
                {usedWeeks.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setWeekFilter(w.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition ${
                      weekFilter === w.id ? 'bg-brand text-white' : 'bg-surface-alt text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {visible.map((entry) => (
                  <div key={entry.id} className="p-3 bg-surface-alt rounded-xl">
                    <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                          {WEEKS.find((w) => w.id === String(entry.week))?.label || `${entry.week}주차`}
                        </span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          entry.category === 'presentation' ? 'bg-brand-light text-brand' : 'bg-white/10 text-gray-400'
                        }`}>
                          {CATEGORY_LABEL[entry.category] || '셀프 피드백'}
                        </span>
                      </div>
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
                    {onJumpToWeek && (
                      <button
                        onClick={() => onJumpToWeek(String(entry.week))}
                        className="text-[11px] font-bold text-brand hover:underline mt-1.5"
                      >
                        이 주차로 이동
                      </button>
                    )}
                  </div>
                ))}
                {visible.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-3">이 주차에는 기록한 피드백이 없어요</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
