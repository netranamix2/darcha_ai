import { useMutation } from '@tanstack/react-query'
import { ArrowRight, BarChart3, ChevronDown, Inbox, Ticket } from 'lucide-react'
import { type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { login } from '../api/client'
import type { StaffRole } from '../api/types'
import { Brand } from '../components/Brand'
import { Button, GlassPanel, Input } from '../components/ui'
import { staffMessages } from '../i18n/staff'
import { useT } from '../i18n/useT'
import { demoAccounts, demoLoginEnabled } from '../lib/demo-login'
import { rememberStaffRole, staffLanding } from '../lib/staff-landing'
import './staff-login.css'

const roleIcons = { operator: Inbox, specialist: Ticket, manager: BarChart3 } as const

type Credentials = { email: string; password: string; demoRole?: StaffRole }

export default function LoginPage() {
  const t = useT(staffMessages)
  const navigate = useNavigate()
  const loginRequest = useMutation({
    mutationFn: ({ email, password }: Credentials) => login(email, password),
    gcTime: 0,
  })
  const pendingRole = loginRequest.isPending ? loginRequest.variables.demoRole : undefined

  function signIn(credentials: Credentials) {
    loginRequest.mutate(credentials, {
      onSuccess: ({ role }) => {
        rememberStaffRole(role)
        void navigate(staffLanding(role), { replace: true })
      },
    })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    signIn({ email: String(data.get('email') ?? '').trim(), password: String(data.get('password') ?? '') })
  }

  const form = (
    <form className="login-form" onSubmit={submit}>
      <label>
        <span>{t('login.email')}</span>
        <Input name="email" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      </label>
      <label>
        <span>{t('login.password')}</span>
        <Input name="password" type="password" autoComplete="current-password" required />
      </label>
      <Button type="submit" variant={demoLoginEnabled ? 'secondary' : 'primary'}
        loading={loginRequest.isPending && !pendingRole} disabled={loginRequest.isPending}>
        {t('login.submit')}
        <ArrowRight size={17} aria-hidden="true" />
      </Button>
    </form>
  )

  return (
    <div className="login-page">
      <GlassPanel variant="elevated" className="login-card">
        <Brand />
        <h1>{t('login.heading')}</h1>
        <p>{t(demoLoginEnabled ? 'staff.demoPick' : 'login.description')}</p>
        {demoLoginEnabled && (
          <section className="staff-login-demo" aria-label={t('staff.demo')}>
            <ul>
              {demoAccounts.map((account) => {
                const Icon = roleIcons[account.role]
                return (
                  <li key={account.role}>
                    <button type="button" className="staff-demo-card" disabled={loginRequest.isPending}
                      aria-busy={pendingRole === account.role || undefined}
                      onClick={() => signIn({ email: account.username, password: account.password, demoRole: account.role })}>
                      <span className="staff-demo-icon" aria-hidden="true"><Icon size={18} /></span>
                      <span className="staff-demo-text">
                        <strong>{t(`staff.role.${account.role}`)}</strong>
                        <span>{t(`staff.demo.${account.role}`)}</span>
                      </span>
                      <span className="staff-demo-go" aria-hidden="true">
                        {pendingRole === account.role ? <span className="staff-demo-spinner" /> : <ArrowRight size={16} />}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
        {loginRequest.isError && <p className="form-error" role="alert">{t('login.error')}</p>}
        {demoLoginEnabled ? (
          <details className="staff-login-other">
            <summary>{t('staff.otherAccount')} <ChevronDown size={16} aria-hidden="true" /></summary>
            {form}
          </details>
        ) : form}
      </GlassPanel>
    </div>
  )
}
