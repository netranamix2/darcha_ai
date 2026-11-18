import type { StaffRole } from '../api/types'

// Public seed demo accounts (backend/app/db/session.py, README). Hackathon demo only — not real credentials.
// Shown on /login when VITE_DEMO_LOGIN=1.
export const demoLoginEnabled = String(import.meta.env.VITE_DEMO_LOGIN ?? '').trim() === '1'

export const demoAccounts: ReadonlyArray<{ role: StaffRole; username: string; password: string }> = [
  { role: 'operator', username: 'operator', password: 'operator123' },
  { role: 'specialist', username: 'specialist', password: 'specialist123' },
  { role: 'manager', username: 'manager', password: 'manager123' },
]
