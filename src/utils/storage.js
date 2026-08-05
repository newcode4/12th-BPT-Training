const STORAGE_KEY = 'pt-simulation-data'

export function getStorageData() {
  const data = localStorage.getItem(STORAGE_KEY)
  return data
    ? JSON.parse(data)
    : { analyses: [], questions: [], recordings: [], emergencyItems: [], insights: [], weekFeedback: {}, refScraps: [] }
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

export function getQuestions() {
  const data = getStorageData()
  return data.questions || []
}

export function saveQuestion(question) {
  const data = getStorageData()
  data.questions = data.questions || []
  data.questions.push(question)
  saveStorageData(data)
}

export function updateQuestion(id, question) {
  const data = getStorageData()
  const index = data.questions.findIndex(q => q.id === id)
  if (index !== -1) {
    data.questions[index] = question
    saveStorageData(data)
  }
}

export function deleteQuestion(id) {
  const data = getStorageData()
  data.questions = data.questions.filter(q => q.id !== id)
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

// 주차별 나의 피드백
export function getWeekFeedback(week) {
  const data = getStorageData()
  return (data.weekFeedback || {})[week] || ''
}

export function saveWeekFeedback(week, text) {
  const data = getStorageData()
  data.weekFeedback = data.weekFeedback || {}
  data.weekFeedback[week] = text
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
