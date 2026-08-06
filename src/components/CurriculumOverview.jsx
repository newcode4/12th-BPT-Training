import { useState } from 'react'
import { ChevronDown, ListTree, Folder } from 'lucide-react'
import { WEEKS } from '../utils/weeks'
import { WEEK_CURRICULUM } from '../utils/curriculum'

const FULL_RECORDING_FOLDER = '전체 녹음'

// 주차를 하나씩 넘기지 않아도, 전체 커리큘럼(세부 폴더)을 한 화면에서 보고 바로 이동할 수 있게
export default function CurriculumOverview({ onSelect }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-surface rounded-2xl shadow-card border border-white/10 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 md:p-6"
      >
        <span className="flex items-center gap-2 text-sm font-extrabold text-gray-200">
          <ListTree size={16} className="text-brand" />
          전체 커리큘럼 한눈에 보기
        </span>
        <ChevronDown size={18} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* 주차마다 카드를 따로 두면 옆줄과 비교하며 훑기 번거로워서, 한 주차 = 한 줄로
          펼쳐서 라벨과 폴더가 나란히 한눈에 읽히게 한다 */}
      {open && (
        <div className="p-4 md:p-6 pt-0 space-y-2">
          {WEEKS.map((w) => (
            <div key={w.id} className="flex items-center flex-wrap gap-2 bg-surface-alt rounded-xl p-3">
              <p className="shrink-0 text-sm font-extrabold text-gray-100 pr-1">{w.label} · {w.title}</p>
              <button
                onClick={() => onSelect(w.id, FULL_RECORDING_FOLDER)}
                className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-brand-light text-brand hover:bg-red-500/20 transition"
              >
                <Folder size={11} />
                {FULL_RECORDING_FOLDER}
              </button>
              {(WEEK_CURRICULUM[w.id] || []).map((folder) => (
                <button
                  key={folder}
                  onClick={() => onSelect(w.id, folder)}
                  className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-surface text-gray-300 hover:bg-white/10 transition"
                >
                  {folder}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
