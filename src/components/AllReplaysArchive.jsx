import { useState, useEffect, useRef } from 'react'
import { ChevronDown, PlayCircle, ShieldCheck, Plus, Trash2, FolderPlus } from 'lucide-react'
import { loadYouTubeAPI, parseYouTubeUrl } from '../utils/youtube'
import { listRecords, putRecord, removeRecord } from '../utils/cloudStore'
import { isAdminMode } from '../utils/admin'
import { generateUUID } from '../utils/formatters'

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
// 관리자가 회차를 추가할 때 고를 수 있는 목록 (전체보기는 제외)
const ADMIN_WEEK_OPTIONS = WEEK_FILTERS.filter((f) => f.id !== 'all')

// 회차의 week는 관리자가 명시적으로 지정한 값('0'~'4' 또는 '0-3'/'0-4')이다.
// '0~3주차 랜덤'/'0~4주차 랜덤'은 이름에 "랜덤"이 붙어있을 뿐 실제로는 다른 필터와 똑같이
// 동작하는 하나의 카테고리다 (뽑기 기능이 아니다). 필터 [lo,hi] 범위 안에 회차의 범위가
// 완전히 포함될 때만 그 필터에 노출한다.
// 예) week='0-3'인 회차는 '0~3주차 랜덤'/'전체보기'에는 보이지만 단일 '3주차'에는 안 보인다.
function matchesWeekFilter(filterId, week) {
  if (filterId === 'all') return true
  const [lo, hi] = filterId.includes('-') ? filterId.split('-').map(Number) : [Number(filterId), Number(filterId)]
  const [elo, ehi] = String(week).includes('-') ? String(week).split('-').map(Number) : [Number(week), Number(week)]
  return elo >= lo && ehi <= hi
}

// 전체 라이브 다시보기 (날짜순 원본 아카이브) - YYMMDD, videoId, week(필터 소속)
// 관리자가 추가하는 회차는 서버(records, kind: replay)에 쌓인다
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

// 지금 보고 있는 주차 필터를 그대로 추가 폼의 기본 소속 필터로 쓴다.
// '전체보기'를 보고 있을 땐 특정 주차로 단정할 수 없으니 '0'으로 되돌린다.
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
  const replays = allReplays.filter((r) => matchesWeekFilter(weekFilter, r.week ?? '0'))
  const activeReplay = replays.find((r) => r.videoId === activeVideoId) || allReplays.find((r) => r.videoId === activeVideoId)

  const handleDelete = (id) => {
    setAdminReplays(adminReplays.filter((r) => r.id !== id))
    removeRecord('replay', id).catch((e) => console.error('다시보기 삭제 실패', e))
  }

  const handleSelectFilter = (filterId) => {
    setWeekFilter(filterId)
    setActiveVideoId(null)
  }

  // 주차 필터를 바꾸면 영상 영역(mountRef)이 DOM에서 사라졌다가 다시 생기는데,
  // 그때 예전 플레이어 인스턴스를 loadVideoById로 재사용하면 이미 떨어져 나간
  // 옛 노드를 계속 붙잡고 있어 화면이 까맣게 나온다. 바뀔 때마다 새로 만든다.
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
                // 추가한 회차가 지금 보고 있는 필터에 속하면 바로 재생 화면에 띄워서
                // "추가했는데 반영이 안 됐다"는 오해가 없게 한다.
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
            {replays.length === 0 && (
              <p className="text-xs text-gray-500 py-2">이 범위에는 아직 등록된 회차가 없어요</p>
            )}
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
