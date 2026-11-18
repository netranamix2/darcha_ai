import { Tooltip as TooltipPrimitive } from 'radix-ui'
import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type TooltipProviderProps = ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>

export function TooltipProvider({ delayDuration = 250, ...props }: TooltipProviderProps) {
  return <TooltipPrimitive.Provider {...props} delayDuration={delayDuration} />
}

type TooltipProps = Omit<ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>, 'children'> &
  Pick<ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>, 'side' | 'align'> & {
    children: ReactElement
    content: ReactNode
    className?: string
  }

export function Tooltip({ children, content, side, align, className, ...props }: TooltipProps) {
  return (
    <TooltipPrimitive.Root {...props}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          className={cn('ui-tooltip', className)}
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={12}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
