const STORAGE_KEY = 'pt-simulation-data'

// 이 기기에 남기는 원시 저장소.
// 스크랩·유튜브 링크·인사이트 등 "여러 기기에서 같이 봐야 하는" 데이터는
// cloudStore.js 를 통해 Supabase에 저장하고, 여기는 그 폴백/이전 데이터 보관용으로만 쓴다.
// (녹음·영상 원본 파일은 fileStore.js 의 IndexedDB에만 있고 서버로 올라가지 않는다)
export function getStorageData() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function saveStorageData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
