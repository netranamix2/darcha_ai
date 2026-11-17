import { Tooltip as TooltipPrimitive } from 'radix-ui'
import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from 'react'

type TooltipProviderProps = ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>

export function TooltipProvider({ delayDuration = 350, ...props }: TooltipProviderProps) {
  return <TooltipPrimitive.Provider {...props} delayDuration={delayDuration} />
}

type TooltipProps = Omit<ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>, 'children'> &
  Pick<ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>, 'side' | 'align'> & {
    children: ReactElement
    content: ReactNode
  }

export function Tooltip({ children, content, side, align, ...props }: TooltipProps) {
  return (
    <TooltipPrimitive.Root {...props}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content className="ui-popover ui-tooltip" side={side} align={align} sideOffset={7}>
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
