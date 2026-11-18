import { ArrowDown, CircleAlert, UserRound } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../../api/types'
import { usePublicChat } from '../../hooks/usePublicChat'
import { chatMessages } from '../../i18n/chat'
import { publicHomeMessages } from '../../i18n/public-home'
import { useT } from '../../i18n/useT'
import { WindowMark } from '../Brand'
import { Button, Skeleton, TooltipProvider } from '../ui'
import { ChatAnswer, ChatSources } from './ChatAnswer'
import { ChatComposer } from './ChatComposer'
import { ChatPrompt } from './ChatPrompt'
import { ChatFraud, ChatPending, ChatTicket } from './ChatStatus'
import { ChatThinking } from './ChatThinking'
import './chat.css'

const rise = { type: 'spring', visualDuration: 0.34, bounce: 0.08 } as const

function AssistantReply({ message, stream, resolved }: { message: ChatMessage; stream: boolean; resolved: boolean }) {
  const { reply } = message

  if (reply?.warning === 'fraud') {
    return (
      <>
        <ChatFraud />
        {reply.ticket_number && <ChatTicket reply={reply} createdAt={message.created_at} resolved={resolved} />}
      </>
    )
  }
  if (reply?.level === 'red') return <ChatTicket reply={reply} createdAt={message.created_at} resolved={resolved} />
  if (reply?.level === 'yellow') return <ChatPending />
  return <ChatAnswer messageId={message.id} content={reply?.answer ?? message.text} citations={reply?.citations ?? []} stream={stream} />
}

function Speaker({ kind }: { kind: 'assistant' | 'specialist' }) {
  const t = useT(chatMessages)
  return (
    <p className="speaker">
      {kind === 'assistant' ? (
        <span className="speaker__avatar speaker__avatar--mark"><WindowMark size={14} /></span>
      ) : (
        <span className="speaker__avatar"><UserRound size={13} aria-hidden="true" /></span>
      )}
      <span>{kind === 'assistant' ? t('brand.name') : t('conversation.specialist')}</span>
    </p>
  )
}

const ChatLine = memo(function ChatLine({ message, stream, animate, resolved }: {
  message: ChatMessage
  stream: boolean
  animate: boolean
  resolved: boolean
}) {
  const { reply } = message

  return (
    <motion.li
      className={'msg msg--' + message.role}
      initial={animate ? { y: 6, opacity: 0 } : false}
      animate={{ y: 0, opacity: 1 }}
      transition={rise}
    >
      {message.role === 'user' ? (
        <p className="msg__bubble">{message.text}</p>
      ) : message.role === 'specialist' ? (
        <>
          <Speaker kind="specialist" />
          <div className="msg__specialist">
            <p>{message.text}</p>
          </div>
          {reply && <ChatSources messageId={message.id} citations={reply.citations} />}
        </>
      ) : (
        <>
          <Speaker kind="assistant" />
          <AssistantReply message={message} stream={stream} resolved={resolved} />
        </>
      )}
    </motion.li>
  )
})

function Hero() {
  const t = useT(publicHomeMessages)
  return (
    <div className="hero">
      <p className="hero__kicker">{t('hero.kicker')}</p>
      <h1 className="hero__title">{t('hero.title')}</h1>
      <p className="hero__subtitle">{t('hero.subtitle')}</p>
    </div>
  )
}

function anchorVisible(anchor: HTMLElement | null) {
  if (!anchor) return true
  return anchor.getBoundingClientRect().top <= window.innerHeight + 24
}

export default function PublicChat() {
  const {
    sessionId, resetKey, messages, isRestoring, isSending, thinkingSince, streamingMessageId, resolvedMessageIds, error, send, retry,
  } = usePublicChat()
  const t = useT(chatMessages)
  const reducedMotion = useReducedMotion()
  const section = useRef<HTMLElement>(null)
  const dock = useRef<HTMLDivElement>(null)
  const anchor = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const followsLatest = useRef(true)
  const loaded = useRef(false)
  const lastSeen = useRef<string | undefined>(undefined)
  const [unread, setUnread] = useState(false)
  const latestId = messages.at(-1)?.id
  const conversation = isRestoring || messages.length > 0 || thinkingSince !== null
  const animateIncoming = loaded.current && !reducedMotion
  const blocked = isRestoring || isSending || (error === 'restore' && !messages.length)

  const scrollToLatest = useCallback((smooth: boolean) => {
    anchor.current?.scrollIntoView({ block: 'end', behavior: smooth && !reducedMotion ? 'smooth' : 'instant' })
  }, [reducedMotion])

  // Keep the composer height available to CSS so the latest message is never hidden behind it.
  useEffect(() => {
    const element = dock.current
    const root = section.current
    if (!element || !root || !('ResizeObserver' in window)) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) root.style.setProperty('--dock-h', `${Math.ceil(entry.contentRect.height)}px`)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    function track() {
      const visible = anchorVisible(anchor.current)
      followsLatest.current = visible
      if (visible) setUnread(false)
    }
    window.addEventListener('scroll', track, { passive: true })
    return () => window.removeEventListener('scroll', track)
  }, [])

  useLayoutEffect(() => {
    if (isRestoring) return
    const changed = latestId !== lastSeen.current
    const first = !loaded.current
    lastSeen.current = latestId
    loaded.current = true
    if (!conversation) return
    if (followsLatest.current) scrollToLatest(!first)
    else if (changed && latestId) setUnread(true)
  }, [conversation, isRestoring, isSending, latestId, scrollToLatest, streamingMessageId, resetKey])

  function submit(text: string) {
    followsLatest.current = true
    send(text)
  }

  return (
    <TooltipProvider>
      <section ref={section} className="chat" data-mode={conversation ? 'conversation' : 'empty'} aria-label={t('conversation.thread')}>
        <AnimatePresence initial={false} mode="popLayout">
          {!conversation && (
            <motion.div
              key="hero"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10, transition: { duration: 0.16, ease: 'easeIn' } }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
            >
              <Hero />
            </motion.div>
          )}
        </AnimatePresence>

        {conversation && (
          <div className="chat__thread">
            {isRestoring ? (
              <div className="chat__restoring" role="status" aria-label={t('conversation.restoring')}>
                <Skeleton className="chat__skeleton chat__skeleton--user" />
                <Skeleton className="chat__skeleton" />
                <Skeleton className="chat__skeleton chat__skeleton--short" />
              </div>
            ) : (
              <ol className="chat__list" role="log" aria-live="polite" aria-relevant="additions">
                {messages.map((message) => (
                  <ChatLine
                    key={message.id}
                    message={message}
                    stream={!reducedMotion && streamingMessageId === message.id}
                    animate={animateIncoming}
                    resolved={resolvedMessageIds.has(message.id)}
                  />
                ))}
              </ol>
            )}
            {thinkingSince !== null && (
              <motion.div initial={reducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={rise}>
                <ChatThinking key={thinkingSince} startedAt={thinkingSince} />
              </motion.div>
            )}
            <div ref={anchor} className="chat__anchor" aria-hidden="true" />
          </div>
        )}

        <motion.div ref={dock} className="chat__dock" layout={reducedMotion ? false : 'position'} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
          <AnimatePresence>
            {unread && (
              <motion.div
                className="chat__jump"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.18 }}
              >
                <Button size="sm" variant="secondary" onClick={() => { followsLatest.current = true; setUnread(false); scrollToLatest(true) }}>
                  {t('conversation.newMessage')} <ArrowDown aria-hidden="true" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          {error && (
            <div className="chat__error" role="alert">
              <CircleAlert size={16} aria-hidden="true" />
              <p>{t(error === 'restore' ? 'conversation.restoreError' : 'conversation.sendError')}</p>
              <Button size="sm" variant="ghost" disabled={isSending || isRestoring} onClick={retry}>{t('conversation.retry')}</Button>
            </div>
          )}
          <ChatComposer key={resetKey} ref={input} disabled={blocked} sessionId={sessionId} onSend={submit} />
        </motion.div>

        {!conversation && (
          <ChatPrompt disabled={blocked} onPrompt={submit} />
        )}
      </section>
    </TooltipProvider>
  )
}
