import { useState, useEffect, useRef } from 'react'
import { Bookmark, Trash2, PlayCircle } from 'lucide-react'
import { parseHMSToSeconds, formatTime, generateUUID, formatDate } from '../utils/formatters'
import { getRefScraps, saveRefScrap, deleteRefScrap } from '../utils/storage'
import { loadYouTubeAPI } from '../utils/youtube'

// 각 주차 예시 시뮬레이션 영상 (매니저/과장님 실전 영상)
const REFERENCE_VIDEOS = {
  '1': [{ presenter: '이아름 매니저', videoId: 'WsoB0Gy-IXM', startLabel: '4:12:30', endLabel: '5:02:35' }],
  '2': [{ presenter: '이아름 매니저', videoId: '5HC6s043Frg', startLabel: '6:03:00', endLabel: '6:58:03' }],
  '3': [{ presenter: '이아름 매니저', videoId: 'pSVmTM7NYUg', startLabel: '2:02:00', endLabel: '2:49:30' }],
  '4': [{ presenter: '이아름 매니저', videoId: 'WfmLlaUEvaQ', startLabel: '5:32:00', endLabel: '6:21:40' }],
}

function ReferenceVideoCard({ video }) {
  const startSec = parseHMSToSeconds(video.startLabel)
  const mountRef = useRef(null)
  const playerRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [scraps, setScraps] = useState(() => getRefScraps(video.videoId))
  const [noteDraft, setNoteDraft] = useState(null) // { timestamp, text } or null

  useEffect(() => {
    let cancelled = false
    loadYouTubeAPI().then((YT) => {
      if (cancelled || !mountRef.current) return
      playerRef.current = new YT.Player(mountRef.current, {
        videoId: video.videoId,
        playerVars: { start: startSec, rel: 0 },
        events: {
          onReady: () => setReady(true),
        },
      })
    })
    return () => {
      cancelled = true
      playerRef.current?.destroy?.()
    }
  }, [video.videoId])

  const handleStartScrap = () => {
    if (!playerRef.current) return
    const t = Math.floor(playerRef.current.getCurrentTime())
    setNoteDraft({ timestamp: t, text: '' })
  }

  const handleSaveScrap = () => {
    if (!noteDraft) return
    const scrap = {
      id: generateUUID(),
      videoId: video.videoId,
      timestamp: noteDraft.timestamp,
      note: noteDraft.text.trim(),
      createdAt: new Date().toISOString(),
    }
    saveRefScrap(scrap)
    setScraps([...scraps, scrap].sort((a, b) => a.timestamp - b.timestamp))
    setNoteDraft(null)
  }

  const handleJump = (t) => {
    playerRef.current?.seekTo(t, true)
    playerRef.current?.playVideo()
  }

  const handleDelete = (id) => {
    deleteRefScrap(id)
    setScraps(scraps.filter((s) => s.id !== id))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-gray-200">{video.presenter}</span>
        <span className="text-xs text-gray-500">시간 {video.startLabel} ~ {video.endLabel}</span>
      </div>

      <div className="aspect-video rounded-xl overflow-hidden bg-black">
        <div ref={mountRef} className="w-full h-full" />
      </div>

      <button
        onClick={handleStartScrap}
        disabled={!ready}
        className="w-full flex items-center justify-center gap-1.5 bg-brand-light hover:bg-red-500/20 disabled:opacity-50 text-brand font-bold py-2.5 rounded-xl text-sm transition"
      >
        <Bookmark size={15} />
        지금 이 장면 스크랩하기
      </button>

      {noteDraft && (
        <div className="p-3 bg-surface-alt rounded-xl space-y-2">
          <p className="text-xs font-mono font-bold text-brand">{formatTime(noteDraft.timestamp)}</p>
          <textarea
            autoFocus
            value={noteDraft.text}
            onChange={(e) => setNoteDraft({ ...noteDraft, text: e.target.value })}
            placeholder="이 장면에서 배운 점을 적어보세요"
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

      {scraps.length > 0 && (
        <div className="space-y-1.5">
          {scraps.map((s) => (
            <div key={s.id} className="flex items-start gap-2 p-2.5 bg-surface-alt rounded-xl">
              <button
                onClick={() => handleJump(s.timestamp)}
                className="flex items-center gap-1 text-xs font-mono font-bold text-brand shrink-0 mt-0.5"
              >
                <PlayCircle size={13} />
                {formatTime(s.timestamp)}
              </button>
              <p className="flex-1 text-sm text-gray-200">{s.note || '(메모 없음)'}</p>
              <button onClick={() => handleDelete(s.id)} className="text-gray-600 hover:text-red-500 shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function WeekReferenceVideos({ week }) {
  const videos = REFERENCE_VIDEOS[week] || []

  if (videos.length === 0) {
    return (
      <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6">
        <h3 className="text-lg font-extrabold mb-2">예시 시뮬레이션 영상</h3>
        <p className="text-sm text-gray-500">이번 주차는 아직 등록된 예시 영상이 없어요.</p>
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6 space-y-5">
      <h3 className="text-lg font-extrabold">예시 시뮬레이션 영상</h3>
      {videos.map((v) => (
        <ReferenceVideoCard key={v.videoId} video={v} />
      ))}
    </div>
  )
}
