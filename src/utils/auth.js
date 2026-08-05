import { supabase, supabaseConfigured } from './supabase'
import { listRecords, putRecord } from './cloudStore'

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

const DEVICE_LIMIT_SETTING_ID = 'device-limit'
export const DEFAULT_DEVICE_LIMIT = 1

// 관리자가 켜고 끄는 "한 사람당 동시 로그인 허용 기기 수" (PC + 모바일 = 2)
export async function getDeviceLimit() {
  try {
    const rows = await listRecords('setting')
    const row = rows.find(r => r.id === DEVICE_LIMIT_SETTING_ID)
    const limit = Number(row?.limit)
    return limit === 2 ? 2 : DEFAULT_DEVICE_LIMIT
  } catch {
    return DEFAULT_DEVICE_LIMIT
  }
}

export async function setDeviceLimit(limit) {
  const safeLimit = limit === 2 ? 2 : 1
  await putRecord('setting', { id: DEVICE_LIMIT_SETTING_ID, limit: safeLimit })
  return safeLimit
}

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

// 이미 허용 대수만큼 꽉 찬 이름 목록. 명단에서 빼주면 헛클릭이 줄어든다.
export async function getTakenNames() {
  if (!supabaseConfigured) return []
  const limit = await getDeviceLimit()
  const staleBefore = new Date(Date.now() - STALE_MS).toISOString()
  const { data, error } = await supabase
    .from('sessions')
    .select('name')
    .gte('last_seen', staleBefore)

  if (error) return []
  const counts = {}
  for (const row of data || []) counts[row.name] = (counts[row.name] || 0) + 1
  return Object.keys(counts).filter((name) => counts[name] >= limit)
}

export async function login(name) {
  if (!ROSTER.includes(name)) {
    return { ok: false, error: '명단에 없는 이름이에요.' }
  }
  if (!supabaseConfigured) {
    return { ok: false, error: '서버 연결이 설정되지 않았어요.' }
  }

  const limit = await getDeviceLimit()
  const staleBefore = new Date(Date.now() - STALE_MS).toISOString()

  // 끊긴 지 오래된 세션(예: 브라우저 강제 종료)은 자리 회수를 위해 정리
  await supabase.from('sessions').delete().eq('name', name).lt('last_seen', staleBefore)

  const { count, error: countError } = await supabase
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('name', name)
    .gte('last_seen', staleBefore)

  if (countError) return { ok: false, error: countError.message }
  if ((count || 0) >= limit) {
    return {
      ok: false,
      error: limit === 1
        ? '이미 다른 기기에서 로그인 중이에요. 먼저 그 기기에서 로그아웃해주세요.'
        : `이미 ${limit}대의 기기에서 로그인 중이에요. 먼저 한 곳에서 로그아웃해주세요.`,
    }
  }

  const token = crypto.randomUUID()
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('sessions')
    .insert({ name, token, created_at: nowIso, last_seen: nowIso })
    .select()
    .single()

  if (error) return { ok: false, error: error.message }

  setSession({ name, token, sessionId: data.id })
  return { ok: true }
}

// 살아있는 세션인지 주기적으로 확인. 자리가 회수됐으면 false 반환.
export async function heartbeat() {
  const session = getSession()
  if (!session) return true
  if (!supabaseConfigured) return true

  const { data, error } = await supabase
    .from('sessions')
    .update({ last_seen: new Date().toISOString() })
    .eq('id', session.sessionId)
    .eq('token', session.token)
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
    await supabase.from('sessions').delete().eq('id', session.sessionId).eq('token', session.token)
  }
  clearSession()
}
