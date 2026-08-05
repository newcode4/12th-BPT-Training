import { useState } from 'react'
import { ShieldCheck, X } from 'lucide-react'
import { isAdminMode, tryEnableAdminMode, disableAdminMode } from '../utils/admin'

export default function AdminGate() {
  const [admin, setAdmin] = useState(isAdminMode())
  const [showPrompt, setShowPrompt] = useState(false)
  const [pin, setPin] = useState('')

  const handleSubmit = () => {
    if (tryEnableAdminMode(pin.trim())) {
      setAdmin(true)
      setShowPrompt(false)
      setPin('')
    } else {
      alert('PIN이 올바르지 않아요.')
    }
  }

  const handleDisable = () => {
    disableAdminMode()
    setAdmin(false)
  }

  if (admin) {
    return (
      <button
        onClick={handleDisable}
        className="inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:text-brand-dark"
      >
        <ShieldCheck size={12} />
        관리자 모드 켜짐 (끄기)
      </button>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowPrompt(true)}
        className="text-[11px] text-gray-600 hover:text-gray-400"
      >
        관리자
      </button>

      {showPrompt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl shadow-xl max-w-xs w-full p-6 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2 text-base font-extrabold">
                <ShieldCheck size={18} className="text-brand" />
                관리자 인증
              </h3>
              <button onClick={() => setShowPrompt(false)} className="text-gray-500 hover:text-gray-200">
                <X size={18} />
              </button>
            </div>
            <input
              type="password"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="PIN 입력"
              className="w-full p-3 border border-white/10 rounded-xl mb-3 text-center tracking-widest focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <button
              onClick={handleSubmit}
              className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-xl transition"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  )
}
