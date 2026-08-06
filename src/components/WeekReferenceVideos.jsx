import { useState, useEffect, useRef } from 'react'
import { Bookmark, Trash2, PlayCircle, Plus, ShieldCheck, ChevronDown } from 'lucide-react'
import { parseHMSToSeconds, hmsToSeconds, formatTime, generateUUID } from '../utils/formatters'
import { listRecords, putRecord, removeRecord } from '../utils/cloudStore'
import { loadYouTubeAPI, parseYouTubeUrl } from '../utils/youtube'
import { isAdminMode } from '../utils/admin'
import TimeHMSInput from './TimeHMSInput'

function RefScrapEditor({ scrap, onJump, onUpdate, onDelete }) {
  const [title, setTitle] = useState(scrap.title || '')
  const [note, setNote] = useState(scrap.note || '')
  const dirtyRef = useRef(false)

  useEffect(() => {
    if (!dirtyRef.current) return
    const t = setTimeout(() => onUpdate(scrap.id, title, note), 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, note])

  return (
    <div className="p-2.5 bg-surface-alt rounded-xl space-y-1.5">
      <div className="flex items-start gap-2">
        <button
          onClick={() => onJump(scrap.timestamp)}
          className="flex items-center gap-1 text-xs font-mono font-bold text-brand shrink-0 mt-2"
        >
          <PlayCircle size={13} />
          {formatTime(scrap.timestamp)}
        </button>
        <div className="flex-1 min-w-0 space-y-1">
          <input
            type="text"
            value={title}
            onChange={(e) => { dirtyRef.current = true; setTitle(e.target.value) }}
            placeholder="소제목"
            className="w-full text-sm font-bold p-1.5 bg-surface border border-white/10 rounded-lg focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
          <textarea
            value={note}
            onChange={(e) => { dirtyRef.current = true; setNote(e.target.value) }}
            placeholder="이 장면에서 배운 점을 적어보세요"
            rows="2"
            className="w-full text-sm p-1.5 bg-surface border border-white/10 rounded-lg resize-none focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
          {scrap.author && <p className="text-[10px] text-gray-500">{scrap.author}</p>}
        </div>
        <button onClick={() => onDelete(scrap.id)} className="text-gray-600 hover:text-red-500 shrink-0 mt-2">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// 각 주차 예시 시뮬레이션 영상 (매니저/팀장님 실전 영상)
const REFERENCE_VIDEOS = {
  '0': [
    { presenter: '주호 팀장님', videoId: 'r7GNZoB_uM4', startLabel: '5:23:49' },
  ],
  '1': [
    { presenter: '이아름 매니저님', videoId: 'WsoB0Gy-IXM', startLabel: '4:12:30', endLabel: '5:02:35' },
    { presenter: '주호 팀장님', videoId: '-lKqaN2CRkM', startLabel: '4:18:42' },
  ],
  '2': [
    { presenter: '이아름 매니저님', videoId: '5HC6s043Frg', startLabel: '6:03:00', endLabel: '6:58:03' },
    { presenter: '주호 팀장님', videoId: 'fnhkwUUw1IY', startLabel: '6:26:29' },
  ],
  '3': [
    { presenter: '이아름 매니저님', videoId: 'pSVmTM7NYUg', startLabel: '2:02:00', endLabel: '2:49:30' },
    { presenter: '주호 팀장님', videoId: 'rVScZPpUAh4', startLabel: '4:58:14' },
  ],
  '4': [
    { presenter: '이아름 매니저님', videoId: 'WfmLlaUEvaQ', startLabel: '5:32:00', endLabel: '6:21:40' },
    { presenter: '주호 팀장님', videoId: 'fGxzSRnk27E', startLabel: '5:8:20' },
  ],
}

function ReferenceVideoCard({ video }) {
  const startSec = parseHMSToSeconds(video.startLabel)
  const mountRef = useRef(null)
  const playerRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [scraps, setScraps] = useState([])
  const [noteDraft, setNoteDraft] = useState(null) // { timestamp, text } or null
  const author = localStorage.getItem('qa-author') || '익명'

  useEffect(() => {
    setReady(false)
    setScraps([])
    // 예시 영상 스크랩은 개인 메모라 본인 것만 불러온다 (다른 사람에게 보이거나 지워지면 안 됨)
    listRecords('ref_scrap', { author })
      .then((rows) => setScraps(
        rows.filter(s => s.videoId === video.videoId).sort((a, b) => a.timestamp - b.timestamp)
      ))
      .catch(() => {})
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
    setNoteDraft({ timestamp: t, title: '', text: '' })
  }

  const handleSaveScrap = () => {
    if (!noteDraft) return
    const scrap = {
      id: generateUUID(),
      videoId: video.videoId,
      timestamp: noteDraft.timestamp,
      title: noteDraft.title.trim(),
      note: noteDraft.text.trim(),
      author,
      createdAt: new Date().toISOString(),
    }
    setScraps([...scraps, scrap].sort((a, b) => a.timestamp - b.timestamp))
    setNoteDraft(null)
    putRecord('ref_scrap', scrap, { author })
      .catch(e => alert('스크랩 저장에 실패했어요: ' + e.message))
  }

  const handleUpdateScrap = (id, title, note) => {
    setScraps((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, title, note } : s))
      const target = next.find((s) => s.id === id)
      if (target) {
        putRecord('ref_scrap', target, { author: target.author || author })
          .catch(e => console.error('스크랩 수정 실패', e))
      }
      return next
    })
  }

  const handleJump = (t) => {
    playerRef.current?.seekTo(t, true)
    playerRef.current?.playVideo()
  }

  const handleDelete = (id) => {
    setScraps(scraps.filter((s) => s.id !== id))
    removeRecord('ref_scrap', id).catch(e => console.error('스크랩 삭제 실패', e))
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
          <input
            type="text"
            autoFocus
            value={noteDraft.title}
            onChange={(e) => setNoteDraft({ ...noteDraft, title: e.target.value })}
            placeholder="소제목"
            className="w-full text-sm font-bold p-2.5 border border-white/10 rounded-xl focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
          <textarea
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
            <RefScrapEditor
              key={s.id}
              scrap={s}
              onJump={handleJump}
              onUpdate={handleUpdateScrap}
              onDelete={handleDelete}
            />
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
    onAdded(video)
    setPresenter('')
    setUrl('')
    setHms({ hours: 0, minutes: 0, seconds: 0 })
    putRecord('admin_video', video, { week })
      .catch(e => alert('예시 영상 저장에 실패했어요: ' + e.message))
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
  const [adminVideos, setAdminVideos] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [open, setOpen] = useState(true)
  const admin = isAdminMode()

  useEffect(() => {
    let cancelled = false
    setSelectedIndex(0)
    setAdminVideos([])
    listRecords('admin_video', { week })
      .then((rows) => { if (!cancelled) setAdminVideos(rows) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [week])

  const handleDeleteAdminVideo = (id) => {
    const next = adminVideos.filter(v => v.id !== id)
    setAdminVideos(next)
    if (selectedIndex >= (REFERENCE_VIDEOS[week] || []).length + next.length) {
      setSelectedIndex(0)
    }
    removeRecord('admin_video', id).catch(e => console.error('예시 영상 삭제 실패', e))
  }

  const curated = REFERENCE_VIDEOS[week] || []
  const videos = [...curated, ...adminVideos]
  const selected = videos[selectedIndex] || videos[0]

  return (
    <div className="bg-surface rounded-2xl shadow-card border border-white/10 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 md:p-6"
      >
        <h3 className="text-lg font-extrabold">예시 시뮬레이션 영상</h3>
        <ChevronDown size={18} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="p-4 md:p-6 pt-0 space-y-4">
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
      )}
    </div>
  )
}
