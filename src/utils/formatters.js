export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0))
  const hours = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60
  // 라이브 다시보기처럼 몇 시간짜리 영상은 시(時)까지 보여줘야 읽힌다
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export function formatDate(date) {
  if (typeof date === 'string') {
    date = new Date(date)
  }
  return date.toLocaleString('ko-KR')
}

export function downloadJSON(data, filename) {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function getRandomQuestion(questions) {
  if (questions.length === 0) return null
  return questions[Math.floor(Math.random() * questions.length)]
}

export function getRandomItem(items) {
  if (items.length === 0) return null
  return items[Math.floor(Math.random() * items.length)]
}

// "4:12:30" (H:MM:SS) -> 15150 (초)
export function parseHMSToSeconds(hms) {
  const parts = hms.split(':').map(Number)
  if (parts.length === 3) {
    const [h, m, s] = parts
    return h * 3600 + m * 60 + s
  }
  if (parts.length === 2) {
    const [m, s] = parts
    return m * 60 + s
  }
  return 0
}

export function secondsToHMS(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds || 0))
  return {
    hours: Math.floor(safe / 3600),
    minutes: Math.floor((safe % 3600) / 60),
    seconds: safe % 60,
  }
}

export function hmsToSeconds(hours, minutes, seconds) {
  return (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60 + (Number(seconds) || 0)
}
