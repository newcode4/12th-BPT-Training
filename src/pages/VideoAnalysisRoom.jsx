import { useState, useEffect, useRef } from 'react'
import {
  Video, Bookmark, RotateCcw, Save, Archive, Download, Trash2,
  ChevronDown, ChevronRight, Sparkles, ArrowUpDown, Upload, MonitorPlay, Folder,
  ShieldCheck, Plus, X, AlertCircle, Pencil, LayoutGrid
} from 'lucide-react'
import { generateUUID, formatTime, downloadJSON } from '../utils/formatters'
import { listRecords, putRecord, removeRecord } from '../utils/cloudStore'
import { parseYouTubeUrl } from '../utils/youtube'
import { saveFileBlob, getFileBlob, deleteFileBlob } from '../utils/fileStore'
import { isAdminMode } from '../utils/admin'
import { WEEK_CURRICULUM } from '../utils/curriculum'
import VideoPlayer from '../components/VideoPlayer'
import ScrapEditor from '../components/ScrapEditor'
import WeekReferenceVideos from '../components/WeekReferenceVideos'
import AllReplaysArchive from '../components/AllReplaysArchive'
import WeekInsights from '../components/WeekInsights'
import WeekFeedback from '../components/WeekFeedback'
import CurriculumOverview from '../components/CurriculumOverview'
import MySimulationsOverview from '../components/MySimulationsOverview'
import WeekScraps from '../components/WeekScraps'
import { WEEKS } from '../utils/weeks'

// 원래 "전체 녹음"이라는 하나의 폴더였는데, 이름을 "전체"로 바꾸고 의미도 바꿨다 —
// 이걸 고르면 그 주차의 모든 카테고리(녹음/스크랩)를 한꺼번에 보여주는 ALL 뷰가 된다.
// 값 자체는 그대로 각 항목의 기본 폴더로도 쓰인다(따로 폴더를 안 고르면 여기 담긴다).
const FULL_RECORDING_FOLDER = '전체'
const isAllFolder = (folder) => folder === FULL_RECORDING_FOLDER
const folderMatches = (itemFolder, selected) =>
  isAllFolder(selected) || (itemFolder || FULL_RECORDING_FOLDER) === selected

export default function VideoAnalysisRoom({ jumpWeek, onJumpConsumed }) {
  const [selectedWeek, setSelectedWeek] = useState('0')
  const [selectedFolder, setSelectedFolder] = useState(FULL_RECORDING_FOLDER)
  const [showAllMine, setShowAllMine] = useState(false)

  const [file, setFile] = useState(null)
  const [needsReattach, setNeedsReattach] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [loopRange, setLoopRange] = useState(null)
  const [analyses, setAnalyses] = useState([])
  const [selectedAnalysis, setSelectedAnalysis] = useState(null)
  const [scraps, setScraps] = useState([])

  const [insights, setInsights] = useState([])
  const [notesOpen, setNotesOpen] = useState(false)
  const [analysisOpen, setAnalysisOpen] = useState(true)
  const [sortOrder, setSortOrder] = useState('newest') // 'newest' | 'oldest'
  const [adminFolders, setAdminFolders] = useState([])
  const [newFolderInput, setNewFolderInput] = useState('')
  const admin = isAdminMode()
  const author = localStorage.getItem('qa-author') || '익명'
  const videoRef = useRef(null)
  const scrapListRef = useRef(null)
  const lastScrapId = useRef(null)
  const playerSectionRef = useRef(null)
  const prevWeekRef = useRef(selectedWeek)

  useEffect(() => {
    if (!jumpWeek) return
    setSelectedWeek(jumpWeek)
    setNotesOpen(true)
    onJumpConsumed?.()
  }, [jumpWeek])

  // 목록(사이드바 카운트용)과 "이 카테고리의 라이브 스크랩" 섹션이 같은 원본을 쓴다 —
  // 카운트만 갖고 있으면 실제 항목을 보여줄 수가 없어서, 통째로 들고 있다가 필요한 대로 걸러 쓴다.
  const [liveScraps, setLiveScraps] = useState([])

  const loadLiveScraps = () => {
    listRecords('live_scrap', { author }).then(setLiveScraps).catch(() => {})
  }

  useEffect(() => {
    // 시뮬레이션 분석(녹음/유튜브 링크)은 개인 기록이라 본인 것만 불러온다
    listRecords('analysis', { author }).then(setAnalyses).catch((e) => console.error('분석 불러오기 실패', e))
    listRecords('insight').then(setInsights).catch((e) => console.error('인사이트 불러오기 실패', e))
    loadLiveScraps()
  }, [author])

  // setState(updaterFn) 형태는 React가 fn을 "당장"이 아니라 렌더 단계에서 나중에 실행한다 —
  // 그래서 순서 바꾸기처럼 한 틱 안에서 persistMySimUpdate를 두 번 연달아 부르면, 두 번째
  // 호출이 setState 직후 곧바로 `updated` 값을 읽으려 해도 아직 null이라 저장이 통째로
  // 씹힌다. analysesRef로 최신 배열을 동기적으로 직접 들고 있어야 이 레이스가 안 생긴다.
  const analysesRef = useRef([])
  useEffect(() => { analysesRef.current = analyses }, [analyses])

  useEffect(() => {
    let cancelled = false
    listRecords('admin_folder', { week: selectedWeek })
      .then((rows) => { if (!cancelled) setAdminFolders(rows) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [selectedWeek])

  // 저장된 분석을 불러오면 주차/폴더도 함께 바뀌는데, 그때 아래 초기화가 같이 돌면
  // 방금 불러온 분석이 지워져 "파일을 찾을 수 없다"처럼 보인다. 지금 열려 있는 분석이
  // 새 주차/폴더에 속하면 초기화를 건너뛴다.
  useEffect(() => {
    const active = selectedAnalysis
    const belongsHere =
      active &&
      (active.week || '0') === selectedWeek &&
      (active.folder || FULL_RECORDING_FOLDER) === selectedFolder

    if (belongsHere) {
      prevWeekRef.current = selectedWeek
      return
    }

    if (prevWeekRef.current !== selectedWeek) {
      prevWeekRef.current = selectedWeek
      setSelectedFolder(FULL_RECORDING_FOLDER)
    }
    handleNewAnalysis()
  }, [selectedWeek, selectedFolder])

  useEffect(() => {
    if (lastScrapId.current && scrapListRef.current) {
      const el = scrapListRef.current.querySelector(`[data-scrap-id="${lastScrapId.current}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        const textarea = el.querySelector('textarea')
        if (textarea) textarea.focus()
      }
      lastScrapId.current = null
    }
  }, [scraps])

  const folders = [
    FULL_RECORDING_FOLDER,
    ...(WEEK_CURRICULUM[selectedWeek] || []),
    ...adminFolders.map(f => f.name),
  ]

  const handleAddFolder = async () => {
    const name = newFolderInput.trim()
    if (!name) return
    if (folders.includes(name)) {
      alert('이미 있는 폴더예요.')
      return
    }
    const folder = { id: generateUUID(), week: selectedWeek, name }
    setAdminFolders([...adminFolders, folder])
    setNewFolderInput('')
    try {
      await putRecord('admin_folder', folder, { author, week: selectedWeek })
    } catch (e) {
      alert('폴더 저장에 실패했어요: ' + e.message)
      setAdminFolders(adminFolders.filter(f => f.id !== folder.id))
    }
  }

  const handleDeleteFolder = async (folder) => {
    setAdminFolders(adminFolders.filter(f => f.id !== folder.id))
    if (selectedFolder === folder.name) setSelectedFolder(FULL_RECORDING_FOLDER)
    try {
      await removeRecord('admin_folder', folder.id)
    } catch (e) {
      console.error('폴더 삭제 실패', e)
    }
  }

  const applySelectedFile = (selectedFile) => {
    if (!selectedFile) return
    setFile(selectedFile)
    setNeedsReattach(false)
    setSelectedAnalysis({
      id: generateUUID(),
      week: selectedWeek,
      folder: selectedFolder,
      source: 'file',
      filename: selectedFile.name,
      uploadedAt: new Date().toISOString(),
      scraps: []
    })
    setScraps([])
  }

  const handleFileChange = (e) => {
    applySelectedFile(e.target.files?.[0])
  }

  // 저장된 분석의 원본 파일이 사라졌을 때, 같은 분석에 파일만 다시 붙인다 (스크랩 유지)
  const handleReattachFile = async (e) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile || !selectedAnalysis) return
    setFile(selectedFile)
    setNeedsReattach(false)
    const updated = { ...selectedAnalysis, filename: selectedFile.name }
    setSelectedAnalysis(updated)
    try {
      // 파일은 내 기기에만, 파일명 변경만 서버에 반영한다
      await saveFileBlob(updated.id, selectedFile)
      setAnalyses(analyses.map(a => (a.id === updated.id ? { ...updated, scraps } : a)))
      await putRecord('analysis', { ...updated, scraps }, { author: updated.author || author, week: updated.week })
    } catch (err) {
      console.error('파일 다시 연결 실패', err)
      alert('파일을 기기에 저장하지 못했어요. 지금 보기는 되지만, 다음에 다시 올려야 할 수 있어요.')
    }
  }

  const handleScrap = () => {
    if (!selectedAnalysis) return
    const newScrap = {
      id: generateUUID(),
      timestamp: currentTime,
      title: '',
      screenAnalysis: '',
      conceptAnalysis: '',
      createdAt: new Date().toISOString()
    }
    lastScrapId.current = newScrap.id
    setScraps([...scraps, newScrap].sort((a, b) => a.timestamp - b.timestamp))
  }

  const updateScrap = (id, screenAnalysis, conceptAnalysis, title) => {
    setScraps(scraps.map(s =>
      s.id === id ? { ...s, screenAnalysis, conceptAnalysis, title } : s
    ))
  }

  const deleteScrap = (id) => {
    setScraps(scraps.filter(s => s.id !== id))
    setLoopRange((lr) => (lr && scraps.find(s => s.id === id)?.timestamp === lr.start ? null : lr))
  }

  const handleSetScrapEnd = (scrap) => {
    if (currentTime <= scrap.timestamp) {
      alert('구간 끝은 시작 지점보다 뒤여야 해요. 원하는 끝 지점까지 재생한 뒤 다시 눌러주세요.')
      return
    }
    setScraps(scraps.map(s => s.id === scrap.id ? { ...s, endTime: currentTime } : s))
  }

  const handlePlayScrap = (scrap) => {
    if (videoRef.current) {
      videoRef.current.currentTime = scrap.timestamp
      videoRef.current.play()
    }
    setCurrentTime(scrap.timestamp)
    if (scrap.endTime != null && scrap.endTime > scrap.timestamp) {
      setLoopRange({ start: scrap.timestamp, end: scrap.endTime })
    } else {
      setLoopRange(null)
    }
  }

  const handleTimeUpdate = (t) => {
    setCurrentTime(t)
    if (loopRange && t >= loopRange.end && videoRef.current) {
      videoRef.current.currentTime = loopRange.start
    }
  }

  const handleSaveAnalysis = async () => {
    if (!selectedAnalysis || scraps.length === 0) {
      alert('스크랩이 없습니다.')
      return
    }
    const analysis = { ...selectedAnalysis, scraps, author: selectedAnalysis.author || author }
    const isExisting = analyses.some(a => a.id === analysis.id)

    let fileSaved = true
    if (file && file.size > 0) {
      try {
        await saveFileBlob(analysis.id, file)
      } catch (e) {
        console.error('파일 저장 실패', e)
        fileSaved = false
      }
    }

    try {
      await putRecord('analysis', analysis, { author: analysis.author, week: analysis.week })
    } catch (e) {
      alert('스크랩을 서버에 저장하지 못했어요: ' + e.message)
      return
    }

    if (isExisting) {
      setAnalyses(analyses.map(a => a.id === analysis.id ? analysis : a))
    } else {
      setAnalyses([...analyses, analysis])
    }

    if (fileSaved) {
      alert('분석이 저장되었습니다.')
    } else {
      // 조용히 넘어가면 나중에 열었을 때 "파일이 사라진" 것처럼 보인다
      alert(
        '스크랩 메모는 저장했지만 원본 파일은 기기에 담지 못했어요.\n' +
        '(저장 공간 부족이거나 파일이 너무 큰 경우예요)\n' +
        '나중에 이 분석을 열면 같은 파일을 다시 올려주세요.'
      )
    }
    handleNewAnalysis()
  }

  const handleNewAnalysis = () => {
    setFile(null)
    setNeedsReattach(false)
    setSelectedAnalysis(null)
    setScraps([])
    setCurrentTime(0)
    setLoopRange(null)
  }

  const handleDownloadAnalysis = (analysis) => {
    downloadJSON(analysis, `analysis-${analysis.filename || analysis.videoId}-${new Date().getTime()}.json`)
  }

  const handleRenameAnalysis = async (analysis) => {
    const next = window.prompt('이 분석의 제목을 입력하세요 (비워두면 원래 파일명이 보여요)', analysis.title || '')
    if (next === null) return
    const updated = { ...analysis, title: next.trim() }
    setAnalyses(analyses.map(a => a.id === updated.id ? updated : a))
    if (selectedAnalysis?.id === updated.id) setSelectedAnalysis(updated)
    try {
      await putRecord('analysis', updated, { author: updated.author || author, week: updated.week })
    } catch (e) {
      alert('제목 저장에 실패했어요: ' + e.message)
    }
  }

  const handleDeleteAnalysis = async (id) => {
    if (!confirm('정말로 삭제하시겠습니까?')) return
    deleteFileBlob(id).catch(() => {})
    setAnalyses(analyses.filter(a => a.id !== id))
    try {
      await removeRecord('analysis', id)
    } catch (e) {
      alert('삭제에 실패했어요: ' + e.message)
    }
  }

  // 음성 녹음 분석 피드백 목록은 파일 업로드 전용이라 여기서 불러오는 건 항상 파일이다
  // (유튜브 링크는 "내 시뮬레이션 모아보기"에서 등록·재생한다)
  const handleLoadAnalysis = async (analysis) => {
    setShowAllMine(false)
    setSelectedWeek(analysis.week || '0')
    setSelectedFolder(analysis.folder || FULL_RECORDING_FOLDER)
    setSelectedAnalysis(analysis)
    setScraps(analysis.scraps || [])
    let blob = null
    try {
      blob = await getFileBlob(analysis.id)
    } catch (e) {
      console.error('파일 불러오기 실패', e)
    }
    if (blob && blob.size > 0) {
      setFile(new File([blob], analysis.filename || '녹음파일', { type: blob.type || 'video/mp4' }))
      setNeedsReattach(false)
    } else {
      // 빈 파일을 넣으면 플레이어가 깨지므로, 다시 연결 안내를 띄운다
      setFile(null)
      setNeedsReattach(true)
    }
    setAnalysisOpen(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        playerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
  }

  // "내 시뮬레이션 모아보기"에서 링크만 붙여넣어 바로 등록 (지금 선택된 주차/폴더에 걸린다)
  const handleAddMyLink = async (url, startSeconds = 0, week = selectedWeek) => {
    const videoId = parseYouTubeUrl(url)
    if (!videoId) return null
    const analysis = {
      id: generateUUID(),
      week,
      folder: selectedFolder,
      source: 'youtube',
      videoId,
      startSeconds,
      scraps: [],
      author,
      uploadedAt: new Date().toISOString(),
    }
    setAnalyses((prev) => [...prev, analysis])
    try {
      await putRecord('analysis', analysis, { author, week })
    } catch (e) {
      alert('시뮬레이션을 등록하지 못했어요: ' + e.message)
    }
    return analysis
  }

  // 이름(제목)이나 시작 시간처럼, 통째로 덮어써도 되는 필드를 저장한다
  // 함수형 업데이트를 써야 한다 — 순서 바꾸기처럼 한 클릭에서 onUpdateMeta를 연달아
  // 두 번 호출하는 경우, 일반 setState는 둘 다 같은(오래된) analyses를 기준으로 계산해서
  // 뒤에 호출한 쪽만 반영되고 앞의 변경이 통째로 사라지는 레이스가 생긴다.
  // 호출한 쪽(특히 순서 바꾸기처럼 두 건을 한 번에 바꾸는 경우)이 저장 성공 여부를
  // 알아야 실패를 감지하고 되돌릴 수 있어서, 프로미스를 그대로 반환한다.
  // analysesRef를 직접 읽고 써서, 같은 틱에서 연달아 호출돼도 서로의 변경을 즉시 본다.
  const persistMySimUpdate = (id, patch) => {
    const target = analysesRef.current.find(a => a.id === id)
    if (!target) return Promise.resolve()
    const updated = { ...target, ...patch }
    analysesRef.current = analysesRef.current.map(a => a.id === id ? updated : a)
    setAnalyses(analysesRef.current)
    return putRecord('analysis', updated, { author: updated.author || author, week: updated.week })
      .catch(e => { console.error('시뮬레이션 저장 실패', e); throw e })
  }

  const analysisDisplayName = (analysis) =>
    analysis.title || (analysis.source === 'youtube' ? `유튜브 · ${analysis.videoId}` : analysis.filename)

  const countByWeek = (weekId) => {
    const analysisCount = analyses.filter(a => (a.week || '0') === weekId && a.source !== 'youtube').length
    const scrapCount = liveScraps.filter(s => (s.week || '0') === weekId).length
    return analysisCount + scrapCount
  }
  // "전체"를 고르면 그 주차 전체(모든 카테고리) 합계를 보여준다 — 낱개 폴더가 아니라 ALL 뷰라서
  const countByFolder = (folder) => {
    const analysisCount = analyses.filter(a => (a.week || '0') === selectedWeek && folderMatches(a.folder, folder) && a.source !== 'youtube').length
    const scrapCount = liveScraps.filter(s => (s.week || '0') === selectedWeek && folderMatches(s.folder, folder)).length
    return analysisCount + scrapCount
  }
  // 음성 녹음 분석 피드백은 파일(녹음) 전용 — 유튜브 소스는 "내 시뮬레이션 모아보기"에서만 다룬다
  const analysesInFolder = analyses
    .filter(a => (a.week || '0') === selectedWeek && folderMatches(a.folder, selectedFolder) && a.source !== 'youtube')
    .sort((a, b) => {
      const diff = new Date(a.uploadedAt) - new Date(b.uploadedAt)
      return sortOrder === 'oldest' ? diff : -diff
    })
  // "이 카테고리의 라이브 스크랩" 섹션에 보여줄 목록 — ALL(전체)일 땐 이 주차의 모든 카테고리를 합친다
  const scrapsInFolder = liveScraps
    .filter(s => (s.week || '0') === selectedWeek && folderMatches(s.folder, selectedFolder))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  const weekLabel = WEEKS.find(w => w.id === selectedWeek)?.label
  // 어느 주차/폴더든 상관없이 내가 올린 유튜브 시뮬레이션을 한 번에 모아 보는 용도
  // (analyses는 이미 author로 스코핑됨. 파일/녹음은 "음성 녹음 분석 피드백"에서 따로 다룬다)
  const myAllAnalyses = analyses
    .filter(a => a.source === 'youtube')
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))

  // 왼쪽 메뉴(주차/폴더)를 눌렀을 때 실제로 화면이 바뀐 걸 느낄 수 있도록,
  // 관련 콘텐츠 쪽으로 스크롤해준다. 사이드바가 화면 밖에 있으면 클릭해도 아무 변화가
  // 안 보이는 것처럼 느껴지는 문제였다.
  const goToWeekFolder = (weekId, folderName) => {
    setShowAllMine(false)
    setSelectedWeek(weekId)
    if (folderName) setSelectedFolder(folderName)
    requestAnimationFrame(() => {
      playerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const WeekNavButton = ({ w, vertical }) => (
    <button
      onClick={() => setSelectedWeek(w.id)}
      className={
        vertical
          ? `w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition ${
              selectedWeek === w.id
                ? 'bg-brand text-white'
                : 'text-gray-400 hover:bg-surface-alt'
            }`
          : `shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition ${
              selectedWeek === w.id
                ? 'bg-brand text-white'
                : 'bg-surface-alt text-gray-400 hover:bg-white/10'
            }`
      }
    >
      {w.label} · {w.title} <span className="opacity-70">({countByWeek(w.id)})</span>
    </button>
  )

  return (
    <div className="space-y-6">
      <CurriculumOverview onSelect={(week, folder) => {
        setShowAllMine(false)
        setSelectedWeek(week)
        setSelectedFolder(folder)
        requestAnimationFrame(() => {
          playerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }} />

    <div className="flex flex-col md:flex-row gap-6">
      {/* 좌측 사이드바 (데스크톱 고정, 주차 + 세부 폴더 트리) */}
      <aside className="hidden md:block md:w-64 shrink-0">
        <div className="sticky top-20 bg-surface rounded-2xl shadow-card border border-white/10 p-3 space-y-1 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <p className="flex items-center gap-2 px-2 py-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide">
            <Video size={14} />
            시뮬레이션 분석실
          </p>

          <button
            onClick={() => {
              setShowAllMine(true)
              requestAnimationFrame(() => {
                playerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              })
            }}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl font-bold text-sm transition mb-1 ${
              showAllMine ? 'bg-brand text-white' : 'bg-surface-alt text-gray-300 hover:bg-white/10'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <LayoutGrid size={14} />
              내 시뮬레이션 모아보기
            </span>
            <span className="opacity-70 text-xs">({myAllAnalyses.length})</span>
          </button>

          {WEEKS.map((w) => {
            const weekFolders = [FULL_RECORDING_FOLDER, ...(WEEK_CURRICULUM[w.id] || [])]
            const isOpen = !showAllMine && selectedWeek === w.id
            return (
              <div key={w.id}>
                <button
                  onClick={() => goToWeekFolder(w.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl font-bold text-sm transition ${
                    isOpen ? 'bg-brand text-white' : 'text-gray-400 hover:bg-surface-alt'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>{w.label}</span>
                    <span className="opacity-70 text-xs">({countByWeek(w.id)})</span>
                  </div>
                  <div className={`text-[11px] font-semibold ${isOpen ? 'text-white/80' : 'text-gray-500'}`}>{w.title}</div>
                </button>

                {isOpen && (
                  <div className="pl-2 mt-1 mb-2 space-y-0.5 border-l border-white/10 ml-3">
                    {weekFolders.map((folder) => (
                      <button
                        key={folder}
                        onClick={() => goToWeekFolder(w.id, folder)}
                        className={`w-full text-left pl-3 pr-2 py-1.5 rounded-lg text-xs font-semibold transition ${
                          selectedFolder === folder
                            ? 'bg-brand-light text-brand'
                            : 'text-gray-500 hover:bg-surface-alt hover:text-gray-300'
                        }`}
                      >
                        {folder} <span className="opacity-70">({countByFolder(folder)})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </aside>

      <div className="flex-1 min-w-0 space-y-6">
        {/* 모바일: 주차 + 폴더 (가로 스크롤, 카드 밖으로 흘려서 잘리지 않게) */}
        <div className="md:hidden bg-surface rounded-2xl shadow-card border border-white/10 p-4 space-y-3 overflow-hidden">
          <h2 className="flex items-center gap-2 text-xl font-extrabold">
            <Video size={20} className="text-brand shrink-0" />
            시뮬레이션 분석실
          </h2>

          <button
            onClick={() => {
              setShowAllMine(true)
              requestAnimationFrame(() => {
                playerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              })
            }}
            className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm transition active:scale-95 ${
              showAllMine ? 'bg-brand text-white shadow-floating' : 'bg-surface-alt text-gray-300 hover:bg-white/10'
            }`}
          >
            <LayoutGrid size={14} />
            내 시뮬레이션 모아보기 ({myAllAnalyses.length})
          </button>

          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 scrollbar-none">
            {WEEKS.map((w) => (
              <button
                key={w.id}
                onClick={() => goToWeekFolder(w.id)}
                className={`shrink-0 px-4 py-2.5 rounded-xl font-bold text-sm transition active:scale-95 ${
                  !showAllMine && selectedWeek === w.id
                    ? 'bg-brand text-white shadow-floating'
                    : 'bg-surface-alt text-gray-400 hover:bg-white/10'
                }`}
              >
                {w.label}
                <span className="opacity-70 ml-1">({countByWeek(w.id)})</span>
              </button>
            ))}
          </div>

          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 mb-2">
              <Folder size={12} />
              {weekLabel} · {WEEKS.find(w => w.id === selectedWeek)?.title}
            </p>
            <div className="flex gap-2 overflow-x-auto -mx-4 px-4 scrollbar-none">
              {folders.map((folder) => (
                <button
                  key={folder}
                  onClick={() => goToWeekFolder(selectedWeek, folder)}
                  className={`shrink-0 px-3 py-2 rounded-lg font-bold text-xs transition active:scale-95 ${
                    !showAllMine && selectedFolder === folder
                      ? 'bg-brand-light text-brand ring-1 ring-brand/40'
                      : 'bg-surface-alt text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {folder}
                  <span className="opacity-70 ml-1">({countByFolder(folder)})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 관리자: 세부 폴더(카테고리) 추가/삭제 */}
        {!showAllMine && admin && (
          <div className="bg-surface rounded-2xl shadow-card border border-brand/20 p-4 space-y-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-brand">
              <ShieldCheck size={13} />
              관리자 · {weekLabel} 세부 폴더 관리
            </p>
            {adminFolders.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {adminFolders.map((f) => (
                  <span key={f.id} className="inline-flex items-center gap-1 text-xs font-bold bg-surface-alt text-gray-300 px-2.5 py-1 rounded-full">
                    {f.name}
                    <button onClick={() => handleDeleteFolder(f)} className="text-gray-500 hover:text-red-500">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newFolderInput}
                onChange={(e) => setNewFolderInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
                placeholder="새 폴더 이름"
                className="flex-1 p-2.5 border border-white/10 rounded-xl text-sm bg-surface-alt focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
              <button
                onClick={handleAddFolder}
                className="flex items-center gap-1 bg-brand hover:bg-brand-dark text-white font-bold px-4 rounded-xl text-sm transition"
              >
                <Plus size={14} />
                추가
              </button>
            </div>
          </div>
        )}

        {/* 예시 시뮬레이션 영상 (유튜브 스크랩) */}
        {!showAllMine && <WeekReferenceVideos week={selectedWeek} />}
        {!showAllMine && <AllReplaysArchive
          selectedWeek={selectedWeek}
          folders={folders}
          onWeekChange={(week) => {
            setShowAllMine(false)
            setSelectedWeek(week)
          }}
        />}

        {/* 내 시뮬레이션 모아보기 — 주차/폴더 안 가리고 내가 올린 걸 순서대로 모아보고,
            그 자리에서 바로 재생 + 피드백까지 끝낼 수 있게 한다 */}
        {showAllMine && (
          <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6">
            <h3 className="flex items-center gap-2 text-lg font-extrabold mb-1">
              <LayoutGrid size={18} className="text-gray-500" />
              내 시뮬레이션 모아보기 ({myAllAnalyses.length})
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              유튜브 링크를 붙여넣으면 바로 등록돼요. 카드를 누르면 그 자리에서 펼쳐져 재생하고 피드백을 남길 수 있어요
            </p>
            <MySimulationsOverview
              analyses={myAllAnalyses}
              author={author}
              onAddLink={handleAddMyLink}
              onUpdateMeta={persistMySimUpdate}
              onDelete={handleDeleteAnalysis}
            />
          </div>
        )}

        {/* 저장된 분석 목록 (현재 주차 + 폴더) - 관리하기 편하도록 업로드보다 위에 배치 */}
        {!showAllMine && analysesInFolder.length > 0 && (
          <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="flex items-center gap-2 text-lg font-extrabold">
                <Archive size={18} className="text-gray-500" />
                {selectedFolder} 저장된 분석 ({analysesInFolder.length})
              </h3>
              <button
                onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
                className="flex items-center gap-1 text-xs font-bold text-gray-400 bg-surface-alt hover:bg-white/10 px-3 py-1.5 rounded-full transition"
              >
                <ArrowUpDown size={12} />
                {sortOrder === 'newest' ? '최신순' : '오래된순'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">카드를 클릭하면 바로 아래에서 재생하며 이어서 확인할 수 있어요</p>
            <div className="stagger grid gap-3">
              {analysesInFolder.map((analysis) => {
                const isActive = selectedAnalysis?.id === analysis.id
                return (
                  <div
                    key={analysis.id}
                    onClick={() => handleLoadAnalysis(analysis)}
                    className={`lift p-4 border rounded-2xl cursor-pointer ${
                      isActive
                        ? 'border-brand bg-brand-light shadow-floating'
                        : 'border-white/10 hover:bg-surface-alt active:bg-white/10'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {analysis.source === 'youtube'
                            ? <MonitorPlay size={14} className="text-red-500 shrink-0" />
                            : <Upload size={14} className="text-gray-500 shrink-0" />}
                          <h4 className="font-bold truncate min-w-0" title={analysisDisplayName(analysis)}>
                            {analysisDisplayName(analysis)}
                          </h4>
                          {(analysis.author === author || admin) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRenameAnalysis(analysis) }}
                              className="shrink-0 text-gray-500 hover:text-brand"
                              title="제목 수정"
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                          {isActive && (
                            <span className="anim-pop shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-brand bg-surface px-1.5 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                              재생 중
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">
                          스크랩 {analysis.scraps?.length || 0}개 · {new Date(analysis.uploadedAt).toLocaleString('ko-KR')}
                        </p>
                        {analysis.author && (
                          <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            analysis.author === author
                              ? 'bg-brand-light text-brand'
                              : 'bg-white/10 text-gray-400'
                          }`}>
                            {analysis.author === author ? '내 분석' : analysis.author}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div onClick={(e) => e.stopPropagation()} className="flex gap-2">
                          {analysis.source !== 'youtube' && (
                            <button
                              onClick={() => handleDownloadAnalysis(analysis)}
                              className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg"
                              title="다운로드"
                            >
                              <Download size={15} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteAnalysis(analysis.id)}
                            className="p-2 border border-white/10 hover:border-red-500/30 hover:bg-red-500/10 text-gray-500 hover:text-red-500 rounded-lg transition"
                            title="삭제"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <ChevronRight size={18} className={isActive ? 'text-brand' : 'text-gray-600'} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 지금 보고 있는 주차/카테고리에 걸린 라이브 스크랩 — "전체"를 보고 있으면 이 주차의
            모든 카테고리 스크랩을 한꺼번에 보여준다(ALL). 여기서 바로 재생/수정/삭제까지 된다. */}
        {!showAllMine && (
          <WeekScraps
            scraps={scrapsInFolder}
            folders={folders}
            showFolderBadge={isAllFolder(selectedFolder)}
            onChanged={loadLiveScraps}
          />
        )}

        {/* 음성 녹음 분석 피드백 — 유튜브는 "내 시뮬레이션 모아보기"로 옮겨서, 여긴 파일(녹음) 전용이다 */}
        {!showAllMine && (
        <div ref={playerSectionRef} className="bg-surface rounded-2xl shadow-card border border-white/10 scroll-mt-4 overflow-hidden">
          <button
            onClick={() => setAnalysisOpen(!analysisOpen)}
            className="w-full flex items-center justify-between gap-2 p-4 md:p-6 text-left hover:bg-white/[0.02] transition"
          >
            {/* key로 주차/폴더가 바뀔 때마다 다시 마운트시켜서, 왼쪽 메뉴를 눌렀을 때
                여기 라벨이 확실히 "바뀌었다"는 느낌이 들게 살짝 팝 애니메이션을 준다 */}
            <div key={`${selectedWeek}-${selectedFolder}`} className="anim-pop min-w-0">
              <h3 className="text-lg font-extrabold">음성 녹음 분석 피드백</h3>
              <p className="text-xs text-gray-500 truncate">{weekLabel} · {selectedFolder}</p>
            </div>
            <ChevronDown
              size={20}
              className={`shrink-0 text-gray-500 transition-transform ${analysisOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <div className={analysisOpen ? 'p-4 md:p-6 pt-0' : 'hidden'}>
            <>
              <label className="block bg-surface-alt hover:bg-white/10 border border-dashed border-white/15 hover:border-brand/50 rounded-xl p-5 mb-4 cursor-pointer transition text-center">
                <input
                  type="file"
                  accept="video/*,audio/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Upload size={22} className="mx-auto text-brand mb-2" />
                <p className="text-sm font-bold text-gray-200">
                  {file ? file.name : '녹음/영상 파일 선택'}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {file ? '다른 파일을 고르려면 다시 눌러주세요' : 'mp3 · wav · mp4 등 · 내 기기에만 저장돼요'}
                </p>
              </label>

              {needsReattach && selectedAnalysis && (
                <div className="anim-pop mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-amber-300">원본 파일이 기기에 없어요</p>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                        스크랩 메모 {scraps.length}개는 그대로 있어요.
                        같은 파일을 다시 올리면 이어서 볼 수 있어요.
                      </p>
                      {selectedAnalysis.filename && (
                        <p className="text-[11px] text-gray-500 mt-1 truncate">
                          찾는 파일: {selectedAnalysis.filename}
                        </p>
                      )}
                    </div>
                  </div>
                  <label className="block bg-surface hover:bg-white/10 border border-amber-500/30 rounded-xl py-2.5 cursor-pointer transition text-center text-sm font-bold text-amber-300">
                    <input
                      type="file"
                      accept="video/*,audio/*"
                      onChange={handleReattachFile}
                      className="hidden"
                    />
                    파일 다시 연결하기
                  </label>
                </div>
              )}

              {(file || needsReattach) && (
                <div className="space-y-4">
                  {file && (
                  <VideoPlayer
                    file={file}
                    videoRef={videoRef}
                    currentTime={currentTime}
                    onTimeUpdate={handleTimeUpdate}
                    scraps={scraps}
                    onScrapPlay={handlePlayScrap}
                  />
                  )}

                  {file && loopRange && (
                    <div className="flex items-center justify-between gap-2 bg-brand-light px-3 py-2 rounded-xl">
                      <span className="text-xs font-bold text-brand">
                        🔁 {formatTime(loopRange.start)} ~ {formatTime(loopRange.end)} 구간 반복 중
                      </span>
                      <button
                        onClick={() => setLoopRange(null)}
                        className="text-xs font-bold text-brand hover:text-white bg-surface hover:bg-brand px-2 py-1 rounded-lg transition"
                      >
                        반복 중지
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {file && (
                    <button
                      onClick={handleScrap}
                      className="shine relative flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl transition active:scale-95"
                    >
                      <Bookmark size={16} />
                      스크랩 ({currentTime.toFixed(1)}초)
                    </button>
                    )}
                    <button
                      onClick={handleNewAnalysis}
                      className={`flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/15 text-gray-300 font-bold py-3 px-4 rounded-xl transition ${file ? '' : 'flex-1'}`}
                    >
                      <RotateCcw size={16} />
                      새로 시작
                    </button>
                  </div>

                  {selectedAnalysis && (
                    <>
                      <div className="bg-brand-light p-3 rounded-xl flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h4 className="font-bold truncate min-w-0" title={analysisDisplayName(selectedAnalysis)}>
                            {analysisDisplayName(selectedAnalysis)}
                          </h4>
                          <button
                            onClick={() => handleRenameAnalysis(selectedAnalysis)}
                            className="shrink-0 text-gray-500 hover:text-brand"
                            title="제목 수정"
                          >
                            <Pencil size={12} />
                          </button>
                        </div>
                        <span className="text-sm text-gray-400 shrink-0">스크랩 {scraps.length}개</span>
                      </div>

                      <div ref={scrapListRef} className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                        {scraps.map((scrap) => (
                          <div key={scrap.id} data-scrap-id={scrap.id}>
                            <ScrapEditor
                              scrap={scrap}
                              onUpdate={updateScrap}
                              onDelete={deleteScrap}
                              onPlay={handlePlayScrap}
                              onSetEnd={handleSetScrapEnd}
                            />
                          </div>
                        ))}
                      </div>

                      {scraps.length > 0 && (
                        <button
                          onClick={handleSaveAnalysis}
                          className="shine relative glow-breathe w-full flex items-center justify-center gap-1.5 bg-brand hover:bg-brand-dark text-white font-bold py-3 px-4 rounded-xl transition active:scale-95"
                        >
                          <Save size={16} />
                          분석 저장
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          </div>
        </div>
        )}

        {/* 인사이트 · 피드백 */}
        <div className="bg-surface rounded-2xl shadow-card border border-white/10 overflow-hidden">
          <button
            onClick={() => setNotesOpen(!notesOpen)}
            className="w-full flex items-center justify-between gap-2 p-4 md:p-6 text-left hover:bg-white/[0.02] transition"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles size={18} className="text-brand shrink-0" />
              <div className="min-w-0">
                <h3 className="text-lg font-extrabold">인사이트 & 피드백</h3>
                <p className="text-xs text-gray-500 truncate">
                  {weekLabel}에 배운 점과 받은 피드백을 기록해요
                </p>
              </div>
            </div>
            <ChevronDown
              size={20}
              className={`shrink-0 text-gray-500 transition-transform ${notesOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {notesOpen && (
            <div className="p-4 md:p-6 pt-0 space-y-4">
              <WeekInsights week={selectedWeek} insights={insights} setInsights={setInsights} author={author} />
              <WeekFeedback week={selectedWeek} />
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  )
}
