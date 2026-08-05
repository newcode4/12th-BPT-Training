import { useState, useEffect, useRef, useCallback } from 'react'
import { Bookmark } from 'lucide-react'
import { formatTime } from '../utils/formatters'

const BAR_COUNT = 300

function niceTicks(duration, count = 7) {
  if (!duration) return []
  const step = duration / (count - 1)
  return Array.from({ length: count }, (_, i) => i * step)
}

export default function WaveformScrubber({ file, duration, currentTime, onSeek, onScrapPlay, scraps = [] }) {
  const [peaks, setPeaks] = useState([])
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const draggingRef = useRef(false)

  useEffect(() => {
    if (!file) return
    let cancelled = false
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    const audioCtx = new AudioCtx()

    file.arrayBuffer()
      .then((buf) => audioCtx.decodeAudioData(buf))
      .then((audioBuffer) => {
        if (cancelled) return
        const raw = audioBuffer.getChannelData(0)
        const blockSize = Math.max(1, Math.floor(raw.length / BAR_COUNT))
        const rawPeaks = []
        for (let i = 0; i < BAR_COUNT; i++) {
          const start = i * blockSize
          let max = 0
          for (let j = 0; j < blockSize; j++) {
            const v = Math.abs(raw[start + j] || 0)
            if (v > max) max = v
          }
          rawPeaks.push(max)
        }
        const maxPeak = Math.max(...rawPeaks, 0.05)
        setPeaks(rawPeaks.map((p) => Math.max(0.06, p / maxPeak)))
      })
      .catch(() => setPeaks([]))

    return () => {
      cancelled = true
      audioCtx.close().catch(() => {})
    }
  }, [file])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || peaks.length === 0) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const barWidth = width / peaks.length
    const progressRatio = duration > 0 ? currentTime / duration : 0
    const mid = height / 2

    peaks.forEach((p, i) => {
      const barHeight = Math.max(2, p * (height - 8))
      const x = i * barWidth
      const played = i / peaks.length < progressRatio
      ctx.fillStyle = played ? '#E5253A' : '#3F4046'
      ctx.fillRect(x, mid - barHeight / 2, Math.max(1, barWidth - 1.2), barHeight)
    })
  }, [peaks, currentTime, duration])

  useEffect(() => {
    draw()
  }, [draw])

  const seekFromClientX = (clientX) => {
    const el = containerRef.current
    if (!el || !duration) return
    const rect = el.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    onSeek(ratio * duration)
  }

  const handlePointerDown = (e) => {
    draggingRef.current = true
    seekFromClientX(e.clientX)
    const handleMove = (ev) => {
      if (draggingRef.current) seekFromClientX(ev.clientX)
    }
    const handleUp = () => {
      draggingRef.current = false
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  const ticks = niceTicks(duration)
  const playheadPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0
  const sortedScraps = [...scraps].sort((a, b) => a.timestamp - b.timestamp)

  return (
    <div className="bg-surface border border-white/10 rounded-2xl p-3 select-none">
      {/* 시간 눈금자 */}
      <div className="relative h-5 mb-1 text-[10px] text-gray-500 font-mono">
        {ticks.map((t, i) => (
          <span
            key={i}
            className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
            style={{ left: `${(t / (duration || 1)) * 100}%` }}
          >
            {formatTime(t)}
          </span>
        ))}
      </div>

      {/* 파형 + 스크랩 마커 + 재생헤드 */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        className="relative h-20 cursor-pointer touch-none"
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* 스크랩 마커 (파형 위 작은 점) */}
        {duration > 0 && scraps.map((scrap) => (
          <div
            key={scrap.id}
            title={`스크랩 ${formatTime(scrap.timestamp)}`}
            className="absolute top-0 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-400 border border-white shadow pointer-events-none"
            style={{ left: `${(scrap.timestamp / duration) * 100}%` }}
          />
        ))}

        {/* 재생헤드 */}
        <div
          className="absolute top-0 bottom-0 w-px bg-white pointer-events-none"
          style={{ left: `${playheadPct}%` }}
        >
          <div className="absolute -top-1 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white" />
        </div>
      </div>

      {/* 스크랩 칩 - 클릭하면 바로 그 지점부터 재생 */}
      {sortedScraps.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-3 mt-1 border-t border-white/10">
          {sortedScraps.map((scrap) => (
            <button
              key={scrap.id}
              onClick={() => onScrapPlay?.(scrap)}
              className="flex items-center gap-1 bg-brand-light hover:bg-red-500/20 active:scale-95 text-brand font-mono font-bold text-xs px-3 py-1.5 rounded-full transition"
            >
              <Bookmark size={11} />
              {formatTime(scrap.timestamp)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
