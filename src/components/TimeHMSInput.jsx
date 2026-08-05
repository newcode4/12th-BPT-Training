import { hmsToSeconds, secondsToHMS } from '../utils/formatters'

export default function TimeHMSInput({ hours, minutes, seconds, onChange, label = '시작 시간' }) {
  const update = (field, raw) => {
    const val = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0)
    const next = { hours, minutes, seconds, [field]: val }
    onChange(next)
  }

  const total = hmsToSeconds(hours, minutes, seconds)
  const preview = total > 0 ? `${hours}시간 ${minutes}분 ${seconds}초` : '처음부터 재생'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-gray-400">{label}</label>
        <span className="text-[11px] font-semibold text-brand">{preview}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { field: 'hours', label: '시', max: 99 },
          { field: 'minutes', label: '분', max: 59 },
          { field: 'seconds', label: '초', max: 59 },
        ].map(({ field, label: unitLabel, max }) => (
          <div key={field} className="text-center">
            <input
              type="number"
              min="0"
              max={max}
              value={field === 'hours' ? hours : field === 'minutes' ? minutes : seconds}
              onChange={(e) => {
                const raw = e.target.value
                if (raw === '') {
                  update(field, '')
                  return
                }
                const n = Math.min(max, Math.max(0, parseInt(raw, 10) || 0))
                update(field, String(n))
              }}
              placeholder="0"
              className="w-full p-2.5 border border-white/10 rounded-xl text-sm text-center font-mono font-bold bg-surface focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <span className="text-[10px] font-bold text-gray-500 mt-1 block">{unitLabel}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function applySecondsToHMS(seconds, onChange) {
  onChange(secondsToHMS(seconds))
}
