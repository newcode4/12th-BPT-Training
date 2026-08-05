import { useState, useEffect } from 'react'
import { Play, Pause } from 'lucide-react'
import { formatTime } from '../utils/formatters'
import WaveformScrubber from './WaveformScrubber'

export default function VideoPlayer({ file, videoRef, currentTime, onTimeUpdate, scraps = [], onScrapPlay }) {
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [fileURL, setFileURL] = useState(null)

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file)
      setFileURL(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [file])

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
    }
  }

  const handleTimeUpdate = (e) => {
    onTimeUpdate(e.currentTarget.currentTime)
  }

  const handleLoadedMetadata = (e) => {
    setDuration(e.currentTarget.duration)
  }

  const handleSeek = (time) => {
    onTimeUpdate(time)
    if (videoRef.current) {
      videoRef.current.currentTime = time
    }
  }

  const handleScrapPlay = (scrap) => {
    if (onScrapPlay) {
      onScrapPlay(scrap)
      return
    }
    handleSeek(scrap.timestamp)
    videoRef.current?.play()
  }

  return (
    <div className="space-y-3">
      <video
        ref={videoRef}
        src={fileURL}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        className="w-full rounded-2xl bg-black"
      />

      <WaveformScrubber
        file={file}
        duration={duration}
        currentTime={currentTime}
        onSeek={handleSeek}
        onScrapPlay={handleScrapPlay}
        scraps={scraps}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400 font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <button
          onClick={handlePlayPause}
          className="flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white font-bold px-5 py-2.5 rounded-xl transition"
        >
          {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          {isPlaying ? '일시정지' : '재생'}
        </button>
      </div>
    </div>
  )
}
