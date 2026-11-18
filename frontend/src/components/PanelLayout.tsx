import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { Home, LogIn, PanelLeftClose, PanelLeftOpen, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { canResetDemoData, logout, resetDemoData } from '../api/client'
import type { StaffRole } from '../api/types'
import { analyticsKey } from '../hooks/useAnalytics'
import { usePanelCaseSubscription, useTicketRecords } from '../hooks/usePanelCases'
import { useTicketClock } from '../hooks/useTicketClock'
import { analyticsMessages } from '../i18n/analytics'
import { staffMessages } from '../i18n/staff'
import { ticketPageMessages } from '../i18n/ticket-page'
import { useT } from '../i18n/useT'
import { staffSections } from '../lib/panel-sections'
import { readStaffRole } from '../lib/staff-landing'
import { getTicketStatus } from '../lib/ticket-time'
import { AnimatedOutlet } from './AnimatedOutlet'
import { Brand } from './Brand'
import { LanguageSwitcher } from './LanguageSwitcher'
import { PanelDemo } from './PanelDemo'
import { PanelApiFooter } from './PanelApiFooter'
import { PanelSearch } from './PanelSearch'
import { SkipLink } from './SkipLink'
import { Avatar, Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger, GlassPanel, IconButton, Toast, ToastProvider, ToastViewport } from './ui'
import './staff-panel.css'
import './panel-simple.css'

type Notice = { title: string; description?: string; variant?: 'default' | 'success' | 'warning' | 'error' }
type PanelNotify = (notice: Notice) => void
export type PanelContext = { notify: PanelNotify; role: StaffRole | null }

export default function PanelLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [notices, setNotices] = useState<(Notice & { id: number })[]>([])
  const seen = useRef<Set<string> | null>(null)
  const reducedMotion = useReducedMotion()
  const t = useT(ticketPageMessages)
  const tDemo = useT(analyticsMessages)
  const tStaff = useT(staffMessages)
  const [role] = useState(readStaffRole)
  const sections = staffSections(role)
  const { pathname } = useLocation()
  const currentPath = pathname.replace(/\/$/u, '').toLowerCase()
  const roleLabel = role ? tStaff(`staff.role.${role}`) : ''
  const hasTickets = sections.some(({ id }) => id === 'tickets')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: tickets } = useTicketRecords(hasTickets)
  const now = useTicketClock()
  usePanelCaseSubscription()
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose
  const collapseLabel = t(collapsed ? 'panel.expand' : 'panel.collapse')
  const newCount = tickets?.filter((ticket) => getTicketStatus(ticket, now) === 'new').length ?? 0
  const newNoticeTitle = t('tickets.newNotice')
  const notify = useCallback<PanelNotify>((next) => {
    setNotices((previous) => [...previous.slice(-2), { ...next, id: (previous.at(-1)?.id ?? 0) + 1 }])
  }, [])
  const reset = useMutation({
    mutationFn: resetDemoData,
    onMutate: () => { seen.current = null },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: analyticsKey })
      void queryClient.invalidateQueries({ queryKey: ['faq'] })
      notify({ title: tDemo('analytics.demoRestored'), variant: 'success' })
    },
    onError: () => notify({ title: tDemo('analytics.demoResetError'), variant: 'error' }),
  })

  useEffect(() => {
    if (!tickets) return
    const previous = seen.current
    seen.current = new Set(tickets.map(({ id }) => id))
    const incoming = previous && tickets.find(({ id, status }) => !previous.has(id) && status === 'new')
    if (incoming) notify({ title: newNoticeTitle, description: `${incoming.number} · ${incoming.topic}` })
  }, [newNoticeTitle, notify, tickets])

  const shell = (
    <div className="panel-shell" data-collapsed={collapsed} data-staff-role={role || undefined}>
      <SkipLink />
      <aside className="panel-sidebar">
        <GlassPanel className="panel-sidebar-surface">
          <div className="panel-sidebar-brand">
            <Brand compact={collapsed} />
            <IconButton
              aria-label={collapseLabel}
              aria-expanded={!collapsed}
              aria-controls="panel-navigation"
              title={collapseLabel}
              className="panel-collapse"
              onClick={() => setCollapsed((previous) => !previous)}
            >
              <CollapseIcon size={18} aria-hidden="true" />
            </IconButton>
          </div>
          <LayoutGroup>
            <nav id="panel-navigation" className="panel-nav" aria-label={t('panel.nav')}>
              {sections.map(({ id, to, label, icon: SectionIcon }) => {
                const isActive = currentPath === to
                const name = tStaff(label)
                return (
                  <Link key={id} to={to} aria-current={isActive ? 'page' : undefined} aria-label={name} title={collapsed ? name : undefined}>
                    {isActive && (
                      <motion.span
                        aria-hidden="true"
                        className="panel-nav-indicator"
                        layoutId={reducedMotion ? undefined : 'panel-nav-indicator'}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                      />
                    )}
                    <SectionIcon size={19} aria-hidden="true" />
                    <span className="panel-nav-text">{name}</span>
                    {id === 'tickets' && newCount > 0 && <span className="panel-nav-count" aria-hidden="true">{newCount}</span>}
                  </Link>
                )
              })}
            </nav>
          </LayoutGroup>
        </GlassPanel>
      </aside>
      <div className="panel-workspace">
        <header className="panel-header">
          <GlassPanel className="panel-topbar">
            <PanelSearch sections={sections} />
            <div className="panel-actions">
              <PanelDemo />
              <LanguageSwitcher compact />
              <Dropdown>
                <DropdownTrigger asChild>
                  <button className="panel-profile-button" type="button" aria-label={t('panel.profile')}>
                    <Avatar initials={(roleLabel || t('brand.name')).slice(0, 1)} size="sm" />
                  </button>
                </DropdownTrigger>
                <DropdownContent align="end" aria-label={t('panel.profile')}>
                  <DropdownLabel className="panel-menu-label">{roleLabel || t('panel.profile')}</DropdownLabel>
                  <DropdownItem onSelect={() => {
                    logout()
                    queryClient.clear()
                    void navigate('/login', { replace: true })
                  }}>
                    <LogIn size={16} aria-hidden="true" /> {tStaff('staff.switchAccount')}
                  </DropdownItem>
                  <DropdownItem asChild>
                    <Link to="/">
                      <Home size={16} aria-hidden="true" /> {t('common.home')}
                    </Link>
                  </DropdownItem>
                  {canResetDemoData() && (
                    <>
                      <DropdownSeparator />
                      <DropdownItem disabled={reset.isPending} onSelect={() => reset.mutate()}>
                        <RotateCcw aria-hidden="true" size={16} /> {tDemo('analytics.resetDemo')}
                      </DropdownItem>
                    </>
                  )}
                </DropdownContent>
              </Dropdown>
            </div>
          </GlassPanel>
        </header>
        <main id="main-content" className="panel-main" tabIndex={-1}>
          <AnimatedOutlet context={{ notify, role } satisfies PanelContext} />
        </main>
        {import.meta.env.DEV && <PanelApiFooter />}
      </div>
    </div>
  )

  return (
    <ToastProvider label={t('panel.notifications')}>
      {shell}
      {notices.map((notice) => (
        <Toast
          key={notice.id}
          defaultOpen
          title={notice.title}
          description={notice.description}
          variant={notice.variant}
          closeLabel={t('tickets.closeNotice')}
        />
      ))}
      <ToastViewport className="panel-toast-viewport" label={t('tickets.toastViewport')} />
    </ToastProvider>
  )
}
