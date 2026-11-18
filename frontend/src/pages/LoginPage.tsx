import { useMutation } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { useRef, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { canResetDemoData, login } from '../api/client'
import { Brand } from '../components/Brand'
import { Button, GlassPanel, Input } from '../components/ui'
import { staffMessages } from '../i18n/staff'
import { useT } from '../i18n/useT'
import { rememberStaffRole, staffLanding } from '../lib/staff-landing'
import './staff-login.css'

const demoAccounts = [
  { role: 'operator', username: 'operator', password: 'operator123' },
  { role: 'specialist', username: 'specialist', password: 'specialist123' },
  { role: 'manager', username: 'manager', password: 'manager123' },
] as const

export default function LoginPage() {
  const t = useT(staffMessages)
  const emailInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const submitButton = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()
  const loginRequest = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => login(email, password),
    gcTime: 0,
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const credentials = new FormData(event.currentTarget)
    loginRequest.mutate({
      email: String(credentials.get('email') ?? '').trim(),
      password: String(credentials.get('password') ?? ''),
    }, {
      onSuccess: ({ role }) => {
        rememberStaffRole(role)
        void navigate(staffLanding(role), { replace: true })
      },
    })
  }

  function fillDemo(account: (typeof demoAccounts)[number]) {
    if (!emailInput.current || !passwordInput.current) return
    emailInput.current.value = account.username
    passwordInput.current.value = account.password
    loginRequest.reset()
    submitButton.current?.focus({ preventScroll: true })
  }

  return (
    <div className="login-page">
      <GlassPanel variant="elevated" className="login-card">
        <Brand />
        <h1>{t('login.heading')}</h1>
        <p>{t('login.description')}</p>
        <form className="login-form" onSubmit={submit}>
          <label>
            <span>{t('login.email')}</span>
            <Input ref={emailInput} name="email" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
          </label>
          <label>
            <span>{t('login.password')}</span>
            <Input ref={passwordInput} name="password" type="password" autoComplete="current-password" required />
          </label>
          {loginRequest.isError && <p className="form-error" role="alert">{t('login.error')}</p>}
          <Button type="submit" ref={submitButton} loading={loginRequest.isPending}>
            {loginRequest.isPending ? t('common.loading') : t('login.submit')}
            {loginRequest.isPending ? null : <ArrowRight size={17} aria-hidden="true" />}
          </Button>
        </form>
        {canResetDemoData() && (
          <section className="staff-login-demo" aria-labelledby="staff-demo-title">
            <h2 id="staff-demo-title">{t('staff.demo')}</h2>
            <ul>
              {demoAccounts.map((account) => (
                <li key={account.role}>
                  <Button type="button" variant="secondary" className="staff-demo-card" disabled={loginRequest.isPending} onClick={() => fillDemo(account)}>
                    <strong>{t(`staff.role.${account.role}`)}</strong>
                    <span>{t(`staff.demo.${account.role}`)}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </GlassPanel>
    </div>
  )
}
