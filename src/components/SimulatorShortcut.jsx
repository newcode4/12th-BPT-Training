import { Rocket } from 'lucide-react'

const SIMULATOR_URL = 'https://azuremooni.github.io/businesspt-simulator/'

// 모바일에서는 하단 탭바 바로 위에 밀착시킨 작은 원형 버튼으로 (공간을 적게 차지하게).
// Q&A 글쓰기 플로팅 버튼(bottom-24)이 함께 있는 화면에서만 그 위로 살짝 띄운다.
export default function SimulatorShortcut({ raised = false }) {
  return (
    <a
      href={SIMULATOR_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="비즈니스 PT 시뮬레이터 바로가기"
      className={`shine anim-pop group fixed ${raised ? 'bottom-40' : 'bottom-20'} md:bottom-24 right-4 md:right-8 z-20 flex items-center justify-center md:justify-start gap-1.5 bg-surface/95 backdrop-blur border border-brand/40 hover:border-brand hover:bg-brand text-brand hover:text-white font-bold w-12 h-12 md:w-auto md:h-auto md:pl-3.5 md:pr-4 md:py-2.5 rounded-full shadow-floating transition-all duration-300 hover:scale-105 active:scale-95`}
    >
      <Rocket size={16} className="shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-12" />
      <span className="hidden md:inline text-xs whitespace-nowrap">시뮬레이터</span>
    </a>
  )
}
