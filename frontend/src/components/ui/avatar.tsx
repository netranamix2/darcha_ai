import { Avatar as AvatarPrimitive } from 'radix-ui'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { cn } from '../../lib/cn'

type AvatarProps = Omit<ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>, 'children' | 'asChild'> & {
  initials: string
  name?: string
  src?: string
  size?: 'sm' | 'md' | 'lg'
}

export const Avatar = forwardRef<ElementRef<typeof AvatarPrimitive.Root>, AvatarProps>(function Avatar(
  { initials, name, src, size = 'md', className, ...props }, ref,
) {
  return (
    <AvatarPrimitive.Root
      {...props}
      ref={ref}
      className={cn('ui-avatar', className)}
      data-size={size}
      role={name ? 'img' : undefined}
      aria-label={name}
      aria-hidden={!name}
    >
      {src && <AvatarPrimitive.Image src={src} alt="" className="ui-avatar__image" />}
      <AvatarPrimitive.Fallback aria-hidden="true">{initials}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
})
