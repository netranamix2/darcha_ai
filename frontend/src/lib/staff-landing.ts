import type { StaffRole } from '../api/types'

const staffRoleKey = 'darcha.staff-role'

export function rememberStaffRole(role: StaffRole) {
  try {
    sessionStorage.setItem(staffRoleKey, role)
  } catch {
    // The current login can still route to the role's landing page.
  }
}

export function readStaffRole(): StaffRole | null {
  try {
    const role = sessionStorage.getItem(staffRoleKey)
    if (role === 'manager' || role === 'operator' || role === 'specialist') return role
  } catch {
    // A fresh panel visit uses the inbox when session storage is unavailable.
  }
  return null
}

export function staffLanding(role: StaffRole | null) {
  return role === 'manager' ? '/panel/analytics' : '/panel/inbox'
}
