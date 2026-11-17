import { LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { Bell, Home, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router'
import { useT } from '../i18n/useT'
import { panelSections } from '../lib/panel-sections'
import { AnimatedOutlet } from './AnimatedOutlet'
import { Brand } from './Brand'
import { LanguageSwitcher } from './LanguageSwitcher'
import { PanelSearch } from './PanelSearch'
import { SkipLink } from './SkipLink'
import { Avatar, Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownTrigger, GlassPanel, IconButton } from './ui'

export default function PanelLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const reducedMotion = useReducedMotion()
  const t = useT()
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose
  const collapseLabel = t(collapsed ? 'panel.expand' : 'panel.collapse')

  return (
    <div className="panel-shell" data-collapsed={collapsed}>
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
              {panelSections.map(({ id, label, icon: SectionIcon }) => (
                <NavLink key={id} to={`/panel/${id}`} aria-label={t(label)} title={collapsed ? t(label) : undefined}>
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          aria-hidden="true"
                          className="panel-nav-indicator"
                          layoutId={reducedMotion ? undefined : 'panel-nav-indicator'}
                          transition={{ type: 'spring', duration: 0.32, bounce: 0.12 }}
                        />
                      )}
                      <SectionIcon size={19} aria-hidden="true" />
                      <span className="panel-nav-text">{t(label)}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </LayoutGroup>
        </GlassPanel>
      </aside>
      <div className="panel-workspace">
        <header className="panel-header">
          <GlassPanel className="panel-topbar">
            <PanelSearch />
            <div className="panel-actions">
              <LanguageSwitcher compact />
              <Dropdown>
                <DropdownTrigger asChild>
                  <IconButton aria-label={t('panel.notifications')} title={t('panel.notifications')}>
                    <Bell size={19} aria-hidden="true" />
                  </IconButton>
                </DropdownTrigger>
                <DropdownContent align="end" aria-label={t('panel.notifications')}>
                  <DropdownLabel className="panel-menu-label">{t('panel.notifications')}</DropdownLabel>
                  <p className="notifications-empty">{t('panel.notificationsEmpty')}</p>
                </DropdownContent>
              </Dropdown>
              <Dropdown>
                <DropdownTrigger asChild>
                  <button className="panel-profile-button" type="button" aria-label={t('panel.profile')}>
                    <Avatar initials="D" size="sm" />
                  </button>
                </DropdownTrigger>
                <DropdownContent align="end" aria-label={t('panel.profile')}>
                  <DropdownLabel className="panel-menu-label">{t('panel.profile')}</DropdownLabel>
                  <DropdownItem asChild>
                    <Link to="/">
                      <Home size={16} aria-hidden="true" /> {t('common.home')}
                    </Link>
                  </DropdownItem>
                </DropdownContent>
              </Dropdown>
            </div>
          </GlassPanel>
        </header>
        <main id="main-content" className="panel-main" tabIndex={-1}>
          <AnimatedOutlet />
        </main>
      </div>
    </div>
  )
}
