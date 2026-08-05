let apiPromise = null

export function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise

  apiPromise = new Promise((resolve) => {
    const prevCallback = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prevCallback?.()
      resolve(window.YT)
    }
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }
  })

  return apiPromise
}

function parseYouTubeTimeParam(value) {
  if (!value) return 0
  const raw = decodeURIComponent(value)
  if (/^\d+$/.test(raw)) return parseInt(raw, 10)
  const hmsMatch = raw.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/)
  if (hmsMatch && (hmsMatch[1] || hmsMatch[2] || hmsMatch[3])) {
    const h = parseInt(hmsMatch[1] || '0', 10)
    const m = parseInt(hmsMatch[2] || '0', 10)
    const s = parseInt(hmsMatch[3] || '0', 10)
    return h * 3600 + m * 60 + s
  }
  if (raw.includes(':')) {
    const parts = raw.split(':').map(Number)
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
    if (parts.length === 2) return parts[0] * 60 + parts[1]
  }
  return 0
}

// 다양한 유튜브 URL 형식에서 videoId 추출
export function parseYouTubeUrl(url) {
  if (!url) return null
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export function parseYouTubeStartSeconds(url) {
  if (!url) return 0
  const tMatch = url.match(/[?&]t=([^&]+)/)
  if (tMatch) return parseYouTubeTimeParam(tMatch[1])
  const startMatch = url.match(/[?&]start=(\d+)/)
  if (startMatch) return parseInt(startMatch[1], 10)
  return 0
}
