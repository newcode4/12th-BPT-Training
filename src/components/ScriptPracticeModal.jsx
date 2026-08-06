import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { PenLine, X, Check, Play, Pause, RotateCcw, Copy, EyeOff, Eye } from 'lucide-react'
import { formatTime, generateUUID } from '../utils/formatters'
import { putRecord, removeRecord } from '../utils/cloudStore'
import { supabase, supabaseConfigured } from '../utils/supabase'

// 한국어 발표 기준 대략 분당 320자 정도로 잡아 예상 시간을 보여준다
const CHARS_PER_MINUTE = 320
const TIMER_PRESETS = [30, 60, 90, 120]

// 돌발질문에서는 "원고 쓰기" = "답변하기" — 저장한 원고를 Q&A 공개 답변에도 그대로 반영한다.
// 한 사람당 한 질문에 공개 답변은 하나만 유지한다 (다시 쓰면 그 답변이 갱신된다).
async function syncPublicAnswer(questionId, author, text) {
  if (!supabaseConfigured || !questionId || !author) return
  const { data: existingAnswer } = await supabase
    .from('answers')
    .select('id')
    .eq('question_id', questionId)
    .eq('author', author)
    .maybeSingle()

  if (text.trim()) {
    if (existingAnswer) {
      await supabase.from('answers').update({ content: text }).eq('id', existingAnswer.id)
    } else {
      await supabase.from('answers').insert({ question_id: questionId, content: text, author })
    }
  } else if (existingAnswer) {
    await supabase.from('answers').delete().eq('id', existingAnswer.id)
  }
}

export default function ScriptPracticeModal({
  questionId, questionTitle, questionContent, existing, author, blind = false,
  syncAnswers = false, onSaved, onAnswerSynced, onClose,
}) {
  const hasExisting = Boolean(existing?.text)
  // 랜덤 뽑기의 목적은 "안 보고 말하기" — 이미 써둔 원고가 있어도 처음엔 가려둔다
  const [revealed, setRevealed] = useState(!(blind && hasExisting))
  const [script, setScript] = useState(existing?.text || '')
  const [savedAt, setSavedAt] = useState(null)
  const [duration, setDuration] = useState(60)
  const [timeLeft, setTimeLeft] = useState(60)
  const [running, setRunning] = useState(false)
  const textareaRef = useRef(null)
  const recordIdRef = useRef(existing?.id || generateUUID())
  const dirtyRef = useRef(false)

  // 모달이 떠 있는 동안 배경 페이지가 같이 스크롤되며 화면이 밀리는 것을 막는다
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

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

    if (syncAnswers) {
      try {
        await syncPublicAnswer(questionId, author, text)
        onAnswerSynced?.()
      } catch (e) {
        console.error('공개 답변 동기화 실패', e)
      }
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

  return createPortal(
    <div
      className="anim-fade fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto overscroll-contain"
      onClick={onClose}
    >
      <div
        className="anim-modal bg-surface rounded-2xl shadow-xl w-full md:max-w-lg p-5 md:p-6 max-h-[90vh] overflow-y-auto my-auto"
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

        {/* 스크립트 작성 / 블라인드 연습 */}
        {revealed ? (
          <>
            <textarea
              ref={textareaRef}
              value={script}
              onChange={(e) => { dirtyRef.current = true; setScript(e.target.value) }}
              placeholder={'이 질문에 어떻게 답할지 그대로 적어보세요.\n\n예)\n먼저 공감 →  기준 설명 →  대안 제시'}
              rows="9"
              spellCheck={false}
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
          </>
        ) : (
          <div className="p-5 mb-4 bg-surface-alt border border-dashed border-white/15 rounded-xl text-center space-y-2">
            <EyeOff size={20} className="mx-auto text-gray-500" />
            <p className="text-sm font-bold text-gray-300">원고를 보지 않고 먼저 말해보세요</p>
            <p className="text-[11px] text-gray-500">아래 타이머로 소리 내어 답해본 뒤 원고를 확인해보세요</p>
            <button
              onClick={() => setRevealed(true)}
              className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline mt-1"
            >
              <Eye size={13} />
              내가 쓴 원고 보기
            </button>
          </div>
        )}

        {/* 타이머 - 쓴 스크립트를 소리내어 읽어보는 용도, 시간은 직접 정할 수 있다 */}
        <div className="bg-surface-alt border border-white/10 rounded-xl p-4 mb-4 text-center">
          <p className="text-[11px] font-bold text-gray-400 mb-2">쓴 스크립트로 정해둔 시간 안에 말해보기</p>

          {!running && (
            <div className="flex justify-center gap-1.5 mb-3">
              {TIMER_PRESETS.map((sec) => (
                <button
                  key={sec}
                  onClick={() => { setDuration(sec); setTimeLeft(sec) }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    duration === sec ? 'bg-brand text-white' : 'bg-surface text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {sec < 60 ? `${sec}초` : `${sec / 60}분${sec % 60 ? ` ${sec % 60}초` : ''}`}
                </button>
              ))}
            </div>
          )}

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
              onClick={() => { setRunning(false); setTimeLeft(duration) }}
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
    </div>,
    document.body
  )
}
