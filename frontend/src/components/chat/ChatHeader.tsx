import { ChevronDown, MapPin } from 'lucide-react'
import { useEffect, useState } from 'react'
import { chatMessages } from '../../i18n/chat'
import { useT } from '../../i18n/useT'
import { Button, Dropdown, DropdownContent, DropdownLabel, DropdownRadioGroup, DropdownRadioItem, DropdownSeparator, DropdownTrigger } from '../ui'
import { WindowMark } from '../Brand'
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

export function ChatHeader({ titleId, sessionId }: { titleId: string; sessionId: string | null }) {
  const t = useT(chatMessages)
  const [region, setRegion] = useState<Region | null>(() => {
    const saved = readChatPreference(savedRegionKey)
    if (!saved || typeof saved !== 'object' || !('region' in saved) || !('sessionId' in saved)) return null
    return (saved.sessionId === sessionId || saved.sessionId === null) && isRegion(saved.region) ? saved.region : null
  })
  const selected = region ? t(regions[region]) : null

  useEffect(() => {
    saveChatPreference(savedRegionKey, { sessionId, region })
  }, [sessionId, region])

  return (
    <header className="chat-header">
      <div className="chat-identity">
        <WindowMark className="chat-mark" />
        <div>
          <h2 id={titleId}>{t('brand.name')}</h2>
          <p><span aria-hidden="true" />{t('conversation.online')}</p>
        </div>
      </div>
      <Dropdown>
        <DropdownTrigger asChild>
          <Button
            className="chat-region"
            variant="secondary"
            size="sm"
            aria-label={selected ? t('conversation.region') + ' · ' + selected : t('conversation.region')}
          >
            <MapPin aria-hidden="true" size={15} />
            {selected ? (
              <span className="chat-region-selected">{selected}</span>
            ) : (
              <>
                <span className="chat-region-full">{t('conversation.region')}</span>
                <span className="chat-region-short">{t('conversation.regionShort')}</span>
              </>
            )}
            <ChevronDown aria-hidden="true" size={12} />
          </Button>
        </DropdownTrigger>
        <DropdownContent className="chat-region-menu" align="end" aria-label={t('conversation.region')}>
          <DropdownLabel className="chat-region-menu-label">{t('conversation.region')}</DropdownLabel>
          <DropdownRadioGroup value={region ?? ''} onValueChange={(value) => setRegion(isRegion(value) ? value : null)}>
            <DropdownRadioItem value="">{t('conversation.regionNone')}</DropdownRadioItem>
            <DropdownSeparator />
            {Object.entries(regions).map(([key, label]) => (
              <DropdownRadioItem key={key} value={key}>{t(label)}</DropdownRadioItem>
            ))}
          </DropdownRadioGroup>
        </DropdownContent>
      </Dropdown>
    </header>
  )
}
