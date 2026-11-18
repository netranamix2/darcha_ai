import { useEffect, useState } from 'react'
import { readChatPreference, saveChatPreference } from './storage'

export const regions = {
  karakalpakstan: 'conversation.regionKarakalpakstan',
  andijan: 'conversation.regionAndijan',
  bukhara: 'conversation.regionBukhara',
  fergana: 'conversation.regionFergana',
  jizzakh: 'conversation.regionJizzakh',
  namangan: 'conversation.regionNamangan',
  navoi: 'conversation.regionNavoi',
  kashkadarya: 'conversation.regionKashkadarya',
  samarkand: 'conversation.regionSamarkand',
  sirdarya: 'conversation.regionSirdarya',
  surkhandarya: 'conversation.regionSurkhandarya',
  tashkent: 'conversation.regionTashkent',
  tashkentCity: 'conversation.regionTashkentCity',
  khorezm: 'conversation.regionKhorezm',
} as const

export type Region = keyof typeof regions
const savedRegionKey = 'darcha.chat.region'

export function isRegion(value: unknown): value is Region {
  return typeof value === 'string' && Object.hasOwn(regions, value)
}

/** The citizen's region, remembered per chat session. */
export function useChatRegion(sessionId: string | null) {
  const [region, setRegion] = useState<Region | null>(() => {
    const saved = readChatPreference(savedRegionKey)
    if (!saved || typeof saved !== 'object' || !('region' in saved) || !('sessionId' in saved)) return null
    return (saved.sessionId === sessionId || saved.sessionId === null) && isRegion(saved.region) ? saved.region : null
  })

  useEffect(() => {
    saveChatPreference(savedRegionKey, { sessionId, region })
  }, [sessionId, region])

  return [region, setRegion] as const
}
