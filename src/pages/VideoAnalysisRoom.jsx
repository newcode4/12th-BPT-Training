import { useState, useEffect, useRef } from 'react'
import {
  Video, Bookmark, RotateCcw, Save, Archive, Download, Trash2,
  ChevronDown, Sparkles, ArrowUpDown, Upload, MonitorPlay, Folder,
  ShieldCheck, Plus, X, Mic, Square
} from 'lucide-react'
import { generateUUID, formatTime, downloadJSON, hmsToSeconds } from '../utils/formatters'
import {
  saveAnalysis, getAnalyses, updateAnalysis, deleteAnalysis,
  getInsights, getAdminFolders, saveAdminFolder, deleteAdminFolder
} from '../utils/storage'
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
  const [sortOrder, setSortOrder] = useState('newest') // 'newest' | 'oldest'
  const [adminFolders, setAdminFolders] = useState(() => getAdminFolders('0'))
  const [newFolderInput, setNewFolderInput] = useState('')
  const admin = isAdminMode()
  const author = localStorage.getItem('qa-author') || '익명'
  const videoRef = useRef(null)
  const scrapListRef = useRef(null)
  const lastScrapId = useRef(null)

  const [isRecording, setIsRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const mediaRecorderRef = useRef(null)
  const recordStreamRef = useRef(null)
  const recordChunksRef = useRef([])

  useEffect(() => {
    setAnalyses(getAnalyses())
    setInsights(getInsights())
  }, [])

  useEffect(() => {
    setAdminFolders(getAdminFolders(selectedWeek))
  }, [selectedWeek])

  useEffect(() => {
    setSelectedFolder(FULL_RECORDING_FOLDER)
    setYtActiveAnalysis(null)
    handleNewAnalysis()
  }, [selectedWeek])

  useEffect(() => {
    setYtActiveAnalysis(null)
    handleNewAnalysis()
  }, [selectedFolder])

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

  const folders = [FULL_RECORDING_FOLDER, ...(WEEK_CURRICULUM[selectedWeek] || []), ...adminFolders]

  const handleAddFolder = () => {
    const name = newFolderInput.trim()
    if (!name) return
    saveAdminFolder(selectedWeek, name)
    setAdminFolders([...adminFolders, name])
    setNewFolderInput('')
  }

  const handleDeleteFolder = (name) => {
    deleteAdminFolder(selectedWeek, name)
    setAdminFolders(adminFolders.filter(f => f !== name))
    if (selectedFolder === name) setSelectedFolder(FULL_RECORDING_FOLDER)
  }

  const applySelectedFile = (selectedFile) => {
    if (!selectedFile) return
    setFile(selectedFile)
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

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recordStreamRef.current = stream
      const mediaRecorder = new MediaRecorder(stream)
      recordChunksRef.current = []
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data)
      }
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordChunksRef.current, { type: 'audio/webm' })
        const filename = `녹음_${selectedFolder}_${Date.now()}.webm`
        applySelectedFile(new File([blob], filename, { type: 'audio/webm' }))
        stream.getTracks().forEach((t) => t.stop())
      }
      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      setRecordSeconds(0)
      setIsRecording(true)
    } catch (error) {
      alert('마이크 접근 권한이 필요합니다.')
    }
  }

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  useEffect(() => {
    if (!isRecording) return
    const timer = setInterval(() => setRecordSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [isRecording])

  useEffect(() => {
    return () => {
      if (recordStreamRef.current) {
        recordStreamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

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
    const analysis = { ...selectedAnalysis, scraps }
    const isExisting = analyses.some(a => a.id === analysis.id)

    if (file && file.size > 0) {
      try {
        await saveFileBlob(analysis.id, file)
      } catch (e) {
        console.error('파일 저장 실패', e)
      }
    }

    if (isExisting) {
      updateAnalysis(analysis.id, analysis)
      setAnalyses(analyses.map(a => a.id === analysis.id ? analysis : a))
    } else {
      saveAnalysis(analysis)
      setAnalyses([...analyses, analysis])
    }
    alert('분석이 저장되었습니다.')
    handleNewAnalysis()
  }

  const handleNewAnalysis = () => {
    setFile(null)
    setSelectedAnalysis(null)
    setScraps([])
    setCurrentTime(0)
    setLoopRange(null)
  }

  const handleDownloadAnalysis = (analysis) => {
    downloadJSON(analysis, `analysis-${analysis.filename || analysis.videoId}-${new Date().getTime()}.json`)
  }

  const handleDeleteAnalysis = (id) => {
    if (confirm('정말로 삭제하시겠습니까?')) {
      deleteAnalysis(id)
      deleteFileBlob(id).catch(() => {})
      setAnalyses(analyses.filter(a => a.id !== id))
      if (ytActiveAnalysis?.id === id) setYtActiveAnalysis(null)
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
      setScraps(analysis.scraps)
      const blob = await getFileBlob(analysis.id)
      if (blob) {
        setFile(new File([blob], analysis.filename, { type: blob.type || 'video/mp4' }))
      } else {
        alert('원본 파일을 찾을 수 없어요. 스크랩 메모는 볼 수 있지만 재생하려면 같은 파일을 다시 업로드해주세요.')
        setFile(new File([], analysis.filename))
      }
    }
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
      uploadedAt: new Date().toISOString()
    }
    saveAnalysis(analysis)
    setAnalyses([...analyses, analysis])
    setYtActiveAnalysis(analysis)
    setYtUrlInput('')
    setYtStartHMS({ hours: 0, minutes: 0, seconds: 0 })
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
    const newScrap = { id: generateUUID(), timestamp, note, createdAt: new Date().toISOString() }
    const updated = { ...ytActiveAnalysis, scraps: [...ytActiveAnalysis.scraps, newScrap] }
    updateAnalysis(updated.id, updated)
    setYtActiveAnalysis(updated)
    setAnalyses(analyses.map(a => a.id === updated.id ? updated : a))
  }

  const handleYtDeleteScrap = (scrapId) => {
    if (!ytActiveAnalysis) return
    const updated = { ...ytActiveAnalysis, scraps: ytActiveAnalysis.scraps.filter(s => s.id !== scrapId) }
    updateAnalysis(updated.id, updated)
    setYtActiveAnalysis(updated)
    setAnalyses(analyses.map(a => a.id === updated.id ? updated : a))
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
        {/* 모바일: 상단 가로 주차 탭 */}
        <div className="md:hidden bg-surface rounded-2xl shadow-card border border-white/10 p-4">
          <h2 className="flex items-center gap-2 text-xl font-extrabold mb-4">
            <Video size={20} className="text-brand" />
            시뮬레이션 분석실
          </h2>
          <div className="flex gap-1 overflow-x-auto -mx-1 px-1">
            {WEEKS.map((w) => (
              <WeekNavButton key={w.id} w={w} vertical={false} />
            ))}
          </div>
        </div>

        {/* 모바일: 폴더 탭 */}
        <div className="md:hidden bg-surface rounded-2xl shadow-card border border-white/10 p-4">
          <p className="flex items-center gap-1.5 text-xs font-bold text-gray-500 mb-3">
            <Folder size={13} />
            {weekLabel} 세부 폴더
          </p>
          <div className="flex flex-wrap gap-2">
            {folders.map((folder) => (
              <button
                key={folder}
                onClick={() => setSelectedFolder(folder)}
                className={`px-3 py-2 rounded-xl font-bold text-sm transition ${
                  selectedFolder === folder
                    ? 'bg-brand text-white'
                    : 'bg-surface-alt text-gray-400 hover:bg-white/10'
                }`}
              >
                {folder} <span className="opacity-70">({countByFolder(folder)})</span>
              </button>
            ))}
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
                  <span key={f} className="inline-flex items-center gap-1 text-xs font-bold bg-surface-alt text-gray-300 px-2.5 py-1 rounded-full">
                    {f}
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
            <p className="text-xs text-gray-500 mb-3">카드를 클릭하면 바로 불러와서 이어서 확인할 수 있어요</p>
            <div className="grid gap-3">
              {analysesInFolder.map((analysis) => (
                <div
                  key={analysis.id}
                  onClick={() => handleLoadAnalysis(analysis)}
                  className="p-4 border border-white/10 rounded-2xl hover:bg-surface-alt active:bg-white/10 transition cursor-pointer"
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
                      </div>
                      <p className="text-sm text-gray-400">
                        스크랩 {analysis.scraps.length}개 · {new Date(analysis.uploadedAt).toLocaleString('ko-KR')}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
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
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 내 시뮬레이션 업로드 & 스크랩 */}
        <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-extrabold">내 시뮬레이션 분석</h3>
            <span className="text-xs font-bold text-gray-500">{selectedFolder}</span>
          </div>

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
              <div className="bg-surface-alt rounded-xl p-4 mb-4 space-y-3">
                {!isRecording ? (
                  <button
                    onClick={handleStartRecording}
                    className="w-full flex items-center justify-center gap-1.5 bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-xl text-sm transition"
                  >
                    <Mic size={15} />
                    지금 바로 녹음하기
                  </button>
                ) : (
                  <button
                    onClick={handleStopRecording}
                    className="w-full flex items-center justify-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2.5 rounded-xl text-sm transition animate-pulse"
                  >
                    <Square size={14} fill="currentColor" />
                    녹음 중... {formatTime(recordSeconds)} (탭하여 종료)
                  </button>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <div className="flex-1 h-px bg-white/10" />
                  또는 파일 선택
                  <div className="flex-1 h-px bg-white/10" />
                </div>
                <input
                  type="file"
                  accept="video/*,audio/*"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-light file:text-brand hover:file:bg-red-500/20"
                />
              </div>

              {file && (
                <div className="space-y-4">
                  <VideoPlayer
                    file={file}
                    videoRef={videoRef}
                    currentTime={currentTime}
                    onTimeUpdate={handleTimeUpdate}
                    scraps={scraps}
                    onScrapPlay={handlePlayScrap}
                  />

                  {loopRange && (
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
                    <button
                      onClick={handleScrap}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl transition"
                    >
                      <Bookmark size={16} />
                      스크랩 ({currentTime.toFixed(1)}초)
                    </button>
                    <button
                      onClick={handleNewAnalysis}
                      className="flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/15 text-gray-300 font-bold py-3 px-4 rounded-xl transition"
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
                          className="w-full flex items-center justify-center gap-1.5 bg-brand hover:bg-brand-dark text-white font-bold py-3 px-4 rounded-xl transition"
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
                <div className="bg-surface-alt rounded-xl p-4 space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-1.5 block">유튜브 링크</label>
                    <input
                      type="text"
                      value={ytUrlInput}
                      onChange={(e) => handleYtUrlChange(e.target.value)}
                      placeholder="https://youtu.be/xxxxxxxxxxx"
                      className="w-full p-2.5 border border-white/10 rounded-xl text-sm bg-surface focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                    <p className="text-[11px] text-gray-500 mt-1.5">링크에 시간(t=)이 포함되어 있으면 자동으로 아래에 채워져요</p>
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
                    className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-xl text-sm transition"
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

        {/* 더보기 (인사이트 · 피드백) - 접기/펼치기 */}
        <div className="bg-surface rounded-2xl shadow-card border border-white/10 overflow-hidden">
          <button
            onClick={() => setNotesOpen(!notesOpen)}
            className="w-full flex items-center justify-between p-4 md:p-6"
          >
            <span className="flex items-center gap-2 text-sm font-extrabold text-gray-400">
              <Sparkles size={16} className="text-gray-500" />
              인사이트 & 피드백 더보기
            </span>
            <ChevronDown
              size={18}
              className={`text-gray-500 transition-transform ${notesOpen ? 'rotate-180' : ''}`}
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
