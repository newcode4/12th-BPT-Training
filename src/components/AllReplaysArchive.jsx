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
// '0~3주차 랜덤'/'0~4주차 랜덤'은 이름에 "랜덤"이 붙어있을 뿐 다른 필터와 똑같이 동작하는
// 독립된 카테고리다 (뽑기 기능도 아니고, 0~4주차를 아우르는 범위 필터도 아니다).
// 그래서 week 값이 필터 id와 정확히 같을 때만 노출한다 — '3주차'에 속한 회차가
// '0~3주차 랜덤'에도 겹쳐 보이거나, 반대로 '0~4주차 랜덤'이 전체를 다 삼키는 일이 없게.
function matchesWeekFilter(filterId, week) {
  if (filterId === 'all') return true
  return String(week ?? '0') === filterId
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

export default function AllReplaysArchive({ folders, onAddToAnalysis, onWeekChange }) {
  const [open, setOpen] = useState(false)
  const [activeVideoId, setActiveVideoId] = useState(null)
  const [adminReplays, setAdminReplays] = useState([])
  const [weekFilter, setWeekFilter] = useState('all')
  const [selectedAddFolder, setSelectedAddFolder] = useState('')
  const mountRef = useRef(null)
  const playerRef = useRef(null)
  const admin = isAdminMode()

  useEffect(() => {
    if (folders && folders.length > 0 && !folders.includes(selectedAddFolder)) {
      setSelectedAddFolder(folders[0])
    }
  }, [folders, selectedAddFolder])

  useEffect(() => {
    listRecords('replay').then(setAdminReplays).catch(() => {})
  }, [])

  // 관리자가 추가한 회차가 큐레이션 목록과 날짜가 겹치면 관리자 쪽을 우선한다 (최신으로 교체 가능하게).
  // 삭제 표시(deleted)만 붙은 레코드도 "이 날짜는 관리자가 손을 댔다"는 의미라 큐레이션 쪽은 계속 숨긴다.
  const curatedFiltered = CURATED_REPLAYS.filter(
    (c) => !adminReplays.some((a) => a.date === c.date)
  )
  const allReplays = [...adminReplays.filter((r) => !r.deleted), ...curatedFiltered].sort((a, b) => b.date.localeCompare(a.date))
  const replays = allReplays.filter((r) => matchesWeekFilter(weekFilter, r.week ?? '0'))
  const activeReplay = replays.find((r) => r.videoId === activeVideoId) || allReplays.find((r) => r.videoId === activeVideoId)

  // 코드에 박아둔 큐레이션 회차는 DB 레코드가 없어서 그냥 지울 수가 없다.
  // "삭제됨" 표시가 붙은 레코드를 하나 만들어 그 날짜의 큐레이션 항목을 영구히 가려버린다.
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

  // 큐레이션 회차든 관리자가 넣은 회차든, 주차를 바꾸면 그 자리에 새 소속으로 덮어쓴다
  // (같은 날짜에 관리자 레코드가 생기면 큐레이션 원본은 자동으로 가려진다).
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
    if (onWeekChange && ['0', '1', '2', '3', '4'].includes(replay.week)) {
      onWeekChange(replay.week)
    }
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
            <div className="space-y-2">
              <div className="aspect-video rounded-xl overflow-hidden bg-black">
                <div ref={mountRef} className="w-full h-full" />
              </div>
              {onAddToAnalysis && activeReplay && (
                <div className="space-y-2 bg-surface-alt p-3 rounded-xl border border-brand/20">
                  <p className="text-xs font-bold text-gray-400">이 영상을 어느 세부 카테고리에 스크랩할까요?</p>
                  {folders && folders.length > 0 && (
                    <select
                      value={selectedAddFolder}
                      onChange={(e) => setSelectedAddFolder(e.target.value)}
                      className="w-full p-2.5 bg-surface border border-white/10 rounded-xl text-sm font-bold focus:outline-none focus:border-brand"
                    >
                      {folders.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={() => onAddToAnalysis(activeReplay, selectedAddFolder || folders?.[0] || '기본')}
                    className="w-full flex items-center justify-center gap-1.5 bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-xl text-sm transition active:scale-95"
                  >
                    <FolderPlus size={15} />
                    스크랩하기
                  </button>
                </div>
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
