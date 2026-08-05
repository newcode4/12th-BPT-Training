import { useState } from 'react'
import { User, X, LogOut, Loader2 } from 'lucide-react'
import { logout } from '../utils/auth'

export default function ProfileModal({ author, onLoggedOut, onClose }) {
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    if (!confirm('로그아웃하시겠어요? 다른 사람이 이 기기에서 로그인할 수 있게 자리가 비워져요.')) return
    setLoading(true)
    await logout()
    setLoading(false)
    onLoggedOut()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl shadow-xl max-w-sm w-full p-6 border border-white/10">
        <div className="flex items-center justify-between mb-1">
          <h3 className="flex items-center gap-2 text-lg font-extrabold">
            <User size={20} className="text-brand" />
            내 프로필
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">게시판과 연습 기록에 사용되는 이름이에요</p>

        <div className="bg-surface-alt rounded-xl p-4 text-center mb-4">
          <p className="text-lg font-extrabold text-white">{author}</p>
        </div>

        <button
          onClick={handleLogout}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 disabled:opacity-60 text-gray-200 font-bold py-3 rounded-xl transition"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
          로그아웃
        </button>
      </div>
    </div>
  )
}
