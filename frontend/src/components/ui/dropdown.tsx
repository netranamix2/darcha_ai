import { Check } from 'lucide-react'
import { DropdownMenu as DropdownPrimitive } from 'radix-ui'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { cn } from '../../lib/cn'

export const Dropdown = DropdownPrimitive.Root
export const DropdownTrigger = DropdownPrimitive.Trigger
export const DropdownLabel = DropdownPrimitive.Label
export const DropdownRadioGroup = DropdownPrimitive.RadioGroup

export const DropdownContent = forwardRef<
  ElementRef<typeof DropdownPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>
>(function DropdownContent({ className, sideOffset = 7, collisionPadding = 10, ...props }, ref) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        {...props}
        ref={ref}
        className={cn('ui-popover ui-dropdown-content', className)}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
      />
    </DropdownPrimitive.Portal>
  )
})

export const DropdownItem = forwardRef<
  ElementRef<typeof DropdownPrimitive.Item>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.Item>
>(function DropdownItem({ className, ...props }, ref) {
  return <DropdownPrimitive.Item {...props} ref={ref} className={cn('ui-dropdown-item', className)} />
})

export const DropdownRadioItem = forwardRef<
  ElementRef<typeof DropdownPrimitive.RadioItem>,
  Omit<ComponentPropsWithoutRef<typeof DropdownPrimitive.RadioItem>, 'asChild'>
>(function DropdownRadioItem({ children, className, ...props }, ref) {
  return (
    <DropdownPrimitive.RadioItem
      {...props}
      ref={ref}
      className={cn('ui-dropdown-item ui-dropdown-radio-item', className)}
    >
      {children}
      <DropdownPrimitive.ItemIndicator className="ui-dropdown-indicator" aria-hidden="true">
        <Check />
      </DropdownPrimitive.ItemIndicator>
    </DropdownPrimitive.RadioItem>
  )
})

export const DropdownSeparator = forwardRef<
  ElementRef<typeof DropdownPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.Separator>
>(function DropdownSeparator({ className, ...props }, ref) {
  return <DropdownPrimitive.Separator {...props} ref={ref} className={cn('ui-dropdown-separator', className)} />
})
