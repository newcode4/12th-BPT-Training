import { useState } from 'react'
import { ThumbsUp, X, Lightbulb } from 'lucide-react'
import { generateUUID } from '../utils/formatters'
import { putRecord, removeRecord } from '../utils/cloudStore'
import { isAdminMode } from '../utils/admin'

export default function WeekInsights({ week, insights, setInsights, author }) {
  const [newInsight, setNewInsight] = useState('')

  const weekInsights = insights
    .filter(i => i.week === week)
    .sort((a, b) => b.votes - a.votes)

  const handleAdd = () => {
    if (!newInsight.trim()) return
    const insight = {
      id: generateUUID(),
      week,
      content: newInsight.trim(),
      author: author || '익명',
      votes: 0,
      createdAt: new Date().toISOString()
    }
    setInsights([...insights, insight])
    setNewInsight('')
    putRecord('insight', insight, { author: insight.author, week })
      .catch(e => console.error('인사이트 저장 실패', e))
  }

  const handleVote = (id) => {
    const target = insights.find(i => i.id === id)
    if (!target) return
    const updated = { ...target, votes: target.votes + 1 }
    setInsights(insights.map(i => i.id === id ? updated : i))
    putRecord('insight', updated, { author: updated.author, week: updated.week })
      .catch(e => console.error('투표 저장 실패', e))
  }

  const handleDelete = (id) => {
    setInsights(insights.filter(i => i.id !== id))
    removeRecord('insight', id).catch(e => console.error('인사이트 삭제 실패', e))
  }

  return (
    <div className="bg-surface-alt rounded-2xl p-4 space-y-3">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-gray-200">
          <Lightbulb size={16} className="text-brand" />
          이 주차에 꼭 알아야 할 것
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">함께 채워가는 집단지성 — 좋은 인사이트에 투표해보세요</p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newInsight}
          onChange={(e) => setNewInsight(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="예: 확신을 가져야 한다"
          className="flex-1 p-2.5 border border-white/10 rounded-xl text-sm bg-surface focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
        <button
          onClick={handleAdd}
          className="px-4 bg-brand hover:bg-brand-dark text-white font-bold rounded-xl text-sm transition"
        >
          추가
        </button>
      </div>

      <div className="space-y-2">
        {weekInsights.map((insight) => (
          <div
            key={insight.id}
            className="flex items-center justify-between gap-3 p-3 bg-surface rounded-xl"
          >
            <div className="min-w-0">
              <p className="text-sm text-gray-100">{insight.content}</p>
              <p className="text-xs text-gray-500">{insight.author}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => handleVote(insight.id)}
                className="flex items-center gap-1 text-xs font-bold text-brand bg-surface-alt border border-white/10 px-2 py-1 rounded-lg"
              >
                <ThumbsUp size={12} />
                {insight.votes}
              </button>
              {(insight.author === author || isAdminMode()) && (
                <button
                  onClick={() => handleDelete(insight.id)}
                  className="text-gray-600 hover:text-red-500 px-1"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
        {weekInsights.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-3">아직 등록된 인사이트가 없어요</p>
        )}
      </div>
    </div>
  )
}
