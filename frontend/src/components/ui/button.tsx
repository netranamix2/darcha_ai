import { LoaderCircle } from 'lucide-react'
import { Slot } from 'radix-ui'
import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '../../lib/cn'

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', type = 'button', loading, disabled, asChild, className, children, onClick, ...props },
  ref,
) {
  const unavailable = Boolean(disabled || loading)
  const shared = {
    ...props,
    ref,
    className: cn('ui-button', className),
    'data-variant': variant,
    'data-size': size,
    'data-loading': loading || undefined,
    'aria-busy': loading || props['aria-busy'],
  }

  if (asChild) {
    return (
      <Slot.Root
        {...shared}
        aria-disabled={unavailable || props['aria-disabled']}
        tabIndex={unavailable ? -1 : props.tabIndex}
        onClick={unavailable ? (event) => event.preventDefault() : onClick}
      >
        {children}
      </Slot.Root>
    )
  }

  return (
    <button {...shared} type={type} disabled={unavailable} onClick={onClick}>
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
