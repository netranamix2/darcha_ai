import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { chatMessages } from '../../i18n/chat'
import { useT } from '../../i18n/useT'
import { Dropdown, DropdownContent, DropdownRadioGroup, DropdownRadioItem, DropdownSeparator, DropdownTrigger } from '../ui'
import { readChatPreference, saveChatPreference } from './storage'

const regions = {
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

type Region = keyof typeof regions
const savedRegionKey = 'darcha.chat.region'

function isRegion(value: unknown): value is Region {
  return typeof value === 'string' && Object.hasOwn(regions, value)
}

export function ChatRegion({ sessionId }: { sessionId: string | null }) {
  const t = useT(chatMessages)
  const [region, setRegion] = useState<Region | null>(() => {
    const saved = readChatPreference(savedRegionKey)
    if (!saved || typeof saved !== 'object' || !('region' in saved) || !('sessionId' in saved)) return null
    return (saved.sessionId === sessionId || saved.sessionId === null) && isRegion(saved.region) ? saved.region : null
  })
  const selected = region ? t(regions[region]) : t('conversation.regionNone')

  useEffect(() => {
    saveChatPreference(savedRegionKey, { sessionId, region })
  }, [sessionId, region])

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button className="chat-region" type="button">
          <span>{t('conversation.regionShort')}: {selected}</span>
          <ChevronDown size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </DropdownTrigger>
      <DropdownContent className="chat-region-menu" align="start" aria-label={t('conversation.region')}>
        <DropdownRadioGroup value={region ?? ''} onValueChange={(value) => setRegion(isRegion(value) ? value : null)}>
          <DropdownRadioItem value="">{t('conversation.regionNone')}</DropdownRadioItem>
          <DropdownSeparator />
          {Object.entries(regions).map(([key, label]) => (
            <DropdownRadioItem key={key} value={key}>{t(label)}</DropdownRadioItem>
          ))}
        </DropdownRadioGroup>
      </DropdownContent>
    </Dropdown>
  )
}
