import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '../../lib/cn'
import { FieldFrame } from './field-frame'

type TextareaProps = ComponentPropsWithoutRef<'textarea'> & { containerClassName?: string }

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, containerClassName, ...props }, ref,
) {
  return (
    <FieldFrame className={containerClassName}>
      <textarea {...props} ref={ref} className={cn('ui-textarea', className)} />
    </FieldFrame>
  )
})
