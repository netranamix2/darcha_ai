import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { Toast as ToastPrimitive } from 'radix-ui'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { cn } from '../../lib/cn'
import { IconButton } from './button'

type ToastProviderProps = ComponentPropsWithoutRef<typeof ToastPrimitive.Provider> & { label: string }

export function ToastProvider({ swipeDirection = 'right', ...props }: ToastProviderProps) {
  return <ToastPrimitive.Provider {...props} swipeDirection={swipeDirection} />
}

const toastIcons = {
  default: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
}

type ToastProps = Omit<ComponentPropsWithoutRef<typeof ToastPrimitive.Root>, 'title' | 'asChild' | 'children'> & {
  title: string
  description?: string
  closeLabel: string
  variant?: keyof typeof toastIcons
}

export const Toast = forwardRef<ElementRef<typeof ToastPrimitive.Root>, ToastProps>(function Toast(
  { variant = 'default', title, description, closeLabel, className, ...props }, ref,
) {
  const Icon = toastIcons[variant]

  return (
    <ToastPrimitive.Root {...props} ref={ref} className={cn('ui-toast', className)} data-variant={variant}>
      <span className="ui-toast__icon" aria-hidden="true"><Icon /></span>
      <div>
        <ToastPrimitive.Title className="ui-toast__title">{title}</ToastPrimitive.Title>
        {description && <ToastPrimitive.Description className="ui-toast__description">{description}</ToastPrimitive.Description>}
      </div>
      <ToastPrimitive.Close asChild>
        <IconButton aria-label={closeLabel} size="sm" className="ui-toast__close">
          <X aria-hidden="true" />
        </IconButton>
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  )
})

export const ToastViewport = forwardRef<
  ElementRef<typeof ToastPrimitive.Viewport>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport> & { label: string }
>(function ToastViewport({ className, ...props }, ref) {
  return <ToastPrimitive.Viewport {...props} ref={ref} className={cn('ui-toast-viewport', className)} />
})
