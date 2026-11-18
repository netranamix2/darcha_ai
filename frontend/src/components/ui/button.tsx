import { LoaderCircle } from 'lucide-react'
import { Slot } from 'radix-ui'
import { forwardRef, type ComponentPropsWithoutRef, type PointerEvent } from 'react'
import { usePointerFrame } from '../../hooks/usePointerFrame'
import { cn } from '../../lib/cn'

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', type = 'button', loading, disabled, asChild, className, children,
    onClick, onPointerMove, onPointerLeave, ...props },
  ref,
) {
  const unavailable = Boolean(disabled || loading)
  const ariaDisabled = props['aria-disabled'] === true || props['aria-disabled'] === 'true'
  const pointer = usePointerFrame()

  function moveTowardPointer(button: HTMLButtonElement, bounds: DOMRect, x: number, y: number) {
    if (bounds.width === 0 || bounds.height === 0) return
    const horizontal = 2 * (x - bounds.left) / bounds.width - 1
    const vertical = 2 * (y - bounds.top) / bounds.height - 1
    const pull = 4 / Math.max(1, Math.hypot(horizontal, vertical))
    button.style.setProperty('--button-x', `${horizontal * pull}px`)
    button.style.setProperty('--button-y', `${vertical * pull}px`)
  }

  const sharedProps = {
    ...props,
    ref,
    className: cn('ui-button', className),
    'data-variant': variant,
    'data-size': size,
    'data-loading': loading || undefined,
    'aria-busy': loading || props['aria-busy'],
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      onPointerMove?.(event)
      if (!event.defaultPrevented && !unavailable && !ariaDisabled) {
        pointer.schedule(event, moveTowardPointer)
      }
    },
    onPointerLeave: (event: PointerEvent<HTMLButtonElement>) => {
      pointer.cancel()
      event.currentTarget.style.removeProperty('--button-x')
      event.currentTarget.style.removeProperty('--button-y')
      onPointerLeave?.(event)
    },
  }

  if (asChild) {
    return (
      <Slot.Root
        {...sharedProps}
        aria-disabled={unavailable || props['aria-disabled']}
        tabIndex={unavailable ? -1 : props.tabIndex}
        onClick={unavailable ? (event) => event.preventDefault() : onClick}
      >
        {children}
      </Slot.Root>
    )
  }

  return (
    <button {...sharedProps} type={type} disabled={unavailable} onClick={onClick}>
      {loading && <LoaderCircle className="ui-button__spinner" aria-hidden="true" />}
      {children}
    </button>
  )
})

type IconButtonProps = ButtonProps & { 'aria-label': string }

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'ghost', className, ...props }, ref,
) {
  return <Button {...props} ref={ref} variant={variant} className={cn('ui-icon-button', className)} />
})
