import { Separator } from 'radix-ui'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { cn } from '../../lib/cn'

export const Divider = forwardRef<
  ElementRef<typeof Separator.Root>,
  ComponentPropsWithoutRef<typeof Separator.Root>
>(function Divider({ decorative = true, orientation = 'horizontal', className, ...props }, ref) {
  return (
    <Separator.Root
      {...props}
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn('ui-divider', className)}
    />
  )
})
