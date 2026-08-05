import { useState, useEffect, useRef } from 'react'
import { Mic, Square, X } from 'lucide-react'
import { formatTime } from '../utils/formatters'

export default function AnswerPracticeModal({ answerContent, onClose }) {
  const [timeLeft, setTimeLeft] = useState(60)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedURL, setRecordedURL] = useState(null)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])

  useEffect(() => {
    if (!isRecording) return
    if (timeLeft <= 0) {
      handleStop()
      return
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearTimeout(timer)
  }, [isRecording, timeLeft])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  const handleStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mediaRecorder = new MediaRecorder(stream)
      chunksRef.current = []
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setRecordedURL(URL.createObjectURL(blob))
        stream.getTracks().forEach((t) => t.stop())
      }
      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      setTimeLeft(60)
      setRecordedURL(null)
      setIsRecording(true)
    } catch (error) {
      alert('마이크 접근 권한이 필요합니다.')
    }
  }

  const handleStop = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="flex items-center gap-2 text-xl font-bold">
            <Mic size={20} className="text-brand" />
            1분 대처 연습
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        <div className="bg-surface-alt border border-white/10 p-4 rounded-xl mb-4 max-h-40 overflow-y-auto">
          <p className="text-sm font-semibold text-gray-200 mb-1">
            대처 멘트를 보면서 연습해보세요
          </p>
          <p className="text-gray-200 whitespace-pre-wrap text-sm">{answerContent}</p>
        </div>

        <div className="text-center">
          <div className="text-5xl font-bold text-brand font-mono mb-4">
            {formatTime(timeLeft)}
          </div>

          {!isRecording && !recordedURL && (
            <button
              onClick={handleStart}
              className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-bold py-3 px-6 rounded-xl text-lg transition"
            >
              <Mic size={18} />
              녹음 시작
            </button>
          )}

          {isRecording && (
            <>
              <button
                onClick={handleStop}
                className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-xl transition"
              >
                <Square size={16} fill="currentColor" />
                녹음 종료
              </button>
              <p className="mt-3 text-brand font-bold animate-pulse">녹음 중...</p>
            </>
          )}

          {recordedURL && !isRecording && (
            <div className="space-y-3">
              <audio src={recordedURL} controls className="w-full" />
              <div className="flex gap-2">
                <button
                  onClick={handleStart}
                  className="flex-1 bg-brand hover:bg-brand-dark text-white font-bold py-2.5 px-4 rounded-xl transition"
                >
                  다시 녹음
                </button>
                <a
                  href={recordedURL}
                  download={`practice-answer-${Date.now()}.webm`}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-4 rounded-xl text-center transition"
                >
                  다운로드
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
