import { ArrowDown, CircleAlert, UserRound } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { memo, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../../api/types'
import { usePublicChat } from '../../hooks/usePublicChat'
import { chatMessages } from '../../i18n/chat'
import { useT } from '../../i18n/useT'
import { Button, GlassPanel, Skeleton } from '../ui'
import { ChatAnswer, ChatSources } from './ChatAnswer'
import { ChatComposer } from './ChatComposer'
import { ChatHeader, ChatOrb } from './ChatHeader'
import { ChatPrompt } from './ChatPrompt'
import { ChatFraud, ChatPending, ChatTicket } from './ChatStatus'
import { ChatThinking } from './ChatThinking'
import './chat.css'

const messageTransition = { duration: 0.2, ease: 'easeOut' } as const

function AssistantReply({ message, stream, resolved }: {
  message: ChatMessage
  stream: boolean
  resolved: boolean
}) {
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

const ChatLine = memo(function ChatLine({ message, stream, animate, resolved }: {
  message: ChatMessage
  stream: boolean
  animate: boolean
  resolved: boolean
}) {
  const t = useT(chatMessages)
  const { reply } = message

  return (
    <motion.li
      className={'chat-message chat-message--' + message.role}
      initial={animate ? { y: 4, opacity: 0 } : false}
      animate={{ y: 0, opacity: 1 }}
      transition={messageTransition}
    >
      {message.role === 'user' ? (
        <div className="chat-bubble chat-bubble--user"><p>{message.text}</p></div>
      ) : message.role === 'specialist' ? (
        <>
          <div className="chat-bubble chat-bubble--specialist">
            <div className="chat-specialist-label"><UserRound size={15} aria-hidden="true" />{t('conversation.specialist')}</div>
            <p>{message.text}</p>
          </div>
          {reply && <ChatSources citations={reply.citations} />}
        </>
      ) : (
        <div className="chat-reply-stack">
          <AssistantReply message={message} stream={stream} resolved={resolved} />
        </div>
      )}
    </motion.li>
  )
})

function isAtLatest(viewport: HTMLDivElement) {
  return viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 48
}

export default function PublicChat() {
  const {
    sessionId, resetKey, messages, isRestoring, isSending, thinkingSince, streamingMessageId, resolvedMessageIds, error, send, retry,
  } = usePublicChat()
  const t = useT(chatMessages)
  const titleId = useId()
  const reducedMotion = useReducedMotion()
  const viewport = useRef<HTMLDivElement>(null)
  const followsLatest = useRef(true)
  const scrollDeadline = useRef(0)
  const loaded = useRef(false)
  const lastContent = useRef<[string | undefined, string | null]>()
  const [unread, setUnread] = useState(false)
  const latestId = messages.at(-1)?.id
  const animateIncoming = loaded.current && !reducedMotion

  useLayoutEffect(() => {
    if (isRestoring || !viewport.current) return
    const element = viewport.current
    const changed = !lastContent.current || latestId !== lastContent.current[0] || streamingMessageId !== lastContent.current[1]
    const smooth = loaded.current && !reducedMotion && element.scrollHeight > element.clientHeight
    lastContent.current = [latestId, streamingMessageId]
    loaded.current = true
    if (!latestId) {
      followsLatest.current = true
      scrollDeadline.current = 0
      setUnread(false)
    }

    if (followsLatest.current) {
      scrollDeadline.current = smooth ? performance.now() + 500 : 0
      element.scrollTo({ top: element.scrollHeight, behavior: smooth ? 'smooth' : 'instant' })
    } else if (latestId && changed) {
      setUnread(true)
    }
  }, [isRestoring, isSending, latestId, reducedMotion, resetKey, streamingMessageId])

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
    <GlassPanel variant="elevated" className="public-chat" role="region" aria-labelledby={titleId} data-thinking={isSending || undefined}>
      <ChatHeader titleId={titleId} sessionId={sessionId} />
      <div className="chat-transcript-frame">
        <div
          ref={viewport}
          className="chat-transcript"
          role="log"
          aria-relevant="additions"
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
            <div className="chat-restoring" role="status">
              <span className="chat-restoring-status"><ChatOrb />{t('conversation.restoring')}</span>
              <Skeleton className="chat-restoring-line" />
              <Skeleton className="chat-restoring-line" />
            </div>
          ) : messages.length || thinkingSince !== null ? (
            <>
              <ol className="chat-message-list">
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
              {thinkingSince !== null && <ChatThinking key={thinkingSince} startedAt={thinkingSince} />}
            </>
          ) : (
            <ChatPrompt disabled={blocked} onPrompt={send} />
          )}
        </div>
        {unread && (
          <Button size="sm" variant="secondary" className="chat-jump" onClick={goToLatest}>
            {t('conversation.newMessage')} <ArrowDown size={14} aria-hidden="true" />
          </Button>
        )}
      </div>
      <div className="chat-footer">
        {error && (
          <div className="chat-error">
            <p role="alert"><CircleAlert size={17} aria-hidden="true" />{t(error === 'restore' ? 'conversation.restoreError' : 'conversation.sendError')}</p>
            <Button size="sm" variant="secondary" disabled={isSending || isRestoring} onClick={retry}>{t('conversation.retry')}</Button>
          </div>
        )}
        <ChatComposer key={resetKey} disabled={blocked} onSend={send} />
      </div>
    </GlassPanel>
  )
}
