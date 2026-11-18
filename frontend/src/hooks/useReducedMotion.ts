import { useSyncExternalStore } from 'react'

const preference = '(prefers-reduced-motion: reduce)'

function subscribe(listener: () => void) {
  const media = window.matchMedia(preference)
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}

export function useReducedMotion() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(preference).matches)
}
