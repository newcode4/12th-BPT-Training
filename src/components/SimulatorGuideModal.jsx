import { createPortal } from 'react-dom'
import { X, PlayCircle } from 'lucide-react'

const GUIDE_VIDEO_ID = '8VZl2zUUa1w'

// 시뮬레이터 활용법 설명 영상 — 처음 들어왔을 때 한 번 자동으로 보여주고,
// 나중에 다시 보고 싶으면 상단 네비게이션의 가이드 버튼으로 언제든 다시 열 수 있다.
export default function SimulatorGuideModal({ onClose }) {
  return createPortal(
    <div
      className="anim-fade fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="anim-modal bg-surface rounded-2xl shadow-xl w-full max-w-lg border border-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="flex items-center gap-2 font-extrabold">
            <PlayCircle size={18} className="text-brand" />
            시뮬레이션 활용법
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200">
            <X size={20} />
          </button>
        </div>
        <div className="aspect-video bg-black">
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${GUIDE_VIDEO_ID}`}
            title="시뮬레이션 활용법"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="p-4">
          <button
            onClick={onClose}
            className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-xl text-sm transition active:scale-95"
          >
            확인했어요
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
