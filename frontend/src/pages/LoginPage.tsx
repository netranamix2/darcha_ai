import { useMutation } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { canResetDemoData, login } from '../api/client'
import { Brand } from '../components/Brand'
import { Button, Input } from '../components/ui'
import { useT } from '../i18n/useT'
import { rememberStaffRole, staffLanding } from '../lib/staff-landing'

const demoRoles = ['operator', 'specialist', 'manager'] as const

export default function LoginPage() {
  const t = useT()
  const navigate = useNavigate()
  const loginRequest = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => login(email, password),
    gcTime: 0,
    onSuccess: ({ role }) => {
      rememberStaffRole(role)
      void navigate(staffLanding(role), { replace: true })
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const credentials = new FormData(event.currentTarget)
    loginRequest.mutate({
      email: String(credentials.get('email') ?? '').trim(),
      password: String(credentials.get('password') ?? ''),
    })
  }

  return (
    <div className="login-page">
      <section className="login-identity">
        <div>
          <Brand />
          <h1>{t('login.workspace')}</h1>
        </div>
      </section>
      <section className="login-card" aria-labelledby="login-title">
        <h2 id="login-title">{t('login.heading')}</h2>
        <p>{t('login.description')}</p>
        <form className="login-form" onSubmit={submit}>
          <label>
            <span>{t('login.email')}</span>
            <Input name="email" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
          </label>
          <label>
            <span>{t('login.password')}</span>
            <Input name="password" type="password" autoComplete="current-password" required />
          </label>
          {loginRequest.isError && <p className="form-error" role="alert">{t('login.error')}</p>}
          <Button type="submit" loading={loginRequest.isPending}>
            {loginRequest.isPending ? t('common.loading') : t('login.submit')}
            {loginRequest.isPending ? null : <ArrowRight size={17} aria-hidden="true" />}
          </Button>
        </form>
        {canResetDemoData() && (
          <div className="login-demo">
            <span>{t('login.demo')}</span>
            <div>
              {demoRoles.map((role) => (
                <button key={role} type="button" disabled={loginRequest.isPending} onClick={() => loginRequest.mutate({ email: role, password: 'demo' })}>
                  {t(`login.${role}`)}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
