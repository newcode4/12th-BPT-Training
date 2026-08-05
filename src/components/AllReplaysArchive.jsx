import { useState, useEffect, useRef } from 'react'
import { ChevronDown, PlayCircle, ShieldCheck, Plus, Trash2, FolderPlus } from 'lucide-react'
import { loadYouTubeAPI, parseYouTubeUrl } from '../utils/youtube'
import { listRecords, putRecord, removeRecord } from '../utils/cloudStore'
import { isAdminMode } from '../utils/admin'
import { generateUUID } from '../utils/formatters'

// 회차 날짜(YYMMDD)를 주차로 매핑한다. 정규 커리큘럼 시작일 기준.
function dateToWeek(yymmdd) {
  const d = Number(yymmdd)
  if (d < 260723) return '0'
  if (d < 260727) return '1'
  if (d < 260729) return '2'
  if (d < 260803) return '3'
  return '4'
}

const WEEK_FILTERS = [
  { id: 'all', label: '전체보기' },
  { id: '0', label: '0주차' },
  { id: '1', label: '1주차' },
  { id: '2', label: '2주차' },
  { id: '3', label: '3주차' },
  { id: '0-3', label: '0~3주차' },
  { id: '4', label: '4주차' },
  { id: '0-4', label: '0~4주차' },
]

function matchesWeekFilter(filterId, week) {
  if (filterId === 'all') return true
  if (filterId.includes('-')) {
    const [lo, hi] = filterId.split('-').map(Number)
    return Number(week) >= lo && Number(week) <= hi
  }
  return week === filterId
}

// 전체 라이브 다시보기 (날짜순 원본 아카이브) - YYMMDD, videoId
// 관리자가 추가하는 회차는 서버(records, kind: replay)에 쌓인다
const CURATED_REPLAYS = [
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

function AdminAddReplayForm({ onAdded }) {
  const [date, setDate] = useState(todayYYMMDD())
  const [url, setUrl] = useState('')

  const handleAdd = async () => {
    const videoId = parseYouTubeUrl(url.trim())
    if (!videoId || !/^\d{6}$/.test(date)) {
      alert('날짜(YYMMDD 6자리)와 올바른 유튜브 링크를 입력해주세요.')
      return
    }
    const replay = { id: generateUUID(), date, videoId }
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

export default function AllReplaysArchive({ onAddToAnalysis }) {
  const [open, setOpen] = useState(false)
  const [activeVideoId, setActiveVideoId] = useState(null)
  const [adminReplays, setAdminReplays] = useState([])
  const [weekFilter, setWeekFilter] = useState('all')
  const mountRef = useRef(null)
  const playerRef = useRef(null)
  const admin = isAdminMode()

  useEffect(() => {
    listRecords('replay').then(setAdminReplays).catch(() => {})
  }, [])

  // 관리자가 추가한 회차가 큐레이션 목록과 날짜가 겹치면 관리자 쪽을 우선한다 (최신으로 교체 가능하게)
  const curatedFiltered = CURATED_REPLAYS.filter(
    (c) => !adminReplays.some((a) => a.date === c.date)
  )
  const allReplays = [...adminReplays, ...curatedFiltered].sort((a, b) => b.date.localeCompare(a.date))
  const replays = allReplays.filter((r) => matchesWeekFilter(weekFilter, dateToWeek(r.date)))
  const activeReplay = replays.find((r) => r.videoId === activeVideoId) || allReplays.find((r) => r.videoId === activeVideoId)

  const handleDelete = (id) => {
    setAdminReplays(adminReplays.filter((r) => r.id !== id))
    removeRecord('replay', id).catch((e) => console.error('다시보기 삭제 실패', e))
  }

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
          전체 라이브 다시보기 ({replays.length})
        </span>
        <ChevronDown size={18} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="p-4 md:p-6 pt-0 space-y-4">
          {admin && (
            <AdminAddReplayForm onAdded={(r) => setAdminReplays([r, ...adminReplays])} />
          )}

          {/* 주차 필터 */}
          <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
            {WEEK_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setWeekFilter(f.id)}
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
          <div className="flex flex-wrap gap-2">
            {replays.map((r) => (
              <span key={r.id || r.videoId} className="inline-flex items-center">
                <button
                  onClick={() => setActiveVideoId(r.videoId)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition ${
                    activeVideoId === r.videoId
                      ? 'bg-brand text-white'
                      : 'bg-surface-alt text-gray-400 hover:bg-white/10 hover:text-gray-200'
                  } ${admin && r.id ? 'rounded-r-none' : ''}`}
                >
                  {formatArchiveDate(r.date)}
                </button>
                {admin && r.id && (
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="px-1.5 py-1.5 rounded-r-lg bg-surface-alt hover:bg-red-500/20 text-gray-500 hover:text-red-400 border-l border-white/10"
                    title="이 회차 삭제"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </span>
            ))}
          </div>

          {activeVideoId ? (
            <div className="space-y-2">
              <div className="aspect-video rounded-xl overflow-hidden bg-black">
                <div ref={mountRef} className="w-full h-full" />
              </div>
              {onAddToAnalysis && activeReplay && (
                <button
                  onClick={() => onAddToAnalysis(activeReplay)}
                  className="w-full flex items-center justify-center gap-1.5 bg-brand-light hover:bg-red-500/20 text-brand font-bold py-2.5 rounded-xl text-sm transition active:scale-95"
                >
                  <FolderPlus size={15} />
                  이 회차 내 시뮬레이션 분석에 추가
                </button>
              )}
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
