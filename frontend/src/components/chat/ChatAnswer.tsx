import { ArrowUpRight, FileText } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Citation } from '../../api/types'
import { chatMessages } from '../../i18n/chat'
import { useT } from '../../i18n/useT'
import { GlassPanel } from '../ui'
import { ChatFeedback } from './ChatFeedback'

const wordTime = 25

function ReplyText({ content, stream }: { content: string; stream: boolean }) {
  const t = useT(chatMessages)
  const words = useMemo(() => content.match(/\S+\s*|\s+/gu) ?? [], [content])
  const [visibleWords, setVisibleWords] = useState(stream ? 1 : words.length)
  const revealing = stream && visibleWords < words.length

  useEffect(() => {
    if (!revealing) return
    const startedAt = performance.now()
    const timer = window.setInterval(() => {
      setVisibleWords(Math.min(words.length, Math.floor((performance.now() - startedAt) / wordTime) + 1))
    }, wordTime)
    return () => window.clearInterval(timer)
  }, [revealing, words.length])

  if (!revealing) return <p className="chat-answer-text">{content}</p>

  return (
    <div>
      <p className="sr-only">{content}</p>
      <p className="chat-answer-text" aria-hidden="true">
        {words.slice(0, visibleWords).join('')}
        <span className="chat-unrevealed">{words.slice(visibleWords).join('')}</span>
      </p>
      <button className="chat-reveal-skip" type="button" onClick={() => setVisibleWords(words.length)}>
        {t('conversation.revealAll')}
      </button>
    </div>
  )
}

function externalSource(value: string) {
  try {
    const url = new URL(value)
    const webUrl = url.protocol === 'https:' || url.protocol === 'http:'
    return webUrl && !url.username && !url.password ? url : null
  } catch {
    return null
  }
}

export function ChatSources({ citations, animate }: { citations: Citation[]; animate?: boolean }) {
  const t = useT(chatMessages)

  return citations.map((citation, index) => {
    const url = externalSource(citation.url)
    const isLex = url?.hostname === 'lex.uz' || url?.hostname.endsWith('.lex.uz')
    const officialCitation = isLex && url?.protocol === 'https:'
    return (
      <GlassPanel
        key={citation.url + citation.ref + index}
        variant="subtle"
        blur={false}
        className={'chat-source-card' + (url ? ' glass-lift' : '')}
        data-unfold={animate || undefined}
      >
        <span className="chat-source-icon"><FileText size={17} aria-hidden="true" /></span>
        <div className="chat-source-content">
          <p className="chat-source-title">{citation.title}</p>
          {citation.ref && <p className="chat-source-ref">{citation.ref}</p>}
          {url && (
            <a className="chat-source-link" href={url.href} target="_blank" rel="noopener noreferrer">
              {t(isLex ? 'conversation.lexLink' : 'conversation.sourceLink')}
              <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          )}
        </div>
        {officialCitation && (
          <span className="chat-source-verified"><span className="chat-source-check" aria-hidden="true" />{t('conversation.checked')}</span>
        )}
      </GlassPanel>
    )
  })
}

export function ChatAnswer({ messageId, content, citations, stream }: {
  messageId: string
  content: string
  citations: Citation[]
  stream: boolean
}) {
  return (
    <>
      <div className="chat-bubble chat-bubble--assistant">
        <ReplyText key={stream ? 'stream' : 'static'} content={content} stream={stream} />
      </div>
      <ChatSources citations={citations} animate={stream} />
      <ChatFeedback messageId={messageId} />
    </>
  )
}
