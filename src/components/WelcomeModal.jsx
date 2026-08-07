import { useState, useEffect } from 'react'
import { PartyPopper, Flame, Loader2, ShieldCheck, X, Crown } from 'lucide-react'
import { ROSTER, login, getTakenNames, loginAsAdmin, loginAsStaff, ADMIN_ACCOUNT_NAME, STAFF_ROSTER } from '../utils/auth'

function AdminLoginPrompt({ onComplete, onClose }) {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    const result = await loginAsAdmin(pin.trim())
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onComplete(ADMIN_ACCOUNT_NAME)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-2xl shadow-xl max-w-xs w-full p-6 border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="flex items-center gap-2 text-base font-extrabold">
            <ShieldCheck size={18} className="text-brand" />
            관리자 계정 로그인
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200">
            <X size={18} />
          </button>
        </div>
        <input
          type="password"
          autoFocus
          value={pin}
          onChange={(e) => { setPin(e.target.value); setError('') }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="PIN 입력"
          className="w-full p-3 border border-white/10 rounded-xl mb-3 text-center tracking-widest focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
        {error && <p className="text-xs font-bold text-red-400 text-center mb-3">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark disabled:opacity-60 text-white font-bold py-2.5 rounded-xl transition"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          확인
        </button>
      </div>
    </div>
  )
}

// 명단에 없는 간부(팀장/매니저) 전용 로그인 — 이름 선택 + 관리자와 같은 PIN.
// 관리자 모드는 안 켜지고, 일반 학생과 똑같이 쓸 수 있는 세션이 만들어진다.
function StaffLoginPrompt({ onComplete, onClose }) {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!name) {
      setError('이름을 선택해주세요.')
      return
    }
    setLoading(true)
    setError('')
    const result = await loginAsStaff(name, pin.trim())
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onComplete(name)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-2xl shadow-xl max-w-xs w-full p-6 border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="flex items-center gap-2 text-base font-extrabold">
            <Crown size={18} className="text-amber-400" />
            간부 계정 로그인
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200">
            <X size={18} />
          </button>
        </div>
        <select
          value={name}
          onChange={(e) => { setName(e.target.value); setError('') }}
          className="w-full p-3 border border-white/10 rounded-xl mb-3 text-center font-bold bg-surface focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        >
          <option value="">이름 선택</option>
          {STAFF_ROSTER.map((s) => (
            <option key={s.name} value={s.name}>{s.name} {s.label}님</option>
          ))}
        </select>
        <input
          type="password"
          value={pin}
          onChange={(e) => { setPin(e.target.value); setError('') }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="PIN 입력"
          className="w-full p-3 border border-white/10 rounded-xl mb-3 text-center tracking-widest focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
        {error && <p className="text-xs font-bold text-red-400 text-center mb-3">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark disabled:opacity-60 text-white font-bold py-2.5 rounded-xl transition"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          확인
        </button>
      </div>
    </div>
  )
}

export default function WelcomeModal({ onComplete }) {
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [taken, setTaken] = useState([])
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [showStaffLogin, setShowStaffLogin] = useState(false)

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

        {/*
          명단에 없는 예약된 관리자 계정으로 들어가는 문. PIN을 모르면 못 들어가니
          일반 학생 눈에 띄어도 상관없다 (기존 관리자 모드 PIN 입력창과 같은 방식).
        */}
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => setShowAdminLogin(true)}
            className="text-center text-[11px] text-gray-600 hover:text-gray-400"
          >
            관리자로 로그인
          </button>
          <span className="text-gray-700">·</span>
          <button
            onClick={() => setShowStaffLogin(true)}
            className="text-center text-[11px] text-gray-600 hover:text-gray-400"
          >
            간부로 로그인
          </button>
        </div>
      </div>

      {showAdminLogin && (
        <AdminLoginPrompt
          onClose={() => setShowAdminLogin(false)}
          onComplete={(name) => { setShowAdminLogin(false); onComplete(name) }}
        />
      )}

      {showStaffLogin && (
        <StaffLoginPrompt
          onClose={() => setShowStaffLogin(false)}
          onComplete={(name) => { setShowStaffLogin(false); onComplete(name) }}
        />
      )}
    </div>
  )
}
