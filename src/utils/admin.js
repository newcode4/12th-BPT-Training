const ADMIN_KEY = 'pt-admin-mode'
// 관리자 모드 PIN이자, 관리자 전용 테스트 계정 로그인에도 쓰는 유일한 관리자 암호다.
export const ADMIN_PIN = '1212'

export function isAdminMode() {
  return localStorage.getItem(ADMIN_KEY) === 'true'
}

export function tryEnableAdminMode(pin) {
  if (pin === ADMIN_PIN) {
    localStorage.setItem(ADMIN_KEY, 'true')
    return true
  }
  return false
}

export function disableAdminMode() {
  localStorage.removeItem(ADMIN_KEY)
}
