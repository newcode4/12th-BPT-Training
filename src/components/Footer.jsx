import { MessageCircle } from 'lucide-react'
import AdminGate from './AdminGate'

const KAKAO_INQUIRY_URL = 'https://open.kakao.com/o/s2g1FvHi'

export default function Footer({ author }) {
  return (
    <footer className="max-w-5xl mx-auto px-4 pb-24 md:pb-8 pt-2 space-y-2">
      <p className="text-[11px] leading-relaxed text-gray-500 text-center">
        본 서비스는 비즈니스 PT 공식 서비스가 아닌, 교육생의 자가 학습 및 최종 테스트 대비를 위해 비공식적으로 제작된 개인 훈련용 도구입니다.
        <br />
        마이크를 통해 녹음된 음성 데이터는 외부 서버에 수집되거나 저장되지 않으며, 전적으로 브라우저 내부에서만 안전하게 임시 처리됩니다.
      </p>
      <div className="flex justify-center">
        <a
          href={KAKAO_INQUIRY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-400 hover:text-amber-300"
        >
          <MessageCircle size={12} />
          오류 · 아이디어 제보는 카카오톡 오픈채팅으로
        </a>
      </div>
      {author === '테스트관리자' && (
        <div className="flex justify-center">
          <AdminGate />
        </div>
      )}
    </footer>
  )
}
