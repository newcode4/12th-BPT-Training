import { useState, useEffect, useRef } from 'react'
import { Bookmark, Pencil, X, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { loadYouTubeAPI } from '../utils/youtube'
import { putRecord, removeRecord } from '../utils/cloudStore'
import { parseHMSToSeconds } from '../utils/formatters'
import { WEEKS } from '../utils/weeks'

function InlineScrapPlayer({ videoId, startSeconds }) {
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
  }, [videoId, startSeconds])

  return (
    <div className="aspect-video rounded-xl overflow-hidden bg-black">
      <div ref={mountRef} className="w-full h-full" />
    </div>
  )
}

function ScrapEditFields({ scrap, folders, onCancel, onSaved }) {
  const [title, setTitle] = useState(scrap.title || '')
  const [memo, setMemo] = useState(scrap.memo || '')
  const [folder, setFolder] = useState(scrap.folder || folders?.[0] || '')
  const [week, setWeek] = useState(scrap.week || '0')
  const [timestamp, setTimestamp] = useState(scrap.timestamp || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) {
      alert('제목을 입력해주세요.')
      return
    }
    setSaving(true)
    const updated = {
      ...scrap,
      title: title.trim(),
      memo: memo.trim(),
      folder: folder || '전체',
      week,
      timestamp: timestamp.trim(),
    }
    try {
      await putRecord('live_scrap', updated, { author: scrap.author, week })
      onSaved(updated)
    } catch (e) {
      alert('수정에 실패했어요: ' + e.message)
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2.5 p-3 bg-surface rounded-xl border border-brand/30">
      <div>
        <p className="text-[11px] text-gray-500 mb-1">시작 시분초</p>
        <input
          type="text"
          value={timestamp}
          onChange={(e) => setTimestamp(e.target.value)}
          placeholder="예: 5:39:22"
          className="w-full p-2 bg-surface-alt border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:border-brand"
        />
      </div>

      <div>
        <p className="text-[11px] text-gray-500 mb-1">몇 주차인가요?</p>
        <div className="flex flex-wrap gap-1.5">
          {WEEKS.map((w) => (
            <button
              key={w.id}
              onClick={() => setWeek(w.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                week === w.id ? 'bg-brand text-white' : 'bg-surface-alt text-gray-400 hover:bg-white/10'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {folders && folders.length > 0 && (
        <div>
          <p className="text-[11px] text-gray-500 mb-1">세부 카테고리</p>
          <select
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            className="w-full p-2 bg-surface-alt border border-white/10 rounded-lg text-sm font-bold focus:outline-none focus:border-brand"
          >
            {folders.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <p className="text-[11px] text-gray-500 mb-1">제목 <span className="text-brand">*</span></p>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-2 bg-surface-alt border border-white/10 rounded-lg text-sm focus:outline-none focus:border-brand"
        />
      </div>

      <div>
        <p className="text-[11px] text-gray-500 mb-1">메모 (선택)</p>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={2}
          className="w-full p-2 bg-surface-alt border border-white/10 rounded-lg text-sm resize-none focus:outline-none focus:border-brand"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg text-xs font-bold bg-surface-alt text-gray-300 hover:bg-white/10 transition"
        >
          취소
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="flex-1 py-2 rounded-lg text-xs font-bold bg-brand hover:bg-brand-dark text-white transition disabled:opacity-60"
        >
          저장
        </button>
      </div>
    </div>
  )
}

// 지금 보고 있는 주차/카테고리에 걸린 라이브 스크랩만 모아서 보여준다 — 예전엔 "전체 라이브
// 다시보기"에서 날짜를 뒤져야만 찾을 수 있어서, 스크랩한 걸 다시 확인하기가 어려웠다.
// "전체" 카테고리를 보고 있을 땐 이 주차의 모든 카테고리 스크랩을 한꺼번에 보여준다(ALL).
export default function WeekScraps({ scraps, folders, showFolderBadge, onChanged }) {
  const [expandedId, setExpandedId] = useState(null)
  const [editingId, setEditingId] = useState(null)

  if (scraps.length === 0) return null

  const handleDelete = (id) => {
    if (expandedId === id) setExpandedId(null)
    removeRecord('live_scrap', id).catch((e) => console.error('스크랩 삭제 실패', e))
    onChanged()
  }

  return (
    <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6">
      <h3 className="flex items-center gap-2 text-lg font-extrabold mb-1">
        <Bookmark size={18} className="text-gray-500" />
        이 카테고리의 라이브 스크랩 ({scraps.length})
      </h3>
      <p className="text-xs text-gray-500 mb-3">
        라이브 다시보기에서 저장해둔 스크랩이에요. 눌러서 그 지점부터 바로 볼 수 있어요
      </p>
      <div className="space-y-2">
        {scraps.map((s) => {
          const expanded = expandedId === s.id
          const editing = editingId === s.id
          return (
            <div key={s.id} className="border border-white/10 rounded-2xl overflow-hidden">
              {editing ? (
                <div className="p-3">
                  <ScrapEditFields
                    scrap={s}
                    folders={folders}
                    onCancel={() => setEditingId(null)}
                    onSaved={() => { setEditingId(null); onChanged() }}
                  />
                </div>
              ) : (
                <>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedId(expanded ? null : s.id)}
                    className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-white/[0.02] transition cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        {s.timestamp && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-brand-light text-brand">
                            {s.timestamp}
                          </span>
                        )}
                        {showFolderBadge && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-gray-400">
                            {s.folder}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-gray-200 truncate">{s.title}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingId(s.id) }}
                        className="text-gray-600 hover:text-brand"
                        title="수정"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(s.id) }}
                        className="text-gray-600 hover:text-red-500"
                        title="삭제"
                      >
                        <X size={14} />
                      </button>
                      {expanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                    </div>
                  </div>

                  {expanded && (
                    <div className="p-3 pt-0 space-y-2">
                      <InlineScrapPlayer videoId={s.videoId} startSeconds={s.timestamp ? parseHMSToSeconds(s.timestamp) : 0} />
                      {s.memo && <p className="text-xs text-gray-400 whitespace-pre-wrap">{s.memo}</p>}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
