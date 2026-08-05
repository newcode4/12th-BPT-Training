import { useState, useEffect } from 'react'
import { PartyPopper, Flame, Loader2 } from 'lucide-react'
import { ROSTER, login, getTakenNames } from '../utils/auth'

export default function WelcomeModal({ onComplete }) {
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [taken, setTaken] = useState([])

  // 이미 등록해서 사용 중인 이름은 목록에서 빼준다
  useEffect(() => {
    let cancelled = false
    getTakenNames().then((names) => {
      if (!cancelled) setTaken(names)
    })
    return () => { cancelled = true }
  }, [])

  const available = ROSTER.filter(name => !taken.includes(name))

  const handleRegister = async () => {
    const name = selected.trim()
    if (!name) {
      setError('명단에서 본인 이름을 선택해주세요.')
      return
    }
    setLoading(true)
    setError('')
    const result = await login(name)
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onComplete(name)
  }

  return (
    <div className="aurora fixed inset-0 bg-toss-bg flex items-center justify-center z-50 p-4">
      <div className="anim-modal relative z-10 bg-surface/90 backdrop-blur-xl rounded-2xl shadow-xl max-w-md w-full p-6 md:p-8 border border-brand/30">
        <div className="flex justify-center mb-4">
          <div className="anim-pop glow-breathe w-16 h-16 rounded-full bg-brand/20 flex items-center justify-center">
            <PartyPopper size={32} className="text-brand" />
          </div>
        </div>

        <div className="stagger text-center space-y-1 mb-6">
          <p className="text-2xl md:text-3xl font-black text-brand leading-tight">
            할수있다!!
          </p>
          <p className="text-xl md:text-2xl font-extrabold text-white">
            우리는!
          </p>
          <p className="text-2xl md:text-3xl font-black text-gradient shine-always">
            레전드 12기!! 화이팅!!
          </p>
        </div>

        <div className="bg-surface-alt rounded-xl p-4 mb-5">
          <p className="text-sm font-bold text-gray-300 text-center mb-3 flex items-center justify-center gap-1.5">
            <Flame size={16} className="text-orange-400" />
            레전드 12기
            <span className="text-brand">예비 트레이너</span>
            등록
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-400 whitespace-nowrap shrink-0">레전드 12기</span>
            <select
              value={selected}
              onChange={(e) => { setSelected(e.target.value); setError('') }}
              className="flex-1 min-w-0 p-3 border border-white/10 rounded-xl text-center font-bold bg-surface focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            >
              <option value="">이름 선택</option>
              {available.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <span className="text-sm font-bold text-gray-400 whitespace-nowrap shrink-0">예비 트레이너</span>
          </div>
          {taken.length > 0 && (
            <p className="text-[11px] text-gray-500 text-center mt-2">
              이미 등록한 {taken.length}명은 목록에서 빠져 있어요
            </p>
          )}
          {error && <p className="text-xs font-bold text-red-400 text-center mt-2">{error}</p>}
        </div>

        <button
          onClick={handleRegister}
          disabled={loading}
          className="shine relative glow-breathe w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark disabled:opacity-60 text-white font-extrabold py-3.5 rounded-xl transition-transform active:scale-95 text-lg shadow-floating"
        >
          {loading && <Loader2 size={18} className="animate-spin" />}
          등록하고 시작하기
        </button>
      </div>
    </div>
  )
}
