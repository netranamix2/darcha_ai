import { motion } from 'motion/react'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { createContext, forwardRef, useContext, useId, useState, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { cn } from '../../lib/cn'

const TabsState = createContext<{ value: string | undefined; group: string }>({ value: undefined, group: '' })

type TabsProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Root>

export const Tabs = forwardRef<ElementRef<typeof TabsPrimitive.Root>, TabsProps>(function Tabs(
  { value, defaultValue, onValueChange, ...props }, ref,
) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const group = useId()
  const current = value ?? uncontrolled

  return (
    <TabsState.Provider value={{ value: current, group }}>
      <TabsPrimitive.Root
        {...props}
        ref={ref}
        value={current}
        onValueChange={(next) => {
          setUncontrolled(next)
          onValueChange?.(next)
        }}
      />
    </TabsState.Provider>
  )
})

export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return <TabsPrimitive.List {...props} ref={ref} className={cn('ui-tabs-list', className)} />
})

export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, children, value, ...props }, ref) {
  const state = useContext(TabsState)
  return (
    <TabsPrimitive.Trigger {...props} value={value} ref={ref} className={cn('ui-tabs-trigger', className)}>
      {children}
      {state.value === value && (
        <motion.span
          className="ui-tabs-indicator"
          layoutId={state.group + 'indicator'}
          transition={{ type: 'spring', visualDuration: 0.28, bounce: 0.1 }}
          aria-hidden="true"
        />
      )}
    </TabsPrimitive.Trigger>
  )
})

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return <TabsPrimitive.Content {...props} ref={ref} className={cn('ui-tabs-content', className)} />
})
