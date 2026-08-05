import { supabase, supabaseConfigured } from './supabase'
import { getStorageData, saveStorageData } from './storage'

// 스크랩·유튜브 링크처럼 PC/모바일 어디서 봐도 같아야 하는 데이터는 여기로 모은다.
// 녹음/영상 원본 파일은 절대 올리지 않는다 (fileStore.js = 내 기기 전용).
export const cloudEnabled = supabaseConfigured

const TABLE = 'records'

// Supabase 설정이 없을 때를 위한 로컬 폴백 (기존 동작 유지)
function localAll() {
  const data = getStorageData()
  return data.cloudRecords || {}
}

function localList(kind) {
  return localAll()[kind] || []
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

export async function listRecords(kind, { week } = {}) {
  if (!cloudEnabled) {
    const list = localList(kind)
    return week == null ? list : list.filter(r => String(r.week) === String(week))
  }
  let query = supabase
    .from(TABLE)
    .select('id, author, week, data, created_at')
    .eq('kind', kind)
  if (week != null) query = query.eq('week', String(week))

  const { data, error } = await query.order('created_at', { ascending: true })
  if (error) {
    console.error(`[cloudStore] ${kind} 불러오기 실패`, error)
    return localList(kind)
  }
  return (data || []).map(rowToItem)
}

export async function putRecord(kind, item, { author, week } = {}) {
  if (!cloudEnabled) {
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
    // 서버 저장이 안 되더라도 적어놓은 내용은 잃지 않게 이 기기에 남긴다
    localPut(kind, item)
    console.error(`[cloudStore] ${kind} 저장 실패`, error)
    throw new Error(
      `${error.message}\n(이 기기에는 임시로 저장해뒀어요. supabase/schema.sql 을 실행했는지 확인해주세요)`
    )
  }
  return item
}

export async function removeRecord(kind, id) {
  if (!cloudEnabled) {
    localRemove(kind, id)
    return
  }
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
}
