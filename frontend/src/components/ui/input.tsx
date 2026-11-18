import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { FieldFrame } from './field-frame'

type InputProps = ComponentPropsWithoutRef<'input'> & { startIcon?: ReactNode; containerClassName?: string }

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { startIcon, containerClassName, className, ...props }, ref,
) {
  return (
    <FieldFrame className={containerClassName} icon={startIcon}>
      <input {...props} ref={ref} className={cn('ui-field', className)} />
    </FieldFrame>
  )
})
