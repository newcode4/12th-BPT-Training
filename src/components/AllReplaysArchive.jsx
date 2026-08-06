import { useState, useEffect, useRef } from 'react'
import { ChevronDown, PlayCircle, ShieldCheck, Plus, Trash2, FolderPlus, Bookmark, Check, X, Pencil } from 'lucide-react'
import { loadYouTubeAPI, parseYouTubeUrl } from '../utils/youtube'
import { listRecords, putRecord, removeRecord } from '../utils/cloudStore'
import { isAdminMode } from '../utils/admin'
import { generateUUID, parseHMSToSeconds, formatTime } from '../utils/formatters'
import { WEEKS } from '../utils/weeks'

const WEEK_FILTERS = [
  { id: 'all', label: '전체보기' },
  { id: '0', label: '0주차' },
  { id: '1', label: '1주차' },
  { id: '2', label: '2주차' },
  { id: '3', label: '3주차' },
  { id: '0-3', label: '0~3주차 랜덤' },
  { id: '4', label: '4주차' },
  { id: '0-4', label: '0~4주차 랜덤' },
]
const ADMIN_WEEK_OPTIONS = WEEK_FILTERS.filter((f) => f.id !== 'all')

function matchesWeekFilter(filterId, week) {
  if (filterId === 'all') return true
  return String(week ?? '0') === filterId
}

const CURATED_REPLAYS = [
  { date: '260804', videoId: 'RIBFaQZL7no', week: '4' },
  { date: '260803', videoId: 'fGxzSRnk27E', week: '4' },
  { date: '260730', videoId: '7cVHdAIKNyY', week: '0-3' },
  { date: '260729', videoId: 'rVScZPpUAh4', week: '3' },
  { date: '260728', videoId: '6kh3NEIy64o', week: '2' },
  { date: '260727', videoId: 'fnhkwUUw1IY', week: '2' },
  { date: '260724', videoId: 'wVXtAYVNVN8', week: '1' },
  { date: '260723', videoId: '-lKqaN2CRkM', week: '1' },
  { date: '260722', videoId: '6vOkmI4gE7Q', week: '0' },
  { date: '260721', videoId: 'fzLgpb6pNAc', week: '0' },
  { date: '260720', videoId: 'r7GNZoB_uM4', week: '0' },
]

function todayYYMMDD() {
  const d = new Date()
  return String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0')
}

function formatArchiveDate(yymmdd) {
  const yy = yymmdd.slice(0, 2)
  const mm = yymmdd.slice(2, 4)
  const dd = yymmdd.slice(4, 6)
  return `20${yy}.${mm}.${dd}`
}

function defaultWeekFrom(filterId) {
  return ADMIN_WEEK_OPTIONS.some((f) => f.id === filterId) ? filterId : '0'
}

function AdminAddReplayForm({ viewFilter, onAdded }) {
  const [date, setDate] = useState(todayYYMMDD())
  const [url, setUrl] = useState('')
  const [week, setWeek] = useState(() => defaultWeekFrom(viewFilter))

  useEffect(() => {
    setWeek(defaultWeekFrom(viewFilter))
  }, [viewFilter])

  const handleAdd = async () => {
    const videoId = parseYouTubeUrl(url.trim())
    if (!videoId || !/^\d{6}$/.test(date)) {
      alert('날짜(YYMMDD 6자리)와 올바른 유튜브 링크를 입력해주세요.')
      return
    }
    const replay = { id: generateUUID(), date, videoId, week }
    try {
      await putRecord('replay', replay)
      onAdded(replay)
      setUrl('')
    } catch (e) {
      alert('추가에 실패했어요: ' + e.message)
    }
  }

  return (
    <div className="bg-surface-alt rounded-xl p-3 space-y-2 border border-brand/20">
      <p className="flex items-center gap-1.5 text-xs font-bold text-brand">
        <ShieldCheck size={13} />
        관리자 · 오늘 라이브 다시보기 추가
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={date}
          onChange={(e) => setDate(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="YYMMDD"
          className="w-24 shrink-0 p-2.5 border border-white/10 rounded-xl text-sm bg-surface font-mono text-center focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="https://youtu.be/xxxxxxxxxxx 또는 라이브 링크"
          className="flex-1 min-w-0 p-2.5 border border-white/10 rounded-xl text-sm bg-surface focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
      </div>
      <div>
        <p className="text-[11px] text-gray-500 mb-1">소속 필터</p>
        <div className="flex flex-wrap gap-1.5">
          {ADMIN_WEEK_OPTIONS.map((f) => (
            <button
              key={f.id}
              onClick={() => setWeek(f.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                week === f.id ? 'bg-brand text-white' : 'bg-surface text-gray-400 hover:bg-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={handleAdd}
        className="w-full flex items-center justify-center gap-1.5 bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-xl text-sm transition active:scale-95"
      >
        <Plus size={14} />
        추가
      </button>
    </div>
  )
}

// 스크랩 저장 폼: 지금 재생 중인 지점을 자동으로 시작 시분초로 잡고, 주차/카테고리만 확인해서 저장한다.
// 시간을 손으로 입력하게 하면 사람마다 형식이 다르고 딴 데 정신 팔린 사이 시점이 밀려서 꼬이기 쉬워서,
// "저장" 누르는 순간의 실제 재생 위치를 그대로 쓴다.
function ScrapForm({ replay, folders, selectedWeek, author, getCurrentSeconds, onSaved }) {
  const [title, setTitle] = useState('')
  const [memo, setMemo] = useState('')
  const [folder, setFolder] = useState(folders?.[0] || '')
  const [week, setWeek] = useState(selectedWeek || '0')
  const [liveSeconds, setLiveSeconds] = useState(() => getCurrentSeconds?.() || 0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (folders && folders.length > 0 && !folders.includes(folder)) {
      setFolder(folders[0])
    }
  }, [folders])

  useEffect(() => {
    setWeek(selectedWeek || '0')
  }, [selectedWeek])

  // 폼이 떠있는 동안 지금 재생 위치를 계속 보여줘서, 저장 버튼을 누르는 순간의 지점이
  // 뭔지 미리 확인할 수 있게 한다 (실제 저장값도 누르는 순간 다시 읽어서 정확히 맞춘다)
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveSeconds(getCurrentSeconds?.() || 0)
    }, 1000)
    return () => clearInterval(timer)
  }, [getCurrentSeconds])

  const handleSave = async () => {
    if (!title.trim()) {
      alert('제목을 입력해주세요.')
      return
    }
    setSaving(true)
    const scrap = {
      id: generateUUID(),
      videoId: replay.videoId,
      replayDate: replay.date,
      week,
      folder: folder || folders?.[0] || '전체 녹음',
      title: title.trim(),
      timestamp: formatTime(getCurrentSeconds?.() || 0),
      memo: memo.trim(),
      author,
      createdAt: new Date().toISOString(),
    }
    try {
      await putRecord('live_scrap', scrap, { author, week })
      setSaved(true)
      setTitle('')
      setMemo('')
      onSaved?.(scrap)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      alert('스크랩 저장에 실패했어요: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2.5 bg-surface-alt p-3.5 rounded-xl border border-brand/20">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-brand flex items-center gap-1.5">
          <Bookmark size={13} />
          이 영상 스크랩하기
        </p>
        <span className="text-xs font-mono font-bold text-gray-300 bg-surface px-2 py-1 rounded-lg">
          {formatTime(liveSeconds)} 지점
        </span>
      </div>

      {/* 몇 주차 것인지 — 회차가 여러 주차에 걸쳐있을 수 있어서 저장할 때마다 확인한다 */}
      <div>
        <p className="text-[11px] text-gray-500 mb-1">몇 주차인가요?</p>
        <div className="flex flex-wrap gap-1.5">
          {WEEKS.map((w) => (
            <button
              key={w.id}
              onClick={() => setWeek(w.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                week === w.id ? 'bg-brand text-white' : 'bg-surface text-gray-400 hover:bg-white/10'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* 세부 카테고리 */}
      {folders && folders.length > 0 && (
        <div>
          <p className="text-[11px] text-gray-500 mb-1">세부 카테고리</p>
          <select
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            className="w-full p-2.5 bg-surface border border-white/10 rounded-xl text-sm font-bold focus:outline-none focus:border-brand"
          >
            {folders.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      )}

      {/* 제목 */}
      <div>
        <p className="text-[11px] text-gray-500 mb-1">제목 <span className="text-brand">*</span></p>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSave()}
          placeholder="예: 청중 눈 맞춤 포인트"
          className="w-full p-2.5 bg-surface border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
      </div>

      {/* 메모 (선택) */}
      <div>
        <p className="text-[11px] text-gray-500 mb-1">메모 (선택)</p>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="따라하고 싶은 이유나 적용 방법..."
          rows={2}
          className="w-full p-2.5 bg-surface border border-white/10 rounded-xl text-sm resize-none focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !title.trim()}
        className={`w-full flex items-center justify-center gap-1.5 font-bold py-2.5 rounded-xl text-sm transition active:scale-95 disabled:opacity-60 ${
          saved
            ? 'bg-emerald-500 text-white'
            : 'bg-brand hover:bg-brand-dark text-white'
        }`}
      >
        {saved ? <><Check size={15} /> 저장됨!</> : <><FolderPlus size={15} /> {formatTime(liveSeconds)} 지점 저장</>}
      </button>
    </div>
  )
}

// 저장한 스크랩 하나를 고치는 폼 — 저장할 때 쓴 폼과 필드 구성을 맞췄다
function ScrapEditForm({ scrap, folders, getCurrentSeconds, onCancel, onSaved }) {
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
      folder: folder || '전체 녹음',
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
    <div className="space-y-2.5 p-2.5 bg-surface rounded-xl border border-brand/30">
      <div>
        <p className="text-[11px] text-gray-500 mb-1">시작 시분초</p>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
            placeholder="예: 5:39:22"
            className="flex-1 min-w-0 p-2 bg-surface-alt border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:border-brand"
          />
          {getCurrentSeconds && (
            <button
              onClick={() => setTimestamp(formatTime(getCurrentSeconds() || 0))}
              className="shrink-0 px-2.5 rounded-lg bg-surface-alt text-xs font-bold text-brand hover:bg-white/10"
            >
              지금 시간으로
            </button>
          )}
        </div>
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

// 저장한 스크랩 목록 — 녹음 분석의 스크랩처럼, 시분초를 누르면 그 지점부터 다시 볼 수 있다
function ScrapList({ replay, folders, author, refreshKey, getCurrentSeconds, onSeek }) {
  const [scraps, setScraps] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listRecords('live_scrap', { author })
      .then((rows) => {
        if (cancelled) return
        setScraps(
          rows
            .filter((r) => r.videoId === replay.videoId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        )
        setLoading(false)
      })
      .catch((e) => { console.error('스크랩 불러오기 실패', e); setLoading(false) })
    return () => { cancelled = true }
  }, [replay.videoId, author, refreshKey])

  const handleDelete = (id) => {
    setScraps((prev) => prev.filter((s) => s.id !== id))
    removeRecord('live_scrap', id).catch((e) => console.error('스크랩 삭제 실패', e))
  }

  const handleSaved = (updated) => {
    setScraps((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    setEditingId(null)
  }

  if (loading || scraps.length === 0) return null

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-bold text-gray-500">이 영상에서 저장한 스크랩</p>
      {scraps.map((s) => (
        editingId === s.id ? (
          <ScrapEditForm
            key={s.id}
            scrap={s}
            folders={folders}
            getCurrentSeconds={getCurrentSeconds}
            onCancel={() => setEditingId(null)}
            onSaved={handleSaved}
          />
        ) : (
          <div key={s.id} className="flex items-start justify-between gap-2 p-2.5 bg-surface-alt rounded-xl">
            <button
              onClick={() => s.timestamp && onSeek?.(parseHMSToSeconds(s.timestamp))}
              className="min-w-0 text-left flex-1"
            >
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                {s.timestamp && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-brand-light text-brand">
                    {s.timestamp}
                  </span>
                )}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-gray-400">
                  {s.folder}
                </span>
              </div>
              <p className="text-sm font-bold text-gray-200">{s.title}</p>
              {s.memo && <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{s.memo}</p>}
            </button>
            <div className="shrink-0 flex items-center gap-2">
              <button
                onClick={() => setEditingId(s.id)}
                className="text-gray-600 hover:text-brand"
                title="수정"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => handleDelete(s.id)}
                className="text-gray-600 hover:text-red-500"
                title="삭제"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )
      ))}
    </div>
  )
}

export default function AllReplaysArchive({ folders, onWeekChange, selectedWeek: propSelectedWeek }) {
  const [open, setOpen] = useState(false)
  const [activeVideoId, setActiveVideoId] = useState(null)
  const [adminReplays, setAdminReplays] = useState([])
  const [weekFilter, setWeekFilter] = useState('all')
  const [scrapRefreshKey, setScrapRefreshKey] = useState(0)
  const [scrapFormOpen, setScrapFormOpen] = useState(false)
  const mountRef = useRef(null)
  const playerRef = useRef(null)
  const admin = isAdminMode()
  const author = localStorage.getItem('qa-author') || '익명'

  useEffect(() => {
    listRecords('replay').then(setAdminReplays).catch(() => {})
  }, [])

  const curatedFiltered = CURATED_REPLAYS.filter(
    (c) => !adminReplays.some((a) => a.date === c.date)
  )
  const allReplays = [...adminReplays.filter((r) => !r.deleted), ...curatedFiltered].sort((a, b) => b.date.localeCompare(a.date))
  const replays = allReplays.filter((r) => matchesWeekFilter(weekFilter, r.week ?? '0'))
  const activeReplay = replays.find((r) => r.videoId === activeVideoId) || allReplays.find((r) => r.videoId === activeVideoId)

  const handleDelete = (replay) => {
    const isCuratedDate = CURATED_REPLAYS.some((c) => c.date === replay.date)
    if (replay.id && !isCuratedDate) {
      setAdminReplays((prev) => prev.filter((r) => r.id !== replay.id))
      removeRecord('replay', replay.id).catch((e) => console.error('다시보기 삭제 실패', e))
    } else {
      const tombstone = { id: replay.id || generateUUID(), date: replay.date, videoId: replay.videoId, week: replay.week, deleted: true }
      setAdminReplays((prev) => [tombstone, ...prev.filter((r) => r.id !== tombstone.id)])
      putRecord('replay', tombstone).catch((e) => console.error('다시보기 삭제 실패', e))
    }
    if (activeVideoId === replay.videoId) setActiveVideoId(null)
  }

  const handleMoveWeek = (replay, newWeek) => {
    const updated = { id: replay.id || generateUUID(), date: replay.date, videoId: replay.videoId, week: newWeek }
    setAdminReplays((prev) => [updated, ...prev.filter((r) => r.id !== updated.id)])
    putRecord('replay', updated).catch((e) => console.error('회차 주차 변경 실패', e))
  }

  const handleSelectFilter = (filterId) => {
    setWeekFilter(filterId)
    setActiveVideoId(null)
    if (onWeekChange && ['0', '1', '2', '3', '4'].includes(filterId)) {
      onWeekChange(filterId)
    }
  }

  const handleVideoClick = (replay) => {
    setActiveVideoId(replay.videoId)
    setScrapFormOpen(false)
    if (onWeekChange && ['0', '1', '2', '3', '4'].includes(replay.week)) {
      onWeekChange(replay.week)
    }
  }

  useEffect(() => {
    if (!activeVideoId) return
    let cancelled = false
    loadYouTubeAPI().then((YT) => {
      if (cancelled || !mountRef.current) return
      playerRef.current?.destroy?.()
      playerRef.current = new YT.Player(mountRef.current, {
        videoId: activeVideoId,
        playerVars: { rel: 0 },
      })
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
          전체 라이브 다시보기 ({replays.length})
        </span>
        <ChevronDown size={18} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="p-4 md:p-6 pt-0 space-y-4">
          {admin && (
            <AdminAddReplayForm
              viewFilter={weekFilter}
              onAdded={(r) => {
                setAdminReplays([r, ...adminReplays])
                if (matchesWeekFilter(weekFilter, r.week)) setActiveVideoId(r.videoId)
              }}
            />
          )}

          {/* 주차 필터 */}
          <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
            {WEEK_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => handleSelectFilter(f.id)}
                className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  weekFilter === f.id
                    ? 'bg-brand text-white'
                    : 'bg-surface-alt text-gray-400 hover:bg-white/10 hover:text-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* 날짜 토글 필터 */}
          {admin ? (
            <div className="space-y-1.5">
              {replays.map((r) => (
                <div
                  key={r.id || r.videoId}
                  className="flex items-center gap-1.5"
                >
                  <button
                    onClick={() => handleVideoClick(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition ${
                      activeVideoId === r.videoId
                        ? 'bg-brand text-white'
                        : 'bg-surface-alt text-gray-400 hover:bg-white/10 hover:text-gray-200'
                    }`}
                  >
                    {formatArchiveDate(r.date)}
                  </button>
                  <select
                    value={r.week ?? '0'}
                    onChange={(e) => handleMoveWeek(r, e.target.value)}
                    title="이 회차의 소속 필터 옮기기"
                    className="text-[11px] font-bold p-1.5 rounded-lg bg-surface-alt text-gray-300 border border-white/10 focus:outline-none focus:border-brand"
                  >
                    {ADMIN_WEEK_OPTIONS.map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleDelete(r)}
                    className="p-1.5 rounded-lg bg-surface-alt hover:bg-red-500/20 text-gray-500 hover:text-red-400"
                    title="이 회차 삭제"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {replays.length === 0 && (
                <p className="text-xs text-gray-500 py-2">이 범위에는 아직 등록된 회차가 없어요</p>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {replays.map((r) => (
                <button
                  key={r.id || r.videoId}
                  onClick={() => handleVideoClick(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition ${
                    activeVideoId === r.videoId
                      ? 'bg-brand text-white'
                      : 'bg-surface-alt text-gray-400 hover:bg-white/10 hover:text-gray-200'
                  }`}
                >
                  {formatArchiveDate(r.date)}
                </button>
              ))}
              {replays.length === 0 && (
                <p className="text-xs text-gray-500 py-2">이 범위에는 아직 등록된 회차가 없어요</p>
              )}
            </div>
          )}

          {activeVideoId ? (
            <div className="space-y-3">
              <div className="aspect-video rounded-xl overflow-hidden bg-black">
                <div ref={mountRef} className="w-full h-full" />
              </div>

              {/* 스크랩: analysis(내 시뮬레이션)에 넣지 않고 live_scrap에 별도로 저장한다.
                  기본으로는 이미 저장해둔 목록이 먼저 보이는 게 훑어보기 편해서, 새로 추가하는
                  폼은 "스크랩하기" 버튼 뒤에 접어두고 필요할 때만 펼친다. */}
              {activeReplay && (
                <>
                  <button
                    onClick={() => setScrapFormOpen((o) => !o)}
                    className={`w-full flex items-center justify-center gap-1.5 font-bold py-2.5 rounded-xl text-sm transition active:scale-95 ${
                      scrapFormOpen
                        ? 'bg-surface-alt text-gray-300 border border-white/10'
                        : 'bg-brand hover:bg-brand-dark text-white'
                    }`}
                  >
                    <Bookmark size={15} />
                    {scrapFormOpen ? '스크랩 폼 닫기' : '스크랩하기'}
                  </button>

                  {scrapFormOpen && (
                    <ScrapForm
                      replay={activeReplay}
                      folders={folders}
                      selectedWeek={propSelectedWeek || (activeReplay?.week ?? '0')}
                      author={author}
                      getCurrentSeconds={() => playerRef.current?.getCurrentTime?.() || 0}
                      onSaved={() => { setScrapRefreshKey((k) => k + 1); setScrapFormOpen(false) }}
                    />
                  )}

                  <ScrapList
                    replay={activeReplay}
                    folders={folders}
                    author={author}
                    refreshKey={scrapRefreshKey}
                    getCurrentSeconds={() => playerRef.current?.getCurrentTime?.() || 0}
                    onSeek={(seconds) => playerRef.current?.seekTo?.(seconds, true)}
                  />
                </>
              )}
            </div>
          ) : replays.length > 0 && (
            <p className="text-xs text-gray-500 text-center py-4">
              위 날짜를 누르면 바로 그 회차 영상을 볼 수 있어요
            </p>
          )}
        </div>
      )}
    </div>
  )
}
