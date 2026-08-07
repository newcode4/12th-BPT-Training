import { useMemo, useState, useEffect } from 'react'
import { Trophy, Zap, MessageSquareText, Bookmark, Crown, Sparkles, Settings2, Plus, X, Loader2 } from 'lucide-react'
import { supabase } from '../utils/supabase'
import { listRecords, putRecord } from '../utils/cloudStore'
import { ROSTER, STAFF_ROSTER } from '../utils/auth'
import { isAdminMode } from '../utils/admin'

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
const RANKING_EXCLUDE_SETTING_ID = '00000000-0000-4000-8000-000000000003'
const STAFF_NAMES = STAFF_ROSTER.map((staff) => staff.name)
const RANKING_CANDIDATE_NAMES = [...ROSTER, ...STAFF_NAMES]
const DEFAULT_RANKING_EXCLUDED_NAMES = STAFF_NAMES

function sanitizeExcludedNames(names) {
  return [...new Set((names || []).filter((name) => STAFF_NAMES.includes(name)))]
}

function RankingCard({ title, icon, unit, ranked, myName }) {
  const top = ranked.slice(0, TOP_N)
  const maxValue = ranked[0]?.value || 1
  const mine = ranked.find((r) => r.name === myName)

  return (
    <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="flex items-center gap-2 text-base font-extrabold">
          {icon}
          {title}
        </h3>
        <div className="flex items-center gap-1.5">
          {mine && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-brand bg-brand-light px-2.5 py-1 rounded-full">
              내 등수 {mine.rank}위 · {mine.value}{unit}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
            <Crown size={12} />
            현재 1위 {maxValue}{unit}
          </span>
        </div>
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
    </div>
  )
}

function RankingExcludeControl({ excludedNames, onChange }) {
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const available = STAFF_NAMES.filter((name) => !excludedNames.includes(name))

  const saveExcludedNames = async (nextNames) => {
    const safeNames = sanitizeExcludedNames(nextNames)
    setSaving(true)
    setError('')
    try {
      await putRecord('setting', {
        id: RANKING_EXCLUDE_SETTING_ID,
        rankingExcludedNames: safeNames,
        updatedAt: new Date().toISOString(),
      })
      onChange(safeNames)
      setSelected('')
    } catch (e) {
      setError(e.message || '랭킹 제외 설정 저장에 실패했어요.')
    } finally {
      setSaving(false)
    }
  }

  const handleAdd = () => {
    if (!selected) return
    saveExcludedNames([...excludedNames, selected])
  }

  return (
    <div className="bg-surface rounded-2xl shadow-card border border-white/10 p-4 md:p-5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-gray-200">
          <Settings2 size={15} className="text-brand" />
          간부 랭킹 제외 관리
        </h3>
        {saving && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-400">
            <Loader2 size={12} className="animate-spin" />
            저장 중
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {excludedNames.map((name) => (
          <span key={name} className="inline-flex items-center gap-1.5 text-xs font-bold text-brand bg-brand-light px-2.5 py-1 rounded-full">
            {name}
            <button
              onClick={() => saveExcludedNames(excludedNames.filter((n) => n !== name))}
              disabled={saving}
              title={`${name} 랭킹 포함`}
              className="text-brand hover:text-white disabled:opacity-50"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {excludedNames.length === 0 && (
          <p className="text-xs text-gray-500">제외된 간부 계정이 없어요.</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <select
          value={selected}
          onChange={(e) => { setSelected(e.target.value); setError('') }}
          className="flex-1 min-w-0 p-2.5 border border-white/10 rounded-xl text-sm font-bold bg-surface-alt focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        >
          <option value="">이름 선택</option>
          {available.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <button
          onClick={handleAdd}
          disabled={!selected || saving}
          title="랭킹 제외 추가"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-brand text-white hover:bg-brand-dark disabled:opacity-50"
        >
          <Plus size={16} />
        </button>
      </div>

      {error && <p className="text-xs font-bold text-red-400">{error}</p>}
    </div>
  )
}

export default function RankingPage({ author }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unexpectedByName, setUnexpectedByName] = useState({})
  const [answerByName, setAnswerByName] = useState({})
  const [scrapByName, setScrapByName] = useState({})
  const [excludedNames, setExcludedNames] = useState(DEFAULT_RANKING_EXCLUDED_NAMES)
  const admin = isAdminMode()

  const rankingNames = useMemo(
    () => RANKING_CANDIDATE_NAMES.filter((name) => !excludedNames.includes(name)),
    [excludedNames],
  )

  const buildRankedRows = (byName) => withRanks(rankingNames.map((name) => ({ name, value: byName[name] || 0 })), 'value')

  const unexpectedRanked = useMemo(() => buildRankedRows(unexpectedByName), [rankingNames, unexpectedByName])
  const answerRanked = useMemo(() => buildRankedRows(answerByName), [rankingNames, answerByName])
  const scrapRanked = useMemo(() => buildRankedRows(scrapByName), [rankingNames, scrapByName])
  const totalRanked = useMemo(() => {
    const totalByName = {}
    for (const name of RANKING_CANDIDATE_NAMES) {
      totalByName[name] = (unexpectedByName[name] || 0) + (answerByName[name] || 0) + (scrapByName[name] || 0)
    }
    return buildRankedRows(totalByName)
  }, [rankingNames, unexpectedByName, answerByName, scrapByName])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [questionsRes, answersRes, analysisRecords, liveScraps, settings] = await Promise.all([
          supabase.from('questions').select('author, category').eq('category', 'unexpected'),
          supabase.from('answers').select('author, question_id, questions(category)'),
          listRecords('analysis'),
          listRecords('live_scrap'),
          listRecords('setting'),
        ])
        if (cancelled) return

        const nextUnexpectedByName = {}
        for (const q of questionsRes.data || []) {
          if (!q.author) continue
          nextUnexpectedByName[q.author] = (nextUnexpectedByName[q.author] || 0) + 1
        }

        // 돌발질문에 달린 답변만 센다 — 일반질문 답변까지 섞으면 "돌발질문 답변 개수"가 아니게 된다
        const nextAnswerByName = {}
        for (const a of answersRes.data || []) {
          if (!a.author) continue
          if (a.questions?.category !== 'unexpected') continue
          nextAnswerByName[a.author] = (nextAnswerByName[a.author] || 0) + 1
        }

        // 스크랩은 두 갈래(내 시뮬레이션 영상 스크랩 + 라이브 다시보기 스크랩)를 합친 총합으로 본다
        const nextScrapByName = {}
        for (const rec of analysisRecords) {
          if (!rec.author) continue
          nextScrapByName[rec.author] = (nextScrapByName[rec.author] || 0) + (rec.scraps?.length || 0)
        }
        for (const s of liveScraps) {
          if (!s.author) continue
          nextScrapByName[s.author] = (nextScrapByName[s.author] || 0) + 1
        }

        const excludeSetting = settings.find((r) => r.id === RANKING_EXCLUDE_SETTING_ID)
        const nextExcludedNames = excludeSetting
          ? sanitizeExcludedNames(excludeSetting.rankingExcludedNames)
          : DEFAULT_RANKING_EXCLUDED_NAMES

        setUnexpectedByName(nextUnexpectedByName)
        setAnswerByName(nextAnswerByName)
        setScrapByName(nextScrapByName)
        setExcludedNames(sanitizeExcludedNames(nextExcludedNames))
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

      {admin && !loading && !error && (
        <RankingExcludeControl
          excludedNames={excludedNames}
          onChange={setExcludedNames}
        />
      )}

      {loading && <p className="text-sm text-gray-500 text-center py-8">불러오는 중...</p>}
      {error && <p className="text-sm text-red-400 text-center py-8">{error}</p>}

      {!loading && !error && (
        <>
          <RankingCard
            title="전체 합산 점수"
            icon={<Sparkles size={16} className="text-amber-400" />}
            unit="점"
            ranked={totalRanked}
            myName={author}
          />
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
