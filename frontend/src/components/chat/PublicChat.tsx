import { ArrowDown } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { memo, useLayoutEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../../api/types'
import { usePublicChat } from '../../hooks/usePublicChat'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { chatMessages } from '../../i18n/chat'
import { publicHomeMessages } from '../../i18n/public-home'
import { useT } from '../../i18n/useT'
import { WindowMark } from '../Brand'
import { CitationFootnotes } from '../CitationFootnotes'
import { Skeleton } from '../ui'
import { ChatComposer } from './ChatComposer'
import { ChatFeedback } from './ChatFeedback'
import { ChatPrompt } from './ChatPrompt'
import { ChatFraud, ChatPending, ChatTicket } from './ChatStatus'
import { ChatThinking } from './ChatThinking'
import './chat.css'

function AssistantReply({ message, resolved }: { message: ChatMessage; resolved: boolean }) {
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
  return (
    <>
      <p className="chat-answer-text">{reply?.answer ?? message.text}</p>
      {reply?.citations.length ? (
        <>
          <CitationFootnotes citations={reply.citations} />
          <ChatFeedback messageId={message.id} />
        </>
      ) : null}
    </>
  )
}

const ChatLine = memo(function ChatLine({ message, animate, resolved }: {
  message: ChatMessage
  animate: boolean
  resolved: boolean
}) {
  const t = useT(chatMessages)
  const specialist = message.role === 'specialist'

  return (
    <motion.li
      className={'chat-message chat-message--' + message.role}
      initial={animate ? { y: 6, opacity: 0 } : false}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {message.role === 'user' ? (
        <p className="chat-user-text">{message.text}</p>
      ) : (
        <>
          <WindowMark />
          <div className="chat-reply-body">
            <p className="chat-speaker">{t(specialist ? 'conversation.specialist' : 'brand.name')}</p>
            {specialist ? (
              <>
                <p className="chat-answer-text">{message.text}</p>
                {message.reply?.citations.length ? <CitationFootnotes citations={message.reply.citations} /> : null}
              </>
            ) : <AssistantReply message={message} resolved={resolved} />}
          </div>
        </>
      )}
    </motion.li>
  )
})

function isAtLatest(viewport: HTMLDivElement) {
  return viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 48
}

export default function PublicChat() {
  const {
    sessionId, resetKey, messages, isRestoring, isSending, thinkingSince, resolvedMessageIds, error, send, retry,
  } = usePublicChat()
  const t = useT(chatMessages)
  const tHome = useT(publicHomeMessages)
  const reducedMotion = useReducedMotion()
  const viewport = useRef<HTMLDivElement>(null)
  const followsLatest = useRef(true)
  const scrollDeadline = useRef(0)
  const loaded = useRef(false)
  const previousLatest = useRef<ChatMessage>()
  const [unread, setUnread] = useState(false)
  const latest = messages.at(-1)
  const hasConversation = Boolean(latest || isRestoring || thinkingSince !== null)
  const animateIncoming = loaded.current && !reducedMotion

  useLayoutEffect(() => {
    if (!latest) {
      followsLatest.current = true
      scrollDeadline.current = 0
      previousLatest.current = undefined
      setUnread(false)
    }
    if (isRestoring) return
    const element = viewport.current
    const changed = latest !== previousLatest.current
    const smooth = loaded.current && !reducedMotion && Boolean(element && element.scrollHeight > element.clientHeight)
    loaded.current = true
    previousLatest.current = latest
    if (!element) return

    if (followsLatest.current) {
      scrollDeadline.current = smooth ? performance.now() + 500 : 0
      element.scrollTo({ top: element.scrollHeight, behavior: smooth ? 'smooth' : 'instant' })
    } else if (latest && changed) {
      setUnread(true)
    }
  }, [isRestoring, isSending, latest, reducedMotion, resetKey])

  function handleScroll(element: HTMLDivElement) {
    if (isAtLatest(element)) {
      followsLatest.current = true
      scrollDeadline.current = 0
      if (unread) setUnread(false)
    } else if (performance.now() >= scrollDeadline.current) {
      followsLatest.current = false
    }
  }

  function goToLatest() {
    const element = viewport.current
    if (!element) return
    followsLatest.current = true
    scrollDeadline.current = reducedMotion ? 0 : performance.now() + 500
    element.scrollTo({ top: element.scrollHeight, behavior: reducedMotion ? 'instant' : 'smooth' })
    setUnread(false)
  }

  const blocked = isRestoring || isSending || (error === 'restore' && !messages.length)

  return (
    <section className="public-chat" data-conversation={hasConversation || undefined} aria-label={t('conversation.thread')}>
      {hasConversation && <h1 className="sr-only">{tHome('public.heading')}</h1>}
      <AnimatePresence initial={false}>
        {!hasConversation && (
          <motion.header
            className="chat-hero"
            exit={reducedMotion ? undefined : { y: -6, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <p className="chat-ministry">{tHome('public.ministry')}</p>
            <h1>{tHome('public.heading')}</h1>
            <p className="chat-hero-description">{tHome('public.description')}</p>
          </motion.header>
        )}
      </AnimatePresence>
      {hasConversation && (
        <div className="chat-transcript-frame">
          <div
            ref={viewport}
            className="chat-transcript"
            role="log"
            aria-relevant="additions text"
            aria-label={t('conversation.thread')}
            tabIndex={0}
            onScroll={(event) => handleScroll(event.currentTarget)}
            onWheel={(event) => { if (event.deltaY < 0) scrollDeadline.current = 0 }}
            onTouchStart={() => { scrollDeadline.current = 0 }}
            onKeyDown={(event) => {
              if (event.target === event.currentTarget && ['ArrowUp', 'PageUp', 'Home'].includes(event.key)) scrollDeadline.current = 0
            }}
          >
            {isRestoring ? (
              <div className="chat-restoring" role="status" aria-label={t('conversation.restoring')}>
                <Skeleton className="chat-restoring-line" />
                <Skeleton className="chat-restoring-line" />
              </div>
            ) : (
              <>
                <ol className="chat-message-list" role="list">
                  {messages.map((message) => (
                    <ChatLine
                      key={message.id}
                      message={message}
                      animate={animateIncoming}
                      resolved={resolvedMessageIds.has(message.id)}
                    />
                  ))}
                </ol>
                {thinkingSince !== null && <ChatThinking key={thinkingSince} startedAt={thinkingSince} />}
              </>
            )}
          </div>
          {unread && (
            <button type="button" className="chat-jump" onClick={goToLatest}>
              {t('conversation.newMessage')} <ArrowDown size={14} strokeWidth={1.5} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
      <div className="chat-footer">
        {error && (
          <div className="chat-error">
            <p role="alert">{t(error === 'restore' ? 'conversation.restoreError' : 'conversation.sendError')}</p>
            <button className="public-inline-action" type="button" disabled={isSending || isRestoring} onClick={retry}>
              {t('conversation.retry')}
            </button>
          </div>
        )}
        <ChatComposer key={resetKey} disabled={blocked} sessionId={sessionId} onSend={send} />
      </div>
      {!hasConversation && <ChatPrompt disabled={blocked} onPrompt={send} />}
    </section>
  )
}
