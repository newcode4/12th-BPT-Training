import { useState, useEffect, useRef } from 'react'
import { Bookmark, Trash2, Play } from 'lucide-react'
import { formatTime } from '../utils/formatters'
import { loadYouTubeAPI } from '../utils/youtube'

export default function MyYoutubeAnalysis({ videoId, startSeconds, scraps, onAddScrap, onDeleteScrap }) {
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
    setNoteDraft({ timestamp: t, text: '' })
  }

  const handleSaveScrap = () => {
    if (!noteDraft) return
    onAddScrap(noteDraft.timestamp, noteDraft.text.trim())
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
          <textarea
            autoFocus
            value={noteDraft.text}
            onChange={(e) => setNoteDraft({ ...noteDraft, text: e.target.value })}
            placeholder="느낀 점, 개선하고 싶은 점을 적어보세요"
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
            <div key={s.id} className="flex items-center gap-1 bg-brand-light rounded-full pl-3 pr-1 py-1">
              <button
                onClick={() => handleChipClick(s)}
                className="flex items-center gap-1 text-brand font-mono font-bold text-xs"
              >
                <Play size={10} fill="currentColor" />
                {formatTime(s.timestamp)}
              </button>
              <button
                onClick={() => onDeleteScrap(s.id)}
                className="text-brand/50 hover:text-red-600 p-1"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {sortedScraps.some((s) => s.note) && (
        <div className="space-y-1.5">
          {sortedScraps.filter((s) => s.note).map((s) => (
            <p key={s.id} className="text-sm text-gray-300 bg-surface-alt rounded-lg p-2.5">
              <span className="font-mono font-bold text-brand mr-1.5">{formatTime(s.timestamp)}</span>
              {s.note}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
