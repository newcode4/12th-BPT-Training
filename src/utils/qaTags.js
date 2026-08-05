// 돌발질문 유형 (자유 입력 대신 정해진 카테고리에서 고르게 함)
export const TOPICS = [
  '가격 · 환불',
  '시간 · 일정',
  '성과 · 실적',
  '콘텐츠 기획',
  '수익화 구조',
  '아이템 선정',
  '개인 사정',
  '기타',
]

// 주차/유형은 questions.tags(text[]) 안에 접두사로 함께 저장한다.
// 별도 컬럼을 추가하지 않아도 되고, 기존 글도 그대로 읽힌다.
const WEEK_PREFIX = 'w:'
const TOPIC_PREFIX = 't:'

export function parseTags(rawTags) {
  const week = []
  let topic = ''
  const plain = []
  for (const tag of rawTags || []) {
    if (tag.startsWith(WEEK_PREFIX)) week.push(tag.slice(WEEK_PREFIX.length))
    else if (tag.startsWith(TOPIC_PREFIX)) topic = tag.slice(TOPIC_PREFIX.length)
    else plain.push(tag)
  }
  return { week: week[0] || '', topic, tags: plain }
}

export function buildTags({ week, topic, tags = [] }) {
  const out = [...tags]
  if (week) out.push(`${WEEK_PREFIX}${week}`)
  if (topic) out.push(`${TOPIC_PREFIX}${topic}`)
  return out
}
