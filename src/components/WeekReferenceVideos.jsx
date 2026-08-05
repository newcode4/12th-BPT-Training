import { useState, useEffect, useRef } from 'react'
import { Bookmark, Trash2, PlayCircle, Plus, ShieldCheck } from 'lucide-react'
import { parseHMSToSeconds, hmsToSeconds, formatTime, generateUUID } from '../utils/formatters'
import { getRefScraps, saveRefScrap, deleteRefScrap, getAdminReferenceVideos, saveAdminReferenceVideo, deleteAdminReferenceVideo } from '../utils/storage'
import { loadYouTubeAPI, parseYouTubeUrl } from '../utils/youtube'
import { isAdminMode } from '../utils/admin'
import TimeHMSInput from './TimeHMSInput'

// 각 주차 예시 시뮬레이션 영상 (매니저/팀장님 실전 영상)
const REFERENCE_VIDEOS = {
  '0': [
    { presenter: '주호 팀장님', videoId: 'r7GNZoB_uM4', startLabel: '5:23:49' },
  ],
  '1': [
    { presenter: '이아름 매니저', videoId: 'WsoB0Gy-IXM', startLabel: '4:12:30', endLabel: '5:02:35' },
    { presenter: '주호 팀장님', videoId: '-lKqaN2CRkM', startLabel: '4:18:42' },
  ],
  '2': [
    { presenter: '이아름 매니저', videoId: '5HC6s043Frg', startLabel: '6:03:00', endLabel: '6:58:03' },
    { presenter: '주호 팀장님', videoId: 'fnhkwUUw1IY', startLabel: '6:26:29' },
  ],
  '3': [
    { presenter: '이아름 매니저', videoId: 'pSVmTM7NYUg', startLabel: '2:02:00', endLabel: '2:49:30' },
    { presenter: '주호 팀장님', videoId: 'rVScZPpUAh4', startLabel: '4:58:14' },
  ],
  '4': [
    { presenter: '이아름 매니저', videoId: 'WfmLlaUEvaQ', startLabel: '5:32:00', endLabel: '6:21:40' },
    { presenter: '주호 팀장님', videoId: 'fGxzSRnk27E', startLabel: '5:8:20' },
  ],
}

function ReferenceVideoCard({ video }) {
  const startSec = parseHMSToSeconds(video.startLabel)
  const mountRef = useRef(null)
  const playerRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [scraps, setScraps] = useState(() => getRefScraps(video.videoId))
  const [noteDraft, setNoteDraft] = useState(null) // { timestamp, text } or null

  useEffect(() => {
    setReady(false)
    setScraps(getRefScraps(video.videoId))
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
  }, [video.videoId, startSec])

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
        <span className="text-xs text-gray-500">
          {video.startLabel}{video.endLabel ? ` ~ ${video.endLabel}` : ''} 부터 시작
        </span>
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

function AdminAddVideoForm({ week, onAdded }) {
  const [presenter, setPresenter] = useState('')
  const [url, setUrl] = useState('')
  const [hms, setHms] = useState({ hours: 0, minutes: 0, seconds: 0 })

  const handleAdd = () => {
    const videoId = parseYouTubeUrl(url.trim())
    if (!videoId || !presenter.trim()) {
      alert('발표자 이름과 올바른 유튜브 링크를 입력해주세요.')
      return
    }
    const startSeconds = hmsToSeconds(hms.hours, hms.minutes, hms.seconds)
    const video = {
      id: generateUUID(),
      week,
      presenter: presenter.trim(),
      videoId,
      startLabel: `${hms.hours}:${String(hms.minutes).padStart(2, '0')}:${String(hms.seconds).padStart(2, '0')}`,
      startSeconds,
    }
    saveAdminReferenceVideo(video)
    onAdded(video)
    setPresenter('')
    setUrl('')
    setHms({ hours: 0, minutes: 0, seconds: 0 })
  }

  return (
    <div className="bg-surface-alt rounded-xl p-4 space-y-2 border border-brand/20">
      <p className="flex items-center gap-1.5 text-xs font-bold text-brand">
        <ShieldCheck size={13} />
        관리자 · 예시 영상 추가
      </p>
      <input
        type="text"
        value={presenter}
        onChange={(e) => setPresenter(e.target.value)}
        placeholder="발표자 이름 (예: 이아름 매니저)"
        className="w-full p-2.5 border border-white/10 rounded-xl text-sm bg-surface focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
      />
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://youtu.be/xxxxxxxxxxx"
        className="w-full p-2.5 border border-white/10 rounded-xl text-sm bg-surface focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
      />
      <TimeHMSInput
        hours={hms.hours}
        minutes={hms.minutes}
        seconds={hms.seconds}
        onChange={setHms}
        label="시작 시간"
      />
      <button
        onClick={handleAdd}
        className="w-full flex items-center justify-center gap-1.5 bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-xl text-sm transition"
      >
        <Plus size={14} />
        추가
      </button>
    </div>
  )
}

export default function WeekReferenceVideos({ week }) {
  const [adminVideos, setAdminVideos] = useState(() => getAdminReferenceVideos(week))
  const [selectedIndex, setSelectedIndex] = useState(0)
  const admin = isAdminMode()

  useEffect(() => {
    setAdminVideos(getAdminReferenceVideos(week))
    setSelectedIndex(0)
  }, [week])

  const handleDeleteAdminVideo = (id) => {
    const idx = adminVideos.findIndex(v => v.id === id)
    deleteAdminReferenceVideo(id)
    const next = adminVideos.filter(v => v.id !== id)
    setAdminVideos(next)
    if (selectedIndex >= (REFERENCE_VIDEOS[week] || []).length + next.length) {
      setSelectedIndex(0)
    }
  }

  const curated = REFERENCE_VIDEOS[week] || []
  const videos = [...curated, ...adminVideos]
  const selected = videos[selectedIndex] || videos[0]

  return (
    <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6 space-y-4">
      <h3 className="text-lg font-extrabold">예시 시뮬레이션 영상</h3>

      {videos.length === 0 && (
        <p className="text-sm text-gray-500">이번 주차는 아직 등록된 예시 영상이 없어요.</p>
      )}

      {videos.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {videos.map((v, i) => (
            <button
              key={`${v.presenter}-${v.videoId}-${i}`}
              onClick={() => setSelectedIndex(i)}
              className={`px-3 py-1.5 rounded-xl text-sm font-bold transition ${
                selectedIndex === i ? 'bg-brand text-white' : 'bg-surface-alt text-gray-400 hover:bg-white/10'
              }`}
            >
              {v.presenter}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="space-y-3">
          <ReferenceVideoCard video={selected} />
          {selected.id && admin && (
            <button
              onClick={() => handleDeleteAdminVideo(selected.id)}
              className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-red-500"
            >
              <Trash2 size={12} />
              이 영상 삭제 (관리자가 추가함)
            </button>
          )}
        </div>
      )}

      {admin && (
        <AdminAddVideoForm
          week={week}
          onAdded={(video) => setAdminVideos([...adminVideos, video])}
        />
      )}
    </div>
  )
}
