import { useState, useEffect, useRef } from 'react'
import { Bookmark, Trash2, Play } from 'lucide-react'
import { formatTime } from '../utils/formatters'
import { loadYouTubeAPI } from '../utils/youtube'

function ScrapMiniEditor({ scrap, onJump, onUpdate, onDelete }) {
  const [title, setTitle] = useState(scrap.title || '')
  const [note, setNote] = useState(scrap.note || '')
  const dirtyRef = useRef(false)

  // 타이핑마다 저장하지 않고, 입력이 멈추면 저장한다
  useEffect(() => {
    if (!dirtyRef.current) return
    const t = setTimeout(() => onUpdate(scrap.id, title, note), 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, note])

  return (
    <div className="p-3 bg-surface-alt rounded-xl space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onJump}
          className="flex items-center gap-1 text-brand font-mono font-bold text-xs shrink-0"
        >
          <Play size={10} fill="currentColor" />
          {formatTime(scrap.timestamp)}
        </button>
        <button onClick={() => onDelete(scrap.id)} className="text-gray-600 hover:text-red-500 shrink-0">
          <Trash2 size={13} />
        </button>
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => { dirtyRef.current = true; setTitle(e.target.value) }}
        placeholder="소제목 (예: 가격 질문 대처)"
        className="w-full text-sm font-bold p-2 border border-white/10 rounded-lg bg-surface focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
      />
      <textarea
        value={note}
        onChange={(e) => { dirtyRef.current = true; setNote(e.target.value) }}
        placeholder="느낀 점, 개선하고 싶은 점을 적어보세요"
        rows="2"
        spellCheck={false}
        className="w-full text-sm p-2 border border-white/10 rounded-lg bg-surface resize-none focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
      />
    </div>
  )
}

export default function MyYoutubeAnalysis({ videoId, startSeconds, scraps, onAddScrap, onUpdateScrap, onDeleteScrap }) {
  const mountRef = useRef(null)
  const playerRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [noteDraft, setNoteDraft] = useState(null)

  useEffect(() => {
    let cancelled = false
    setReady(false)
    loadYouTubeAPI().then((YT) => {
      if (cancelled || !mountRef.current) return
      playerRef.current = new YT.Player(mountRef.current, {
        videoId,
        playerVars: { start: startSeconds, rel: 0 },
        events: { onReady: () => setReady(true) },
      })
    })
    return () => {
      cancelled = true
      playerRef.current?.destroy?.()
    }
  }, [videoId, startSeconds])

  const handleStartScrap = () => {
    if (!playerRef.current) return
    const t = Math.floor(playerRef.current.getCurrentTime())
    setNoteDraft({ timestamp: t, title: '', text: '' })
  }

  const handleSaveScrap = () => {
    if (!noteDraft) return
    onAddScrap(noteDraft.timestamp, noteDraft.title.trim(), noteDraft.text.trim())
    setNoteDraft(null)
  }

  const handleChipClick = (scrap) => {
    playerRef.current?.seekTo(scrap.timestamp, true)
    playerRef.current?.playVideo()
  }

  const sortedScraps = [...scraps].sort((a, b) => a.timestamp - b.timestamp)

  return (
    <div className="space-y-3">
      <div className="aspect-video rounded-xl overflow-hidden bg-black">
        <div ref={mountRef} className="w-full h-full" />
      </div>

      <button
        onClick={handleStartScrap}
        disabled={!ready}
        className="w-full flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition"
      >
        <Bookmark size={16} />
        지금 이 장면 스크랩하기
      </button>

      {noteDraft && (
        <div className="p-3 bg-surface-alt rounded-xl space-y-2">
          <p className="text-xs font-mono font-bold text-brand">{formatTime(noteDraft.timestamp)}</p>
          <input
            type="text"
            autoFocus
            value={noteDraft.title}
            onChange={(e) => setNoteDraft({ ...noteDraft, title: e.target.value })}
            placeholder="소제목 (예: 가격 질문 대처)"
            className="w-full text-sm font-bold p-2.5 border border-white/10 rounded-xl focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
          <textarea
            value={noteDraft.text}
            onChange={(e) => setNoteDraft({ ...noteDraft, text: e.target.value })}
            placeholder="느낀 점, 개선하고 싶은 점을 적어보세요"
            spellCheck={false}
            className="w-full text-sm p-2.5 border border-white/10 rounded-xl resize-none focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            rows="2"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setNoteDraft(null)}
              className="flex-1 bg-white/10 hover:bg-white/15 text-gray-400 font-bold py-2 rounded-lg text-sm transition"
            >
              취소
            </button>
            <button
              onClick={handleSaveScrap}
              className="flex-1 bg-brand hover:bg-brand-dark text-white font-bold py-2 rounded-lg text-sm transition"
            >
              저장
            </button>
          </div>
        </div>
      )}

      {/* 떠다니는 스크랩 칩 - 클릭하면 바로 그 지점부터 재생 */}
      {sortedScraps.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sortedScraps.map((s) => (
            <button
              key={s.id}
              onClick={() => handleChipClick(s)}
              className="flex items-center gap-1 text-brand font-mono font-bold text-xs bg-brand-light rounded-full px-3 py-1"
            >
              <Play size={10} fill="currentColor" />
              {formatTime(s.timestamp)}
              {s.title && <span className="font-sans font-bold ml-1 max-w-[8rem] truncate">{s.title}</span>}
            </button>
          ))}
        </div>
      )}

      {sortedScraps.length > 0 && (
        <div className="space-y-2">
          {sortedScraps.map((s) => (
            <ScrapMiniEditor
              key={s.id}
              scrap={s}
              onJump={() => handleChipClick(s)}
              onUpdate={onUpdateScrap}
              onDelete={onDeleteScrap}
            />
          ))}
        </div>
      )}
    </div>
  )
}
