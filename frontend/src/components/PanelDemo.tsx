import { Popover } from 'radix-ui'
import { Link } from 'react-router'
import { panelSimpleMessages } from '../i18n/panel-simple'
import { useT } from '../i18n/useT'
import { Button } from './ui'

const steps = [
  { label: 'simple.demoWrite', to: '/#chat', publicChat: true },
  { label: 'simple.demoTicket', to: '/panel/tickets?status=new' },
  { label: 'simple.demoAnswer', to: '/panel/tickets?status=new&answer=1' },
  { label: 'simple.demoChat', to: '/#chat', publicChat: true },
  { label: 'simple.demoInstagram', to: '/demo/instagram', publicChat: true },
] as const

export function PanelDemo() {
  const t = useT(panelSimpleMessages)
  return (
    <Popover.Root>
      <Popover.Trigger asChild><Button variant="secondary" size="sm">{t('simple.demo')}</Button></Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="panel-demo" align="end" sideOffset={8} collisionPadding={12}
          aria-label={t('simple.demoTitle')}>
          <h2>{t('simple.demoTitle')}</h2>
          <ol>
            {steps.map((step) => {
              const publicChat = 'publicChat' in step
              return (
                <li key={step.label}>
                  <Popover.Close asChild>
                    <Link to={step.to} target={publicChat ? '_blank' : undefined} rel={publicChat ? 'noopener noreferrer' : undefined}>
                      {t(step.label)}
                    </Link>
                  </Popover.Close>
                </li>
              )
            })}
          </ol>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
