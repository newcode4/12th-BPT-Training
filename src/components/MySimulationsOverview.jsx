import { useState, useEffect, useRef } from 'react'
import { Plus, ChevronDown, Trash2, Check } from 'lucide-react'
import { loadYouTubeAPI, parseYouTubeUrl } from '../utils/youtube'

function InlinePlayer({ videoId }) {
  const mountRef = useRef(null)
  const playerRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    loadYouTubeAPI().then((YT) => {
      if (cancelled || !mountRef.current) return
      playerRef.current = new YT.Player(mountRef.current, {
        videoId,
        playerVars: { rel: 0 },
      })
    })
    return () => {
      cancelled = true
      playerRef.current?.destroy?.()
    }
  }, [videoId])

  return (
    <div className="aspect-video rounded-xl overflow-hidden bg-black">
      <div ref={mountRef} className="w-full h-full" />
    </div>
  )
}

function SimulationCard({ index, analysis, expanded, onToggle, onSaveFeedback, onDelete }) {
  const [feedback, setFeedback] = useState(analysis.feedback || '')
  const [savedAt, setSavedAt] = useState(null)
  const dirtyRef = useRef(false)

  // 다른 곳에서 이 분석이 갱신되면(예: 삭제 후 재추가) 입력값도 따라간다
  useEffect(() => {
    if (dirtyRef.current) return
    setFeedback(analysis.feedback || '')
  }, [analysis.feedback])

  useEffect(() => {
    if (!dirtyRef.current) return
    const t = setTimeout(() => {
      onSaveFeedback(analysis.id, feedback)
      setSavedAt(Date.now())
    }, 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback])

  const canPlayInline = analysis.source === 'youtube'
  const label = analysis.title || (analysis.source === 'youtube' ? `유튜브 · ${analysis.videoId}` : analysis.filename)

  return (
    <div className="border border-white/10 rounded-2xl overflow-hidden bg-surface">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-white/[0.02] transition"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 w-8 h-8 rounded-full bg-brand-light text-brand font-extrabold text-sm flex items-center justify-center">
            {index}
          </span>
          <div className="min-w-0">
            <p className="font-bold truncate">{index}번째 시뮬레이션 · {label}</p>
            <p className="text-xs text-gray-500 truncate">
              {new Date(analysis.uploadedAt).toLocaleString('ko-KR')}
              {analysis.feedback ? ' · 피드백 작성함' : ''}
            </p>
          </div>
        </div>
        <ChevronDown size={18} className={`shrink-0 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="anim-pop p-4 pt-0 space-y-3">
          {canPlayInline ? (
            <InlinePlayer videoId={analysis.videoId} />
          ) : (
            <p className="text-xs text-gray-500 bg-surface-alt rounded-xl p-3">
              업로드한 파일은 여기서 바로 재생할 수 없어요. 아래 "내 시뮬레이션 분석"에서 파일을 다시 올리면 이어서 볼 수 있어요.
            </p>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-bold text-gray-400">이 시뮬레이션에 대한 피드백</p>
              {savedAt && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                  <Check size={11} />
                  저장됨
                </span>
              )}
            </div>
            <textarea
              value={feedback}
              onChange={(e) => { dirtyRef.current = true; setFeedback(e.target.value) }}
              placeholder="느낀 점, 개선할 점을 적어보세요"
              rows="3"
              className="w-full p-3 bg-surface-alt border border-white/10 rounded-xl text-sm resize-none focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>

          <button
            onClick={() => onDelete(analysis.id)}
            className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-red-500"
          >
            <Trash2 size={12} />
            이 시뮬레이션 삭제
          </button>
        </div>
      )}
    </div>
  )
}

// 내가 등록한 시뮬레이션을 주차/폴더 상관없이 순서대로 모아 보여준다.
// 링크만 붙여넣으면 바로 등록되고, 클릭하면 그 자리에서 펼쳐져 재생 + 피드백 작성까지 끝낼 수 있다.
// (예전에는 클릭하면 페이지 아래 다른 섹션으로 이동해야 해서 번거로웠다.)
export default function MySimulationsOverview({ analyses, onAddLink, onSaveFeedback, onDelete }) {
  const [linkInput, setLinkInput] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [adding, setAdding] = useState(false)

  const sorted = [...analyses].sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt))

  const handleAdd = async () => {
    const url = linkInput.trim()
    const videoId = parseYouTubeUrl(url)
    if (!videoId) {
      alert('올바른 유튜브 링크를 입력해주세요.')
      return
    }
    setAdding(true)
    const created = await onAddLink(url)
    setAdding(false)
    setLinkInput('')
    if (created) setExpandedId(created.id)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={linkInput}
          onChange={(e) => setLinkInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="https://youtu.be/xxxxxxxxxxx"
          className="flex-1 min-w-0 p-3 bg-surface-alt border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !linkInput.trim()}
          className="flex items-center gap-1.5 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-bold px-4 rounded-xl text-sm transition shrink-0"
        >
          <Plus size={15} />
          추가
        </button>
      </div>

      <div className="space-y-2">
        {sorted.map((a, i) => (
          <SimulationCard
            key={a.id}
            index={i + 1}
            analysis={a}
            expanded={expandedId === a.id}
            onToggle={() => setExpandedId(expandedId === a.id ? null : a.id)}
            onSaveFeedback={onSaveFeedback}
            onDelete={(id) => {
              if (expandedId === id) setExpandedId(null)
              onDelete(id)
            }}
          />
        ))}
        {sorted.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">
            아직 등록한 시뮬레이션이 없어요. 위에 유튜브 링크를 붙여넣고 추가해보세요
          </p>
        )}
      </div>
    </div>
  )
}
