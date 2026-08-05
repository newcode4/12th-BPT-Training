import { useState, useEffect, useRef } from 'react'
import { ChevronDown, PlayCircle } from 'lucide-react'
import { loadYouTubeAPI } from '../utils/youtube'

// 전체 라이브 다시보기 (날짜순 원본 아카이브) - YYMMDD, videoId
const ALL_REPLAYS = [
  { date: '260804', videoId: 'RIBFaQZL7no' },
  { date: '260803', videoId: 'fGxzSRnk27E' },
  { date: '260730', videoId: '7cVHdAIKNyY' },
  { date: '260729', videoId: 'rVScZPpUAh4' },
  { date: '260728', videoId: '6kh3NEIy64o' },
  { date: '260727', videoId: 'fnhkwUUw1IY' },
  { date: '260724', videoId: 'wVXtAYVNVN8' },
  { date: '260723', videoId: '-lKqaN2CRkM' },
  { date: '260722', videoId: '6vOkmI4gE7Q' },
  { date: '260721', videoId: 'fzLgpb6pNAc' },
  { date: '260720', videoId: 'r7GNZoB_uM4' },
]

function formatArchiveDate(yymmdd) {
  const yy = yymmdd.slice(0, 2)
  const mm = yymmdd.slice(2, 4)
  const dd = yymmdd.slice(4, 6)
  return `20${yy}.${mm}.${dd}`
}

export default function AllReplaysArchive() {
  const [open, setOpen] = useState(false)
  const [activeVideoId, setActiveVideoId] = useState(null)
  const mountRef = useRef(null)
  const playerRef = useRef(null)

  useEffect(() => {
    if (!activeVideoId) return
    let cancelled = false
    loadYouTubeAPI().then((YT) => {
      if (cancelled || !mountRef.current) return
      if (playerRef.current) {
        playerRef.current.loadVideoById(activeVideoId)
      } else {
        playerRef.current = new YT.Player(mountRef.current, {
          videoId: activeVideoId,
          playerVars: { rel: 0 },
        })
      }
    })
    return () => { cancelled = true }
  }, [activeVideoId])

  useEffect(() => {
    return () => { playerRef.current?.destroy?.() }
  }, [])

  return (
    <div className="bg-surface rounded-2xl shadow-card border border-white/10 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 md:p-6"
      >
        <span className="flex items-center gap-2 text-sm font-extrabold text-gray-400">
          <PlayCircle size={16} className="text-gray-500" />
          전체 라이브 다시보기 ({ALL_REPLAYS.length})
        </span>
        <ChevronDown size={18} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="p-4 md:p-6 pt-0 space-y-4">
          {/* 날짜 토글 필터 */}
          <div className="flex flex-wrap gap-2">
            {ALL_REPLAYS.map((r) => (
              <button
                key={r.videoId}
                onClick={() => setActiveVideoId(r.videoId)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition ${
                  activeVideoId === r.videoId
                    ? 'bg-brand text-white'
                    : 'bg-surface-alt text-gray-400 hover:bg-white/10 hover:text-gray-200'
                }`}
              >
                {formatArchiveDate(r.date)}
              </button>
            ))}
          </div>

          {activeVideoId ? (
            <div className="aspect-video rounded-xl overflow-hidden bg-black">
              <div ref={mountRef} className="w-full h-full" />
            </div>
          ) : (
            <p className="text-xs text-gray-500 text-center py-4">
              위 날짜를 누르면 바로 그 회차 영상을 볼 수 있어요
            </p>
          )}
        </div>
      )}
    </div>
  )
}
