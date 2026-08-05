import { supabase, supabaseConfigured } from './supabase'
import { getStorageData, saveStorageData } from './storage'
import { generateUUID } from './formatters'

// 스크랩·유튜브 링크처럼 PC/모바일 어디서 봐도 같아야 하는 데이터는 여기로 모은다.
// 녹음/영상 원본 파일은 절대 올리지 않는다 (fileStore.js = 내 기기 전용).
const TABLE = 'records'

// records 테이블이 아직 없는 프로젝트에서도 앱이 멀쩡히 돌아가야 한다.
// 한 번 "테이블 없음"을 확인하면 그 뒤로는 조용히 로컬 저장만 쓴다.
let tableMissing = false

export function isCloudSyncing() {
  return supabaseConfigured && !tableMissing
}

function isMissingTable(error) {
  return error?.code === 'PGRST205' || /Could not find the table/i.test(error?.message || '')
}

// ---- 기존 버전(로컬 전용)에서 쓰던 데이터를 새 구조로 한 번만 옮긴다 ----
const LEGACY_READERS = {
  // 개인 기록(analysis)은 예전엔 author를 안 저장했다 — 이 기기의 로그인 사용자로 채워둔다.
  // 못 채우면(로그아웃 상태) author 없는 채로 남는데, 그건 목록 필터에서 아무에게도 안 보인다.
  analysis: (d) => (d.analyses || []).map(a => ({ ...a, author: a.author || legacyAuthor() })),
  ref_scrap: (d) => d.refScraps || [],
  admin_video: (d) => d.adminReferenceVideos || [],
  insight: (d) => d.insights || [],
  feedback: (d) => (d.feedbackEntries || []).map(f => ({ ...f, author: f.author || legacyAuthor() })),
  admin_folder: (d) =>
    Object.entries(d.adminFolders || {}).flatMap(([week, names]) =>
      (names || []).map(name => ({ id: generateUUID(), week, name }))
    ),
  script: (d) =>
    Object.entries(d.scripts || {}).map(([questionId, text]) => ({
      id: generateUUID(), questionId, text, author: legacyAuthor(),
    })),
}

function legacyAuthor() {
  return localStorage.getItem('qa-author') || ''
}

function migrateLegacy() {
  const data = getStorageData()
  if (data.cloudMigrated) return
  data.cloudRecords = data.cloudRecords || {}
  for (const [kind, read] of Object.entries(LEGACY_READERS)) {
    if (data.cloudRecords[kind]?.length) continue
    const items = read(data).filter(item => item && item.id)
    if (items.length) data.cloudRecords[kind] = items
  }
  data.cloudMigrated = true
  saveStorageData(data)
}

migrateLegacy()

// 서버가 살아난 뒤, 이 기기에만 있던 예전 기록을 딱 한 번 올려준다
async function pushLocalOnce(kind, cloudItems) {
  const data = getStorageData()
  data.cloudPushed = data.cloudPushed || {}
  if (data.cloudPushed[kind]) return cloudItems

  const cloudIds = new Set(cloudItems.map(i => i.id))
  const pending = localList(kind).filter(i => !cloudIds.has(i.id))

  for (const item of pending) {
    try {
      await putRecord(kind, item, { author: item.author, week: item.week })
    } catch (e) {
      console.error(`[cloudStore] ${kind} 이전 기록 업로드 실패`, e)
      return cloudItems
    }
  }

  const fresh = getStorageData()
  fresh.cloudPushed = fresh.cloudPushed || {}
  fresh.cloudPushed[kind] = true
  saveStorageData(fresh)
  return [...cloudItems, ...pending]
}

// ---- 로컬 폴백 (Supabase 미설정 / 테이블 미생성 시) ----
function localList(kind) {
  const data = getStorageData()
  return (data.cloudRecords || {})[kind] || []
}

function localPut(kind, item) {
  const data = getStorageData()
  data.cloudRecords = data.cloudRecords || {}
  const list = data.cloudRecords[kind] || []
  const idx = list.findIndex(r => r.id === item.id)
  if (idx === -1) list.push(item)
  else list[idx] = item
  data.cloudRecords[kind] = list
  saveStorageData(data)
}

function localRemove(kind, id) {
  const data = getStorageData()
  data.cloudRecords = data.cloudRecords || {}
  data.cloudRecords[kind] = (data.cloudRecords[kind] || []).filter(r => r.id !== id)
  saveStorageData(data)
}

function rowToItem(row) {
  return {
    ...row.data,
    id: row.id,
    author: row.author || row.data?.author || '',
    week: row.week ?? row.data?.week,
  }
}

export async function listRecords(kind, { week, author } = {}) {
  const match = (r) =>
    (week == null || String(r.week) === String(week)) &&
    (author == null || r.author === author)
  const localOnly = () => localList(kind).filter(match)

  if (!isCloudSyncing()) return localOnly()

  let query = supabase
    .from(TABLE)
    .select('id, author, week, data, created_at')
    .eq('kind', kind)
  if (week != null) query = query.eq('week', String(week))
  if (author != null) query = query.eq('author', author)

  const { data, error } = await query.order('created_at', { ascending: true })
  if (error) {
    if (isMissingTable(error)) {
      tableMissing = true
      console.warn('[cloudStore] records 테이블이 없어 이 기기에만 저장합니다. supabase/schema.sql 을 실행해주세요.')
    } else {
      console.error(`[cloudStore] ${kind} 불러오기 실패`, error)
    }
    return localOnly()
  }

  const items = await pushLocalOnce(kind, (data || []).map(rowToItem))
  return items.filter(match)
}

export async function putRecord(kind, item, { author, week } = {}) {
  if (!isCloudSyncing()) {
    localPut(kind, item)
    return item
  }
  const { error } = await supabase.from(TABLE).upsert({
    id: item.id,
    kind,
    author: author ?? item.author ?? null,
    week: String(week ?? item.week ?? ''),
    data: item,
    updated_at: new Date().toISOString(),
  })
  if (error) {
    // 서버에 못 넣더라도 적어놓은 내용은 잃지 않게 이 기기에 남긴다
    localPut(kind, item)
    if (isMissingTable(error)) {
      tableMissing = true
      console.warn('[cloudStore] records 테이블이 없어 이 기기에만 저장합니다. supabase/schema.sql 을 실행해주세요.')
      return item
    }
    console.error(`[cloudStore] ${kind} 저장 실패`, error)
    throw error
  }
  return item
}

export async function removeRecord(kind, id) {
  localRemove(kind, id)
  if (!isCloudSyncing()) return

  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) {
    if (isMissingTable(error)) {
      tableMissing = true
      return
    }
    throw error
  }
}
