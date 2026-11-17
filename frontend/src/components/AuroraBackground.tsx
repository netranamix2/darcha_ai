import { useSyncExternalStore } from 'react'

function subscribeToVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

function getHidden() {
  return document.hidden
}

function getServerHidden() {
  return false
}

export function AuroraBackground() {
  const hidden = useSyncExternalStore(subscribeToVisibility, getHidden, getServerHidden)

  return (
    <div className="aurora-background" aria-hidden="true" data-paused={hidden}>
      <div className="aurora-background__blob aurora-background__blob--blue" />
      <div className="aurora-background__blob aurora-background__blob--cyan" />
      <div className="aurora-background__blob aurora-background__blob--violet" />
      <div className="aurora-background__blob aurora-background__blob--deep-blue" />
      <div className="aurora-background__grain" />
    </div>
  )
}
