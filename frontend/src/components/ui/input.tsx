import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

type InputProps = ComponentPropsWithoutRef<'input'> & { startIcon?: ReactNode }

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { startIcon, className, ...props }, ref,
) {
  const input = <input {...props} ref={ref} className={cn('ui-field', className)} />

  if (!startIcon) return input

  return (
    <span className="ui-field-wrap">
      <span className="ui-field-icon" aria-hidden="true">{startIcon}</span>
      {input}
    </span>
  )
})
