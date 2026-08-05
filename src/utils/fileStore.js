const DB_NAME = 'pt-simulation-files'
const STORE_NAME = 'files'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('다른 탭에서 열려 있어 저장소를 열 수 없어요.'))
  })
}

export async function saveFileBlob(id, blob) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    // put 자체가 실패하면 트랜잭션이 abort 되므로 onabort도 함께 잡아야 조용한 실패를 막을 수 있다
    tx.onabort = () => reject(tx.error || new Error('저장 공간이 부족해요.'))
    tx.onerror = () => reject(tx.error)
    tx.oncomplete = () => resolve()
    const req = tx.objectStore(STORE_NAME).put(blob, id)
    req.onerror = () => reject(req.error)
  })
}

export async function getFileBlob(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(id)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function hasFileBlob(id) {
  try {
    const blob = await getFileBlob(id)
    return Boolean(blob && blob.size > 0)
  } catch {
    return false
  }
}

export async function deleteFileBlob(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error)
    tx.onerror = () => reject(tx.error)
  })
}
