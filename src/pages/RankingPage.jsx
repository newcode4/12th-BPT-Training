import { useState, useEffect } from 'react'
import { Trophy, Zap, MessageSquareText, Bookmark, Crown } from 'lucide-react'
import { supabase } from '../utils/supabase'
import { listRecords } from '../utils/cloudStore'
import { ROSTER } from '../utils/auth'

// 등수는 나만 알고, 남이 누군지는 절대 안 보이게 — 이름은 어디에도 안 뿌리고
// "N위 · 개수"만 익명으로 나열한다. 동점이면 같은 등수를 공유한다(1,2,2,4식).
function withRanks(rows, key) {
  const sorted = [...rows].sort((a, b) => b[key] - a[key])
  let rank = 0
  let prevValue = null
  let seen = 0
  return sorted.map((r) => {
    seen += 1
    if (r[key] !== prevValue) {
      rank = seen
      prevValue = r[key]
    }
    return { ...r, rank }
  })
}

const TOP_N = 10

function RankingCard({ title, icon, unit, ranked, myName }) {
  const top = ranked.slice(0, TOP_N)
  const maxValue = ranked[0]?.value || 1
  const mine = ranked.find((r) => r.name === myName)
  const mineInTop = mine && mine.rank <= TOP_N

  return (
    <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="flex items-center gap-2 text-base font-extrabold">
          {icon}
          {title}
        </h3>
        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
          <Crown size={12} />
          현재 1위 {maxValue}{unit}
        </span>
      </div>

      {/* 익명 순위 막대 — 등수와 개수만, 이름은 절대 안 보여준다 */}
      <div className="space-y-1.5">
        {top.map((r) => {
          const isMine = r.name === myName
          return (
            <div key={r.rank + '-' + r.name} className="flex items-center gap-2">
              <span className={`w-9 shrink-0 text-xs font-extrabold text-right ${isMine ? 'text-brand' : 'text-gray-500'}`}>
                {r.rank}위
              </span>
              <div className="flex-1 h-6 bg-surface-alt rounded-lg overflow-hidden relative">
                <div
                  className={`h-full rounded-lg transition-all ${isMine ? 'bg-brand' : 'bg-white/15'}`}
                  style={{ width: `${Math.max(4, (r.value / maxValue) * 100)}%` }}
                />
              </div>
              <span className={`w-14 shrink-0 text-xs font-bold ${isMine ? 'text-brand' : 'text-gray-400'}`}>
                {r.value}{unit}{isMine ? ' · 나' : ''}
              </span>
            </div>
          )
        })}
        {top.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-4">아직 기록이 없어요</p>
        )}
      </div>

      {/* 내 등수는 top10 밖이어도 항상 알려준다 */}
      {mine && !mineInTop && (
        <div className="flex items-center justify-between p-2.5 bg-brand-light rounded-xl">
          <span className="text-xs font-bold text-brand">내 등수</span>
          <span className="text-sm font-extrabold text-brand">{mine.rank}위 · {mine.value}{unit}</span>
        </div>
      )}
    </div>
  )
}

export default function RankingPage({ author }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unexpectedRanked, setUnexpectedRanked] = useState([])
  const [answerRanked, setAnswerRanked] = useState([])
  const [scrapRanked, setScrapRanked] = useState([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [questionsRes, answersRes, analysisRecords, liveScraps] = await Promise.all([
          supabase.from('questions').select('author, category').eq('category', 'unexpected'),
          supabase.from('answers').select('author, question_id, questions(category)'),
          listRecords('analysis'),
          listRecords('live_scrap'),
        ])
        if (cancelled) return

        const unexpectedByName = {}
        for (const q of questionsRes.data || []) {
          if (!q.author) continue
          unexpectedByName[q.author] = (unexpectedByName[q.author] || 0) + 1
        }

        // 돌발질문에 달린 답변만 센다 — 일반질문 답변까지 섞으면 "돌발질문 답변 개수"가 아니게 된다
        const answerByName = {}
        for (const a of answersRes.data || []) {
          if (!a.author) continue
          if (a.questions?.category !== 'unexpected') continue
          answerByName[a.author] = (answerByName[a.author] || 0) + 1
        }

        // 스크랩은 두 갈래(내 시뮬레이션 영상 스크랩 + 라이브 다시보기 스크랩)를 합친 총합으로 본다
        const scrapByName = {}
        for (const rec of analysisRecords) {
          if (!rec.author) continue
          scrapByName[rec.author] = (scrapByName[rec.author] || 0) + (rec.scraps?.length || 0)
        }
        for (const s of liveScraps) {
          if (!s.author) continue
          scrapByName[s.author] = (scrapByName[s.author] || 0) + 1
        }

        const buildRows = (byName) => ROSTER.map((name) => ({ name, value: byName[name] || 0 }))

        setUnexpectedRanked(withRanks(buildRows(unexpectedByName), 'value'))
        setAnswerRanked(withRanks(buildRows(answerByName), 'value'))
        setScrapRanked(withRanks(buildRows(scrapByName), 'value'))
        setLoading(false)
      } catch (e) {
        if (cancelled) return
        setError(e.message || '순위를 불러오지 못했어요.')
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6">
        <h2 className="flex items-center gap-2 text-xl font-extrabold">
          <Trophy size={20} className="text-amber-400" />
          랭킹
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          누가 몇 등인지는 본인만 볼 수 있어요. 다른 사람 이름이나 순위는 공개되지 않고, 내 막대만 표시돼요.
        </p>
      </div>

      {loading && <p className="text-sm text-gray-500 text-center py-8">불러오는 중...</p>}
      {error && <p className="text-sm text-red-400 text-center py-8">{error}</p>}

      {!loading && !error && (
        <>
          <RankingCard
            title="돌발질문 개수"
            icon={<Zap size={16} className="text-brand" />}
            unit="개"
            ranked={unexpectedRanked}
            myName={author}
          />
          <RankingCard
            title="돌발질문 답변 개수"
            icon={<MessageSquareText size={16} className="text-brand" />}
            unit="개"
            ranked={answerRanked}
            myName={author}
          />
          <RankingCard
            title="스크랩 개수"
            icon={<Bookmark size={16} className="text-brand" />}
            unit="개"
            ranked={scrapRanked}
            myName={author}
          />
        </>
      )}
    </div>
  )
}
