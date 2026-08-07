import { Crown, Star } from 'lucide-react'
import { getStaffInfo } from '../utils/auth'

// 팀장/매니저가 남긴 글·댓글 옆에 붙는 배지. 팀장은 매니저보다 눈에 띄게 한 단계 위로 보여준다.
export default function StaffBadge({ author }) {
  const staff = getStaffInfo(author)
  if (!staff) return null

  if (staff.role === 'lead') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shrink-0">
        <Crown size={10} />
        {staff.label}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-light text-brand shrink-0">
      <Star size={10} />
      {staff.label}
    </span>
  )
}
