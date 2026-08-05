const ADMIN_KEY = 'pt-admin-mode'
const ADMIN_PIN = '1212'

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
