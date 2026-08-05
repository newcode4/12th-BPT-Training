import { Rocket } from 'lucide-react'

const SIMULATOR_URL = 'https://azuremooni.github.io/businesspt-simulator/'

// Q&A 글쓰기 버튼(bottom-24 / md:bottom-8)과 겹치지 않도록 한 칸 위에 띄운다
export default function SimulatorShortcut() {
  return (
    <a
      href={SIMULATOR_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="비즈니스 PT 시뮬레이터 바로가기"
      className="shine anim-pop group fixed bottom-40 md:bottom-24 right-4 md:right-8 z-20 flex items-center gap-1.5 bg-surface/95 backdrop-blur border border-brand/40 hover:border-brand hover:bg-brand text-brand hover:text-white font-bold pl-3.5 pr-4 py-2.5 rounded-full shadow-floating transition-all duration-300 hover:scale-105 active:scale-95"
    >
      <Rocket size={16} className="shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-12" />
      <span className="text-xs whitespace-nowrap">시뮬레이터</span>
    </a>
  )
}
