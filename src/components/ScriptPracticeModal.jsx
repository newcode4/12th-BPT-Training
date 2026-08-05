import { useState, useEffect, useRef } from 'react'
import { PenLine, X, Check, Play, Pause, RotateCcw, Copy } from 'lucide-react'
import { formatTime, generateUUID } from '../utils/formatters'
import { putRecord, removeRecord } from '../utils/cloudStore'

// 한국어 발표 기준 대략 분당 320자 정도로 잡아 예상 시간을 보여준다
const CHARS_PER_MINUTE = 320

export default function ScriptPracticeModal({
  questionId, questionTitle, questionContent, existing, author, onSaved, onClose,
}) {
  const [script, setScript] = useState(existing?.text || '')
  const [savedAt, setSavedAt] = useState(null)
  const [timeLeft, setTimeLeft] = useState(60)
  const [running, setRunning] = useState(false)
  const textareaRef = useRef(null)
  const recordIdRef = useRef(existing?.id || generateUUID())
  const dirtyRef = useRef(false)

  useEffect(() => {
    if (!running) return
    if (timeLeft <= 0) {
      setRunning(false)
      return
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearTimeout(timer)
  }, [running, timeLeft])

  // 입력이 멈추면 자동 저장 (따로 저장 버튼을 누르지 않아도 날아가지 않게)
  useEffect(() => {
    if (!questionId || !dirtyRef.current) return
    const t = setTimeout(() => { persist(script) }, 800)
    return () => clearTimeout(t)
  }, [script, questionId])

  const persist = async (text) => {
    if (!questionId) return
    const record = { id: recordIdRef.current, questionId, text, author }
    try {
      if (text.trim()) {
        await putRecord('script', record, { author })
        onSaved?.(questionId, record)
      } else {
        await removeRecord('script', record.id)
        onSaved?.(questionId, null)
      }
      setSavedAt(Date.now())
    } catch (e) {
      console.error('스크립트 저장 실패', e)
    }
  }

  const charCount = script.trim().length
  const estimatedSeconds = Math.round((charCount / CHARS_PER_MINUTE) * 60)
  const overOneMinute = estimatedSeconds > 60

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(script)
      alert('스크립트를 복사했어요.')
    } catch {
      alert('복사에 실패했어요. 길게 눌러 직접 복사해주세요.')
    }
  }

  return (
    <div
      className="anim-fade fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 md:p-4"
      onClick={onClose}
    >
      <div
        className="anim-modal bg-surface rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-lg p-5 md:p-6 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="flex items-center gap-2 text-lg md:text-xl font-extrabold">
            <PenLine size={19} className="text-brand" />
            대처 스크립트 작성
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        {/* 질문 */}
        <div className="bg-brand-light border border-brand/20 p-4 rounded-xl mb-4">
          <p className="text-[11px] font-bold text-brand mb-1">돌발질문</p>
          <p className="font-bold text-gray-100 leading-snug">{questionTitle}</p>
          {questionContent && (
            <p className="text-sm text-gray-300 whitespace-pre-wrap mt-2 leading-relaxed">
              {questionContent}
            </p>
          )}
        </div>

        {/* 스크립트 작성 */}
        <textarea
          ref={textareaRef}
          value={script}
          onChange={(e) => { dirtyRef.current = true; setScript(e.target.value) }}
          placeholder={'이 질문에 어떻게 답할지 그대로 적어보세요.\n\n예)\n먼저 공감 →  기준 설명 →  대안 제시'}
          rows="9"
          className="w-full p-3.5 bg-surface-alt border border-white/10 rounded-xl text-base leading-relaxed focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />

        <div className="flex items-center justify-between gap-2 mt-2 mb-4 text-[11px]">
          <span className="text-gray-500">
            {charCount}자 · 말하면 약 {formatTime(estimatedSeconds)}
            {overOneMinute && <span className="text-amber-400 font-bold"> (1분 초과)</span>}
          </span>
          {savedAt && (
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <Check size={11} />
              자동 저장됨
            </span>
          )}
        </div>

        {/* 1분 타이머 - 쓴 스크립트를 소리내어 읽어보는 용도 */}
        <div className="bg-surface-alt border border-white/10 rounded-xl p-4 mb-4 text-center">
          <p className="text-[11px] font-bold text-gray-400 mb-2">쓴 스크립트로 1분 안에 말해보기</p>
          <div
            className={`text-4xl font-bold font-mono mb-3 transition-all duration-300 ${
              running
                ? 'text-brand scale-110 drop-shadow-[0_0_18px_rgba(229,37,58,0.65)]'
                : timeLeft === 0 ? 'text-amber-400' : 'text-brand'
            }`}
          >
            {formatTime(timeLeft)}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setRunning(!running)}
              disabled={timeLeft <= 0}
              className={`shine relative flex-1 flex items-center justify-center gap-1.5 bg-brand hover:bg-brand-dark disabled:opacity-40 text-white font-bold py-2.5 rounded-xl transition active:scale-95 ${running ? 'pulse-ring' : ''}`}
            >
              {running ? <Pause size={15} /> : <Play size={15} />}
              {running ? '일시정지' : '타이머 시작'}
            </button>
            <button
              onClick={() => { setRunning(false); setTimeLeft(60) }}
              className="flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/15 text-gray-300 font-bold py-2.5 px-4 rounded-xl transition active:scale-95"
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            disabled={!charCount}
            className="flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/15 disabled:opacity-40 text-gray-300 font-bold py-3 px-4 rounded-xl transition active:scale-95"
          >
            <Copy size={15} />
            복사
          </button>
          <button
            onClick={async () => {
              if (dirtyRef.current) await persist(script)
              onClose()
            }}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition active:scale-95"
          >
            저장하고 닫기
          </button>
        </div>
      </div>
    </div>
  )
}
