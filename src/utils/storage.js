const STORAGE_KEY = 'pt-simulation-data'

export function getStorageData() {
  const data = localStorage.getItem(STORAGE_KEY)
  return data
    ? JSON.parse(data)
    : { analyses: [], recordings: [], emergencyItems: [], insights: [], feedbackEntries: [], refScraps: [], adminReferenceVideos: [], adminFolders: {} }
}

export function saveStorageData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function getAnalyses() {
  const data = getStorageData()
  return data.analyses || []
}

export function saveAnalysis(analysis) {
  const data = getStorageData()
  data.analyses = data.analyses || []
  data.analyses.push(analysis)
  saveStorageData(data)
}

export function updateAnalysis(id, analysis) {
  const data = getStorageData()
  const index = data.analyses.findIndex(a => a.id === id)
  if (index !== -1) {
    data.analyses[index] = analysis
    saveStorageData(data)
  }
}

export function deleteAnalysis(id) {
  const data = getStorageData()
  data.analyses = data.analyses.filter(a => a.id !== id)
  saveStorageData(data)
}

export function getRecordings() {
  const data = getStorageData()
  return data.recordings || []
}

export function saveRecording(recording) {
  const data = getStorageData()
  data.recordings = data.recordings || []
  data.recordings.push(recording)
  saveStorageData(data)
}

export function deleteRecording(id) {
  const data = getStorageData()
  data.recordings = data.recordings.filter(r => r.id !== id)
  saveStorageData(data)
}

// 돌발사항 (돌발 연습실)
export function getEmergencyItems() {
  const data = getStorageData()
  return data.emergencyItems || []
}

export function saveEmergencyItem(item) {
  const data = getStorageData()
  data.emergencyItems = data.emergencyItems || []
  data.emergencyItems.push(item)
  saveStorageData(data)
}

export function updateEmergencyItem(id, item) {
  const data = getStorageData()
  data.emergencyItems = data.emergencyItems || []
  const index = data.emergencyItems.findIndex(e => e.id === id)
  if (index !== -1) {
    data.emergencyItems[index] = item
    saveStorageData(data)
  }
}

export function deleteEmergencyItem(id) {
  const data = getStorageData()
  data.emergencyItems = (data.emergencyItems || []).filter(e => e.id !== id)
  saveStorageData(data)
}

// 주차별 집단지성 인사이트
export function getInsights() {
  const data = getStorageData()
  return data.insights || []
}

export function saveInsight(insight) {
  const data = getStorageData()
  data.insights = data.insights || []
  data.insights.push(insight)
  saveStorageData(data)
}

export function updateInsight(id, insight) {
  const data = getStorageData()
  data.insights = data.insights || []
  const index = data.insights.findIndex(i => i.id === id)
  if (index !== -1) {
    data.insights[index] = insight
    saveStorageData(data)
  }
}

export function deleteInsight(id) {
  const data = getStorageData()
  data.insights = (data.insights || []).filter(i => i.id !== id)
  saveStorageData(data)
}

// 주차별 나의 피드백 (자유롭게 여러 개 기록 - 스크랩과 별개)
export function getFeedbackEntries(week) {
  const data = getStorageData()
  return (data.feedbackEntries || []).filter(f => f.week === week)
}

export function saveFeedbackEntry(entry) {
  const data = getStorageData()
  data.feedbackEntries = data.feedbackEntries || []
  data.feedbackEntries.push(entry)
  saveStorageData(data)
}

export function deleteFeedbackEntry(id) {
  const data = getStorageData()
  data.feedbackEntries = (data.feedbackEntries || []).filter(f => f.id !== id)
  saveStorageData(data)
}

// 관리자 - 주차별 예시 영상 추가/삭제 (기본 예시에 얹어짐)
export function getAdminReferenceVideos(week) {
  const data = getStorageData()
  return (data.adminReferenceVideos || []).filter(v => v.week === week)
}

export function saveAdminReferenceVideo(video) {
  const data = getStorageData()
  data.adminReferenceVideos = data.adminReferenceVideos || []
  data.adminReferenceVideos.push(video)
  saveStorageData(data)
}

export function deleteAdminReferenceVideo(id) {
  const data = getStorageData()
  data.adminReferenceVideos = (data.adminReferenceVideos || []).filter(v => v.id !== id)
  saveStorageData(data)
}

// 관리자 - 주차별 세부 폴더(카테고리) 추가/삭제
export function getAdminFolders(week) {
  const data = getStorageData()
  return (data.adminFolders || {})[week] || []
}

export function saveAdminFolder(week, folderName) {
  const data = getStorageData()
  data.adminFolders = data.adminFolders || {}
  data.adminFolders[week] = data.adminFolders[week] || []
  if (!data.adminFolders[week].includes(folderName)) {
    data.adminFolders[week].push(folderName)
  }
  saveStorageData(data)
}

export function deleteAdminFolder(week, folderName) {
  const data = getStorageData()
  data.adminFolders = data.adminFolders || {}
  data.adminFolders[week] = (data.adminFolders[week] || []).filter(f => f !== folderName)
  saveStorageData(data)
}

// 예시 영상(유튜브) 스크랩
export function getRefScraps(videoId) {
  const data = getStorageData()
  return (data.refScraps || []).filter(s => s.videoId === videoId)
}

export function saveRefScrap(scrap) {
  const data = getStorageData()
  data.refScraps = data.refScraps || []
  data.refScraps.push(scrap)
  saveStorageData(data)
}

export function deleteRefScrap(id) {
  const data = getStorageData()
  data.refScraps = (data.refScraps || []).filter(s => s.id !== id)
  saveStorageData(data)
}
