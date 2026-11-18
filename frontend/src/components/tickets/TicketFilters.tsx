import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import type { StaffMember, Ticket, TicketDepartment } from '../../api/types'
import { ticketPageMessages } from '../../i18n/ticket-page'
import { useLanguage } from '../../i18n/useLanguage'
import { useT } from '../../i18n/useT'
import { localizeCaseRegion } from '../../lib/case-labels'
import { GlassPanel, Input } from '../ui'

export interface TicketFilterValues {
  search: string
  department: string
  priority: string
  assignee: string
  region: string
  mine: boolean
}

const departments = {
  higher: 'tickets.deptHigher',
  schools: 'tickets.deptSchools',
  attestation: 'tickets.deptAttestation',
  regional: 'tickets.deptRegional',
} as const satisfies Record<TicketDepartment, string>

const priorities = {
  low: 'tickets.priorityLow',
  normal: 'tickets.priorityNormal',
  high: 'tickets.priorityHigh',
} as const satisfies Record<Ticket['priority'], string>

function FilterSelect({ label, value, onChange, children }: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <label className="ticket-filter-field">
      <span>{label}</span>
      <span className="ticket-select-frame">
        <select value={value} onChange={(event) => onChange(event.currentTarget.value)}>{children}</select>
        <ChevronDown aria-hidden="true" size={14} />
      </span>
    </label>
  )
}

export function TicketFilters({ filters, staff, regions, onChange }: {
  filters: TicketFilterValues
  staff: StaffMember[]
  regions: string[]
  onChange: (filters: TicketFilterValues) => void
}) {
  const t = useT(ticketPageMessages)
  const { language } = useLanguage()
  const currentStaff = staff.some(({ is_current }) => is_current)

  return (
    <GlassPanel blur={false} variant="subtle" role="group" aria-label={t('tickets.filters')} className="tickets-filters">
      <label className="ticket-filter-field ticket-filter-search">
        <span>{t('tickets.search')}</span>
        <Input
          type="search"
          placeholder={t('tickets.searchPlaceholder')}
          startIcon={<Search aria-hidden="true" />}
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.currentTarget.value })}
        />
      </label>
      <FilterSelect label={t('tickets.department')} value={filters.department} onChange={(department) => onChange({ ...filters, department })}>
        <option value="">{t('tickets.allDepartments')}</option>
        {Object.entries(departments).map(([key, name]) => <option key={key} value={key}>{t(name)}</option>)}
      </FilterSelect>
      <FilterSelect label={t('tickets.priority')} value={filters.priority} onChange={(priority) => onChange({ ...filters, priority })}>
        <option value="">{t('tickets.allPriorities')}</option>
        {Object.entries(priorities).map(([key, name]) => <option key={key} value={key}>{t(name)}</option>)}
      </FilterSelect>
      <FilterSelect label={t('tickets.assignee')} value={filters.assignee} onChange={(assignee) => onChange({ ...filters, assignee })}>
        <option value="">{t('tickets.allAssignees')}</option>
        {staff.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        <option value="unassigned">{t('tickets.unassigned')}</option>
      </FilterSelect>
      <FilterSelect label={t('tickets.region')} value={filters.region} onChange={(region) => onChange({ ...filters, region })}>
        <option value="">{t('tickets.allRegions')}</option>
        {regions.map((region) => <option key={region} value={region}>{localizeCaseRegion(region, language)}</option>)}
        <option value="no-region">{t('tickets.noRegion')}</option>
      </FilterSelect>
      <label className="ticket-filter-mine">
        <SlidersHorizontal size={15} aria-hidden="true" />
        <span>{t('tickets.mine')}</span>
        <input
          type="checkbox"
          role="switch"
          checked={filters.mine}
          disabled={!currentStaff}
          onChange={(event) => onChange({ ...filters, mine: event.currentTarget.checked })}
        />
        <span className="ticket-filter-switch" aria-hidden="true" />
      </label>
    </GlassPanel>
  )
}
