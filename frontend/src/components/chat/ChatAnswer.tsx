import { Check } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Citation } from '../../api/types'
import { chatMessages } from '../../i18n/chat'
import { useT } from '../../i18n/useT'
import { Tooltip } from '../ui'
import { ChatFeedback } from './ChatFeedback'

const wordTime = 22
const markerPattern = /\[(\d{1,2})\]/gu

function externalSource(value: string) {
  try {
    const url = new URL(value)
    const webUrl = url.protocol === 'https:' || url.protocol === 'http:'
    return webUrl && !url.username && !url.password ? url : null
  } catch {
    return null
  }
}

function isOfficial(url: URL | null) {
  return Boolean(url && url.protocol === 'https:' && (url.hostname === 'lex.uz' || url.hostname.endsWith('.lex.uz')))
}

function sourceId(messageId: string, index: number) {
  return `source-${messageId}-${index + 1}`
}

function CitationMarker({ messageId, index, citation }: { messageId: string; index: number; citation: Citation | undefined }) {
  const t = useT(chatMessages)
  if (!citation) return <>[{index + 1}]</>
  return (
    <Tooltip
      content={<><span className="cite-tip__title">{citation.title}</span>{citation.ref && <span className="cite-tip__ref mono">{citation.ref}</span>}</>}
      side="top"
    >
      <a className="cite" href={'#' + sourceId(messageId, index)} aria-label={`${t('conversation.citation')} ${index + 1}: ${citation.title}`}>
        {index + 1}
      </a>
    </Tooltip>
  )
}

/** Renders answer text, turning [n] into citation chips. Without explicit markers, all sources attach to the end. */
function AnswerText({ messageId, content, citations }: { messageId: string; content: string; citations: Citation[] }) {
  const paragraphs = content.split(/\n{2,}/u).filter((part) => part.trim())
  const explicit = /\[\d{1,2}\]/u.test(content)

  return paragraphs.map((paragraph, paragraphIndex) => {
    const nodes: ReactNode[] = []
    if (explicit) {
      let last = 0
      for (const match of paragraph.matchAll(markerPattern)) {
        const index = Number(match[1]) - 1
        nodes.push(paragraph.slice(last, match.index))
        nodes.push(<CitationMarker key={match.index} messageId={messageId} index={index} citation={citations[index]} />)
        last = match.index + match[0].length
      }
      nodes.push(paragraph.slice(last))
    } else {
      nodes.push(paragraph)
      if (paragraphIndex === paragraphs.length - 1) {
        citations.forEach((citation, index) => {
          nodes.push(<Fragment key={index}>{index === 0 ? ' ' : ''}<CitationMarker messageId={messageId} index={index} citation={citation} /></Fragment>)
        })
      }
    }
    return <p key={paragraphIndex} className="answer__text">{nodes}</p>
  })
}

function RevealingText({ messageId, content, citations, stream }: {
  messageId: string
  content: string
  citations: Citation[]
  stream: boolean
}) {
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

  if (!revealing) return <AnswerText messageId={messageId} content={content} citations={citations} />

  return (
    <div>
      <p className="sr-only">{content}</p>
      <p className="answer__text" aria-hidden="true">
        {words.slice(0, visibleWords).join('').replace(markerPattern, '')}
        <span className="answer__unrevealed">{words.slice(visibleWords).join('')}</span>
      </p>
      <button className="answer__skip" type="button" onClick={() => setVisibleWords(words.length)}>
        {t('conversation.revealAll')}
      </button>
    </div>
  )
}

export function ChatSources({ messageId, citations }: { messageId: string; citations: Citation[] }) {
  const t = useT(chatMessages)
  if (!citations.length) return null

  return (
    <section className="sources" aria-label={t('conversation.sources')}>
      <h3 className="sources__title">{t('conversation.sources')}</h3>
      <ol className="sources__list">
        {citations.map((citation, index) => {
          const url = externalSource(citation.url)
          const official = isOfficial(url)
          return (
            <li key={citation.url + citation.ref + index} id={sourceId(messageId, index)} className="sources__row" tabIndex={-1}>
              <span className="sources__num mono" aria-hidden="true">{index + 1}</span>
              <div className="sources__body">
                <p className="sources__doc">{citation.title}</p>
                <p className="sources__meta">
                  {citation.ref && <span className="mono">{citation.ref}</span>}
                  {url && (
                    <a className="sources__link" href={url.href} target="_blank" rel="noopener noreferrer"
                      aria-label={t(official ? 'conversation.lexLink' : 'conversation.sourceLink')}>
                      {url.hostname.replace(/^www\./u, '')}
                    </a>
                  )}
                </p>
              </div>
              {official && (
                <span className="sources__verified"><Check size={13} strokeWidth={2.5} aria-hidden="true" />{t('conversation.checked')}</span>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export function ChatAnswer({ messageId, content, citations, stream }: {
  messageId: string
  content: string
  citations: Citation[]
  stream: boolean
}) {
  return (
    <div className="answer">
      <div className="answer__body">
        <RevealingText key={stream ? 'stream' : 'static'} messageId={messageId} content={content} citations={citations} stream={stream} />
      </div>
      <ChatSources messageId={messageId} citations={citations} />
      <ChatFeedback messageId={messageId} text={content.replace(markerPattern, '')} />
    </div>
  )
}
