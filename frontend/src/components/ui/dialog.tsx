import { X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { IconButton } from './button'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const Drawer = DialogPrimitive.Root
export const DrawerTrigger = DialogPrimitive.Trigger

type ContentProps = {
  title: string
  description?: string
  closeLabel: string
  children?: ReactNode
  footer?: ReactNode
  className?: string
}

function Sheet({ kind, title, description, closeLabel, children, footer, className }: ContentProps & { kind: 'dialog' | 'drawer' }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="ui-overlay" />
      <DialogPrimitive.Content
        className={cn(kind === 'dialog' ? 'ui-dialog' : 'ui-drawer', className)}
        {...(description ? {} : { 'aria-describedby': undefined })}
      >
        <header className="ui-dialog__header">
          <DialogPrimitive.Title className="ui-dialog__title">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close asChild>
            <IconButton size="sm" aria-label={closeLabel}><X aria-hidden="true" /></IconButton>
          </DialogPrimitive.Close>
        </header>
        {description && <DialogPrimitive.Description className="ui-dialog__description">{description}</DialogPrimitive.Description>}
        <div className="ui-dialog__body">{children}</div>
        {footer && <footer className="ui-dialog__footer">{footer}</footer>}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogContent(props: ContentProps) {
  return <Sheet {...props} kind="dialog" />
}

/** Side sheet on the same primitive. Frosted, because it floats above content. */
export function DrawerContent(props: ContentProps) {
  return <Sheet {...props} kind="drawer" />
}
