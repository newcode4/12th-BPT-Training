import { useState, useEffect, useRef } from 'react'
import {
  Video, Bookmark, RotateCcw, Save, Archive, Download, Trash2,
  ChevronDown, ChevronRight, Sparkles, ArrowUpDown, Upload, MonitorPlay, Folder,
  ShieldCheck, Plus, X, AlertCircle
} from 'lucide-react'
import { generateUUID, formatTime, downloadJSON, hmsToSeconds } from '../utils/formatters'
import { listRecords, putRecord, removeRecord } from '../utils/cloudStore'
import { parseYouTubeUrl, parseYouTubeStartSeconds } from '../utils/youtube'
import { saveFileBlob, getFileBlob, deleteFileBlob } from '../utils/fileStore'
import { isAdminMode } from '../utils/admin'
import TimeHMSInput, { applySecondsToHMS } from '../components/TimeHMSInput'
import { WEEK_CURRICULUM } from '../utils/curriculum'
import VideoPlayer from '../components/VideoPlayer'
import ScrapEditor from '../components/ScrapEditor'
import MyYoutubeAnalysis from '../components/MyYoutubeAnalysis'
import WeekReferenceVideos from '../components/WeekReferenceVideos'
import AllReplaysArchive from '../components/AllReplaysArchive'
import WeekInsights from '../components/WeekInsights'
import WeekFeedback from '../components/WeekFeedback'
import { WEEKS } from '../utils/weeks'

const FULL_RECORDING_FOLDER = '전체 녹음'

export default function VideoAnalysisRoom({ onAskQuestion }) {
  const [selectedWeek, setSelectedWeek] = useState('0')
  const [selectedFolder, setSelectedFolder] = useState(FULL_RECORDING_FOLDER)
  const [sourceMode, setSourceMode] = useState('file') // 'file' | 'youtube'

  const [file, setFile] = useState(null)
  const [needsReattach, setNeedsReattach] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [loopRange, setLoopRange] = useState(null)
  const [analyses, setAnalyses] = useState([])
  const [selectedAnalysis, setSelectedAnalysis] = useState(null)
  const [scraps, setScraps] = useState([])

  const [ytUrlInput, setYtUrlInput] = useState('')
  const [ytStartHMS, setYtStartHMS] = useState({ hours: 0, minutes: 0, seconds: 0 })
  const [ytActiveAnalysis, setYtActiveAnalysis] = useState(null)

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
    // 시뮬레이션 분석(녹음/유튜브 링크)은 개인 기록이라 본인 것만 불러온다
    listRecords('analysis', { author }).then(setAnalyses).catch((e) => console.error('분석 불러오기 실패', e))
    listRecords('insight').then(setInsights).catch((e) => console.error('인사이트 불러오기 실패', e))
  }, [author])

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
    const active = selectedAnalysis || ytActiveAnalysis
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
    setYtActiveAnalysis(null)
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
      screenAnalysis: '',
      conceptAnalysis: '',
      createdAt: new Date().toISOString()
    }
    lastScrapId.current = newScrap.id
    setScraps([...scraps, newScrap].sort((a, b) => a.timestamp - b.timestamp))
  }

  const updateScrap = (id, screenAnalysis, conceptAnalysis) => {
    setScraps(scraps.map(s =>
      s.id === id ? { ...s, screenAnalysis, conceptAnalysis } : s
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

  const handleDeleteAnalysis = async (id) => {
    if (!confirm('정말로 삭제하시겠습니까?')) return
    deleteFileBlob(id).catch(() => {})
    setAnalyses(analyses.filter(a => a.id !== id))
    if (ytActiveAnalysis?.id === id) setYtActiveAnalysis(null)
    try {
      await removeRecord('analysis', id)
    } catch (e) {
      alert('삭제에 실패했어요: ' + e.message)
    }
  }

  const handleLoadAnalysis = async (analysis) => {
    setSelectedWeek(analysis.week || '0')
    setSelectedFolder(analysis.folder || FULL_RECORDING_FOLDER)
    if (analysis.source === 'youtube') {
      setSourceMode('youtube')
      setYtActiveAnalysis(analysis)
    } else {
      setSourceMode('file')
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
    }
    setAnalysisOpen(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        playerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
  }

  const handleYtLoad = () => {
    const videoId = parseYouTubeUrl(ytUrlInput.trim())
    if (!videoId) {
      alert('유튜브 링크를 확인해주세요.')
      return
    }
    const startSeconds = hmsToSeconds(ytStartHMS.hours, ytStartHMS.minutes, ytStartHMS.seconds)
    const analysis = {
      id: generateUUID(),
      week: selectedWeek,
      folder: selectedFolder,
      source: 'youtube',
      videoId,
      startSeconds,
      scraps: [],
      author,
      uploadedAt: new Date().toISOString()
    }
    setAnalyses([...analyses, analysis])
    setYtActiveAnalysis(analysis)
    setYtUrlInput('')
    setYtStartHMS({ hours: 0, minutes: 0, seconds: 0 })
    putRecord('analysis', analysis, { author, week: selectedWeek })
      .catch(e => alert('유튜브 링크 저장에 실패했어요: ' + e.message))
  }

  const handleYtUrlChange = (url) => {
    setYtUrlInput(url)
    const startFromUrl = parseYouTubeStartSeconds(url.trim())
    if (startFromUrl > 0) {
      applySecondsToHMS(startFromUrl, setYtStartHMS)
    }
  }

  const handleYtAddScrap = (timestamp, note) => {
    if (!ytActiveAnalysis) return
    const newScrap = { id: generateUUID(), timestamp, note, author, createdAt: new Date().toISOString() }
    const updated = { ...ytActiveAnalysis, scraps: [...ytActiveAnalysis.scraps, newScrap] }
    persistYtAnalysis(updated)
  }

  const handleYtDeleteScrap = (scrapId) => {
    if (!ytActiveAnalysis) return
    const updated = { ...ytActiveAnalysis, scraps: ytActiveAnalysis.scraps.filter(s => s.id !== scrapId) }
    persistYtAnalysis(updated)
  }

  const persistYtAnalysis = (updated) => {
    setYtActiveAnalysis(updated)
    setAnalyses(analyses.map(a => a.id === updated.id ? updated : a))
    putRecord('analysis', updated, { author: updated.author || author, week: updated.week })
      .catch(e => alert('스크랩 저장에 실패했어요: ' + e.message))
  }

  const handleAskAboutScrap = (scrap) => {
    if (!onAskQuestion) return
    const weekLabel = WEEKS.find(w => w.id === selectedWeek)?.label || ''
    const context = `[${weekLabel} · ${selectedFolder} · ${selectedAnalysis?.filename || ''} @ ${formatTime(scrap.timestamp)}]`
    const memo = [scrap.screenAnalysis, scrap.conceptAnalysis].filter(Boolean).join('\n')
    onAskQuestion({
      title: `${context} 이 구간에서 막혔어요`,
      content: memo ? `${context}\n\n${memo}` : `${context}\n\n`
    })
  }

  const countByWeek = (weekId) => analyses.filter(a => (a.week || '0') === weekId).length
  const countByFolder = (folder) => analyses.filter(a => (a.week || '0') === selectedWeek && (a.folder || FULL_RECORDING_FOLDER) === folder).length
  const analysesInFolder = analyses
    .filter(a => (a.week || '0') === selectedWeek && (a.folder || FULL_RECORDING_FOLDER) === selectedFolder)
    .sort((a, b) => {
      const diff = new Date(a.uploadedAt) - new Date(b.uploadedAt)
      return sortOrder === 'oldest' ? diff : -diff
    })
  const weekLabel = WEEKS.find(w => w.id === selectedWeek)?.label

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
    <div className="flex flex-col md:flex-row gap-6">
      {/* 좌측 사이드바 (데스크톱 고정, 주차 + 세부 폴더 트리) */}
      <aside className="hidden md:block md:w-64 shrink-0">
        <div className="sticky top-20 bg-surface rounded-2xl shadow-card border border-white/10 p-3 space-y-1 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <p className="flex items-center gap-2 px-2 py-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide">
            <Video size={14} />
            시뮬레이션 분석실
          </p>
          {WEEKS.map((w) => {
            const weekFolders = [FULL_RECORDING_FOLDER, ...(WEEK_CURRICULUM[w.id] || [])]
            const isOpen = selectedWeek === w.id
            return (
              <div key={w.id}>
                <button
                  onClick={() => setSelectedWeek(w.id)}
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
                        onClick={() => setSelectedFolder(folder)}
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

          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 scrollbar-none">
            {WEEKS.map((w) => (
              <button
                key={w.id}
                onClick={() => setSelectedWeek(w.id)}
                className={`shrink-0 px-4 py-2.5 rounded-xl font-bold text-sm transition active:scale-95 ${
                  selectedWeek === w.id
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
                  onClick={() => setSelectedFolder(folder)}
                  className={`shrink-0 px-3 py-2 rounded-lg font-bold text-xs transition active:scale-95 ${
                    selectedFolder === folder
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
        {admin && (
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
        <WeekReferenceVideos week={selectedWeek} />
        <AllReplaysArchive />

        {/* 저장된 분석 목록 (현재 주차 + 폴더) - 관리하기 편하도록 업로드보다 위에 배치 */}
        {analysesInFolder.length > 0 && (
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
                const isActive = analysis.source === 'youtube'
                  ? (sourceMode === 'youtube' && ytActiveAnalysis?.id === analysis.id)
                  : (sourceMode === 'file' && selectedAnalysis?.id === analysis.id)
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
                        <div className="flex items-center gap-1.5">
                          {analysis.source === 'youtube'
                            ? <MonitorPlay size={14} className="text-red-500 shrink-0" />
                            : <Upload size={14} className="text-gray-500 shrink-0" />}
                          <h4 className="font-bold truncate">
                            {analysis.source === 'youtube' ? `유튜브 · ${analysis.videoId}` : analysis.filename}
                          </h4>
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

        {/* 내 시뮬레이션 업로드 & 스크랩 */}
        <div ref={playerSectionRef} className="bg-surface rounded-2xl shadow-card border border-white/10 scroll-mt-4 overflow-hidden">
          <button
            onClick={() => setAnalysisOpen(!analysisOpen)}
            className="w-full flex items-center justify-between gap-2 p-4 md:p-6 text-left hover:bg-white/[0.02] transition"
          >
            <div className="min-w-0">
              <h3 className="text-lg font-extrabold">내 시뮬레이션 분석</h3>
              <p className="text-xs text-gray-500 truncate">{weekLabel} · {selectedFolder}</p>
            </div>
            <ChevronDown
              size={20}
              className={`shrink-0 text-gray-500 transition-transform ${analysisOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <div className={analysisOpen ? 'p-4 md:p-6 pt-0' : 'hidden'}>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSourceMode('file')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm transition ${
                sourceMode === 'file' ? 'bg-brand text-white' : 'bg-surface-alt text-gray-400 hover:bg-white/10'
              }`}
            >
              <Upload size={14} />
              파일 업로드
            </button>
            <button
              onClick={() => setSourceMode('youtube')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm transition ${
                sourceMode === 'youtube' ? 'bg-brand text-white' : 'bg-surface-alt text-gray-400 hover:bg-white/10'
              }`}
            >
              <MonitorPlay size={14} />
              유튜브 링크
            </button>
          </div>

          {sourceMode === 'file' && (
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
                      <div className="bg-brand-light p-3 rounded-xl flex items-center justify-between">
                        <h4 className="font-bold truncate">{selectedAnalysis.filename}</h4>
                        <span className="text-sm text-gray-400 shrink-0 ml-2">스크랩 {scraps.length}개</span>
                      </div>

                      <div ref={scrapListRef} className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                        {scraps.map((scrap) => (
                          <div key={scrap.id} data-scrap-id={scrap.id}>
                            <ScrapEditor
                              scrap={scrap}
                              onUpdate={updateScrap}
                              onDelete={deleteScrap}
                              onAskQuestion={handleAskAboutScrap}
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
          )}

          {sourceMode === 'youtube' && (
            <div className="space-y-4">
              {!ytActiveAnalysis && (
                <div className="bg-surface-alt rounded-xl p-4 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-2 block">유튜브 링크</label>
                    <input
                      type="url"
                      inputMode="url"
                      value={ytUrlInput}
                      onChange={(e) => handleYtUrlChange(e.target.value)}
                      placeholder="https://youtu.be/..."
                      className="w-full p-3.5 border border-white/10 rounded-xl text-base bg-surface focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                    <p className="text-[11px] text-gray-500 mt-1.5">
                      링크에 시간(t=)이 있으면 아래가 자동으로 채워져요
                    </p>
                  </div>
                  <TimeHMSInput
                    hours={ytStartHMS.hours}
                    minutes={ytStartHMS.minutes}
                    seconds={ytStartHMS.seconds}
                    onChange={setYtStartHMS}
                    label="시작 시간 (시 · 분 · 초)"
                  />
                  <button
                    onClick={handleYtLoad}
                    disabled={!ytUrlInput.trim()}
                    className="w-full bg-brand hover:bg-brand-dark disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition active:scale-95"
                  >
                    불러오기
                  </button>
                </div>
              )}

              {ytActiveAnalysis && (
                <>
                  <MyYoutubeAnalysis
                    videoId={ytActiveAnalysis.videoId}
                    startSeconds={ytActiveAnalysis.startSeconds}
                    scraps={ytActiveAnalysis.scraps}
                    onAddScrap={handleYtAddScrap}
                    onDeleteScrap={handleYtDeleteScrap}
                  />
                  <button
                    onClick={() => setYtActiveAnalysis(null)}
                    className="w-full flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/15 text-gray-300 font-bold py-2.5 px-4 rounded-xl transition"
                  >
                    <RotateCcw size={16} />
                    다른 링크 추가하기
                  </button>
                </>
              )}
            </div>
          )}
          </div>
        </div>

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
  )
}
