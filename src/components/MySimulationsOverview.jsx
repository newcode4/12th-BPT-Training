import { useState, useEffect, useRef } from 'react'
import { Plus, ChevronDown, ChevronLeft, ChevronRight, Trash2, Pencil, Check, X, Clock } from 'lucide-react'
import { loadYouTubeAPI, parseYouTubeUrl } from '../utils/youtube'
import { hmsToSeconds, secondsToHMS } from '../utils/formatters'
import TimeHMSInput from './TimeHMSInput'

function InlinePlayer({ videoId, startSeconds }) {
  const mountRef = useRef(null)
  const playerRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    loadYouTubeAPI().then((YT) => {
      if (cancelled || !mountRef.current) return
      playerRef.current?.destroy?.()
      playerRef.current = new YT.Player(mountRef.current, {
        videoId,
        playerVars: { rel: 0, start: startSeconds || 0 },
      })
    })
    return () => {
      cancelled = true
      playerRef.current?.destroy?.()
    }
    // videoId가 같아도 시작 시간을 바꾸면 새로 마운트해서 그 지점부터 다시 재생한다
  }, [videoId, startSeconds])

  return (
    <div className="aspect-video rounded-xl overflow-hidden bg-black">
      <div ref={mountRef} className="w-full h-full" />
    </div>
  )
}

function TitleEditor({ analysis, onUpdateMeta }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(analysis.title || '')
  const fallbackLabel = analysis.source === 'youtube' ? `유튜브 · ${analysis.videoId}` : analysis.filename

  const save = () => {
    setEditing(false)
    onUpdateMeta(analysis.id, { title: value.trim() })
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') setEditing(false)
          }}
          placeholder={fallbackLabel}
          className="flex-1 min-w-0 p-1.5 bg-surface-alt border border-brand rounded-lg text-sm font-bold focus:outline-none"
        />
        <button onClick={save} className="shrink-0 text-emerald-400 hover:text-emerald-300">
          <Check size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <p className="font-bold truncate">{analysis.title || fallbackLabel}</p>
      <button
        onClick={(e) => { e.stopPropagation(); setEditing(true) }}
        className="shrink-0 text-gray-600 hover:text-brand"
        title="이름 수정"
      >
        <Pencil size={12} />
      </button>
    </div>
  )
}

function StartTimeEditor({ analysis, onUpdateMeta }) {
  const [open, setOpen] = useState(false)
  const [hms, setHms] = useState(() => secondsToHMS(analysis.startSeconds || 0))

  const apply = () => {
    onUpdateMeta(analysis.id, { startSeconds: hmsToSeconds(hms.hours, hms.minutes, hms.seconds) })
    setOpen(false)
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-brand"
      >
        <Clock size={13} />
        시작 시간 {analysis.startSeconds ? `· ${secondsToHMS(analysis.startSeconds).hours}시 ${secondsToHMS(analysis.startSeconds).minutes}분 ${secondsToHMS(analysis.startSeconds).seconds}초` : '설정'}
      </button>
      {open && (
        <div className="mt-2 p-3 bg-surface-alt rounded-xl space-y-2">
          <TimeHMSInput
            hours={hms.hours}
            minutes={hms.minutes}
            seconds={hms.seconds}
            onChange={setHms}
            label="이 지점부터 재생"
          />
          <button
            onClick={apply}
            className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-2 rounded-lg text-xs transition"
          >
            적용
          </button>
        </div>
      )}
    </div>
  )
}

function FeedbackSection({ analysis, onAddFeedback, onDeleteFeedback }) {
  const [text, setText] = useState('')
  const entries = analysis.feedbackList || []

  const handleAdd = () => {
    if (!text.trim()) return
    onAddFeedback(analysis.id, text.trim())
    setText('')
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-gray-400">내 피드백</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="느낀 점, 개선할 점을 적어보세요"
          className="flex-1 min-w-0 p-2.5 bg-surface-alt border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
        <button
          onClick={handleAdd}
          className="shrink-0 bg-brand hover:bg-brand-dark text-white font-bold px-3.5 rounded-xl text-sm transition"
        >
          추가
        </button>
      </div>

      {entries.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-gray-500">이전 피드백</p>
          {entries.map((f) => (
            <div key={f.id} className="flex items-start justify-between gap-2 p-2.5 bg-surface-alt rounded-xl">
              <div className="min-w-0">
                <p className="text-sm text-gray-200 whitespace-pre-wrap">{f.text}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{new Date(f.createdAt).toLocaleString('ko-KR')}</p>
              </div>
              <button
                onClick={() => onDeleteFeedback(analysis.id, f.id)}
                className="shrink-0 text-gray-600 hover:text-red-500"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SimulationCard({
  index, analysis, expanded, onToggle,
  onUpdateMeta, onAddFeedback, onDeleteFeedback, onDelete,
  hasPrev, hasNext, onPrev, onNext,
}) {
  const canPlayInline = analysis.source === 'youtube'
  const feedbackCount = analysis.feedbackList?.length || 0

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
            <TitleEditor analysis={analysis} onUpdateMeta={onUpdateMeta} />
            <p className="text-xs text-gray-500 truncate">
              {index}번째 시뮬레이션 · {new Date(analysis.uploadedAt).toLocaleString('ko-KR')}
              {feedbackCount > 0 ? ` · 피드백 ${feedbackCount}개` : ''}
            </p>
          </div>
        </div>
        <ChevronDown size={18} className={`shrink-0 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="p-4 pt-0 space-y-4">
          {canPlayInline ? (
            <>
              <InlinePlayer videoId={analysis.videoId} startSeconds={analysis.startSeconds} />
              <StartTimeEditor analysis={analysis} onUpdateMeta={onUpdateMeta} />
            </>
          ) : (
            <p className="text-xs text-gray-500 bg-surface-alt rounded-xl p-3">
              업로드한 파일은 여기서 바로 재생할 수 없어요. 아래 "내 시뮬레이션 분석"에서 파일을 다시 올리면 이어서 볼 수 있어요.
            </p>
          )}

          <FeedbackSection analysis={analysis} onAddFeedback={onAddFeedback} onDeleteFeedback={onDeleteFeedback} />

          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <button
              onClick={() => onDelete(analysis.id)}
              className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-red-500"
            >
              <Trash2 size={12} />
              삭제
            </button>
            <div className="flex items-center gap-1.5">
              <button
                onClick={onPrev}
                disabled={!hasPrev}
                className="p-1.5 rounded-lg bg-surface-alt text-gray-400 disabled:opacity-30 hover:bg-white/10 transition"
                title="이전 시뮬레이션"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={onNext}
                disabled={!hasNext}
                className="p-1.5 rounded-lg bg-surface-alt text-gray-400 disabled:opacity-30 hover:bg-white/10 transition"
                title="다음 시뮬레이션"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 내가 등록한 시뮬레이션을 주차/폴더 상관없이 순서대로 모아 보여준다.
// 링크만 붙여넣으면 바로 등록되고, 클릭하면 그 자리에서 펼쳐져 재생 + 피드백 작성까지 끝낼 수 있다.
export default function MySimulationsOverview({ analyses, onAddLink, onUpdateMeta, onAddFeedback, onDeleteFeedback, onDelete }) {
  const [linkInput, setLinkInput] = useState('')
  const [addHmsOpen, setAddHmsOpen] = useState(false)
  const [addHms, setAddHms] = useState({ hours: 0, minutes: 0, seconds: 0 })
  const [expandedId, setExpandedId] = useState(null)
  const [adding, setAdding] = useState(false)

  const sorted = [...analyses].sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt))
  const expandedIndex = sorted.findIndex((a) => a.id === expandedId)

  const handleAdd = async () => {
    const url = linkInput.trim()
    const videoId = parseYouTubeUrl(url)
    if (!videoId) {
      alert('올바른 유튜브 링크를 입력해주세요.')
      return
    }
    setAdding(true)
    const startSeconds = hmsToSeconds(addHms.hours, addHms.minutes, addHms.seconds)
    const created = await onAddLink(url, startSeconds)
    setAdding(false)
    setLinkInput('')
    setAddHms({ hours: 0, minutes: 0, seconds: 0 })
    setAddHmsOpen(false)
    if (created) setExpandedId(created.id)
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
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
        <button
          onClick={() => setAddHmsOpen((o) => !o)}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-brand"
        >
          <Clock size={12} />
          {addHmsOpen ? '시작 시간 접기' : '시작 시간 설정 (선택)'}
        </button>
        {addHmsOpen && (
          <div className="p-3 bg-surface-alt rounded-xl">
            <TimeHMSInput
              hours={addHms.hours}
              minutes={addHms.minutes}
              seconds={addHms.seconds}
              onChange={setAddHms}
              label="이 지점부터 재생"
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        {sorted.map((a, i) => (
          <SimulationCard
            key={a.id}
            index={i + 1}
            analysis={a}
            expanded={expandedId === a.id}
            onToggle={() => setExpandedId(expandedId === a.id ? null : a.id)}
            onUpdateMeta={onUpdateMeta}
            onAddFeedback={onAddFeedback}
            onDeleteFeedback={onDeleteFeedback}
            onDelete={(id) => {
              if (expandedId === id) setExpandedId(null)
              onDelete(id)
            }}
            hasPrev={expandedId === a.id && expandedIndex > 0}
            hasNext={expandedId === a.id && expandedIndex < sorted.length - 1}
            onPrev={() => setExpandedId(sorted[expandedIndex - 1]?.id ?? null)}
            onNext={() => setExpandedId(sorted[expandedIndex + 1]?.id ?? null)}
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
