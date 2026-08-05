import { useState } from 'react'
import { User, X } from 'lucide-react'

export default function ProfileModal({ onClose, forced = false }) {
  const [nickname, setNickname] = useState(localStorage.getItem('qa-author') || '')

  const handleSave = () => {
    const name = nickname.trim() || '익명'
    localStorage.setItem('qa-author', name)
    onClose(name)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl shadow-xl max-w-sm w-full p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="flex items-center gap-2 text-xl font-extrabold">
            <User size={20} className="text-brand" />
            내 프로필
          </h3>
          {!forced && (
            <button
              onClick={() => onClose(null)}
              className="text-gray-500 hover:text-gray-200"
            >
              <X size={20} />
            </button>
          )}
        </div>
        <p className="text-sm text-gray-400 mb-4">
          {forced
            ? '게시판에서 사용할 닉네임을 설정해주세요. 나중에 언제든 바꿀 수 있어요.'
            : '닉네임을 자유롭게 변경할 수 있어요.'}
        </p>
        <input
          type="text"
          autoFocus
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder="닉네임 입력"
          className="w-full p-3 border border-white/10 rounded-xl mb-4 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
        <button
          onClick={handleSave}
          className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-3 rounded-xl transition"
        >
          {forced ? '시작하기' : '저장하기'}
        </button>
      </div>
    </div>
  )
}
