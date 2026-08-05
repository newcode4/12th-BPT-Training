import { supabase, supabaseConfigured } from './supabase'

// 교육생 명단 (관리자에게 전달받은 목록과 동일하게 유지)
export const ROSTER = [
  '고태은', '권민애', '김경문', '김동근', '김동익', '김명석', '김미경', '김민서', '김민지', '김세림',
  '김영석', '김원성', '김재현', '김지영', '김지훈', '김효민', '남윤석', '류웅비', '맹경남', '박건우',
  '박다본', '박보연', '박진세', '서종필', '서하람', '양소의', '유은정', '이로건', '이보영', '이빛나',
  '이정현', '이정훈', '이주환', '이찬미', '이홍주', '이화범', '임정현', '전승훈', '정다희', '조영래',
  '주효민', '천진영', '추연영', '허준호', '황현문',
]

const SESSION_KEY = 'pt-session'
const STALE_MS = 5 * 60 * 1000 // 5분간 응답 없으면 끊긴 세션으로 간주하고 자리 회수

export function getSession() {
  const raw = localStorage.getItem(SESSION_KEY)
  return raw ? JSON.parse(raw) : null
}

function setSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  localStorage.setItem('qa-author', session.name)
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

// 이미 다른 기기에서 사용 중인 이름 목록. 명단에서 빼주면 헛클릭이 줄어든다.
export async function getTakenNames() {
  if (!supabaseConfigured) return []
  const staleBefore = new Date(Date.now() - STALE_MS).toISOString()
  const { data, error } = await supabase
    .from('students')
    .select('name, active_token, last_seen')
    .not('active_token', 'is', null)
    .gte('last_seen', staleBefore)

  if (error) return []
  return (data || []).map(s => s.name)
}

export async function login(name) {
  if (!ROSTER.includes(name)) {
    return { ok: false, error: '명단에 없는 이름이에요.' }
  }
  if (!supabaseConfigured) {
    return { ok: false, error: '서버 연결이 설정되지 않았어요.' }
  }

  const token = crypto.randomUUID()
  const nowIso = new Date().toISOString()
  const staleBefore = new Date(Date.now() - STALE_MS).toISOString()

  const { data, error } = await supabase
    .from('students')
    .update({ active_token: token, active_since: nowIso, last_seen: nowIso })
    .eq('name', name)
    .or(`active_token.is.null,last_seen.lt.${staleBefore}`)
    .select()

  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return { ok: false, error: '이미 다른 기기에서 로그인 중이에요. 먼저 그 기기에서 로그아웃해주세요.' }
  }

  setSession({ name, token })
  return { ok: true }
}

// 살아있는 세션인지 주기적으로 확인. 다른 기기가 자리를 가져갔으면 false 반환.
export async function heartbeat() {
  const session = getSession()
  if (!session) return true
  if (!supabaseConfigured) return true

  const { data, error } = await supabase
    .from('students')
    .update({ last_seen: new Date().toISOString() })
    .eq('name', session.name)
    .eq('active_token', session.token)
    .select()

  if (error) return true
  if (!data || data.length === 0) {
    clearSession()
    return false
  }
  return true
}

export async function logout() {
  const session = getSession()
  if (session && supabaseConfigured) {
    await supabase
      .from('students')
      .update({ active_token: null })
      .eq('name', session.name)
      .eq('active_token', session.token)
  }
  clearSession()
}
