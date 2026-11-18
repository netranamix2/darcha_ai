import { useMutation } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { login } from '../api/client'
import { WindowMark } from '../components/Brand'
import { Button, GlassPanel, Input } from '../components/ui'
import { useT } from '../i18n/useT'
import { rememberStaffRole, staffLanding } from '../lib/staff-landing'

export default function LoginPage() {
  const t = useT()
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

  return (
    <div className="login-page">
      <GlassPanel variant="elevated" className="login-card">
        <WindowMark />
        <h1>{t('login.heading')}</h1>
        <p>{t('login.description')}</p>
        <form className="login-form" onSubmit={submit}>
          <label>
            <span>{t('login.email')}</span>
            <Input name="email" type="email" autoComplete="username" required />
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
      </GlassPanel>
    </div>
  )
}
