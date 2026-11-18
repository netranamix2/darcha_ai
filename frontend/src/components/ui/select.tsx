import { Check, ChevronDown } from 'lucide-react'
import { Select as SelectPrimitive } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface SelectOption {
  value: string
  label: string
}

type SelectProps = {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  'aria-label': string
  /** `field` looks like an input; `inline` is a quiet text trigger for toolbars. */
  appearance?: 'field' | 'inline'
  /** Rendered before the selected label, e.g. "Hudud:". */
  prefix?: ReactNode
  className?: string
  disabled?: boolean
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom'
}

export function Select({
  value, onValueChange, options, appearance = 'field', prefix, className, disabled, align = 'start', side = 'bottom', ...props
}: SelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        className={cn('ui-select-trigger', className)}
        data-appearance={appearance}
        aria-label={props['aria-label']}
      >
        {prefix && <span className="ui-select-prefix">{prefix}</span>}
        <span className="ui-select-value"><SelectPrimitive.Value /></span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="ui-select-chevron" aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="ui-popover ui-select-content"
          position="popper"
          side={side}
          sideOffset={6}
          align={align}
          collisionPadding={12}
        >
          <SelectPrimitive.Viewport className="ui-select-viewport">
            {options.map((option) => (
              <SelectPrimitive.Item key={option.value} value={option.value} className="ui-dropdown-item ui-select-item">
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="ui-dropdown-indicator">
                  <Check aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
