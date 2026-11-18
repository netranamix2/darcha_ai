import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ApiError, createChatSession, getChatMessages, sendChatMessage, subscribeToCaseChanges } from '../api/client'
import type { ChatMessage } from '../api/types'

const sessionKey = 'darcha.chat.session'
const pollInterval = 7_000
const messageLimit = 1_000
const emptyHistory: ChatMessage[] = []
const historyKey = (sessionId: string | null) => ['public-chat', sessionId] as const

function readSession() {
  try {
    return localStorage.getItem(sessionKey)?.trim() || null
  } catch {
    return null
  }
}

function saveSession(sessionId: string) {
  try {
    localStorage.setItem(sessionKey, sessionId)
  } catch {
    // The current chat stays available if browser storage is blocked.
  }
}

function discardSession(sessionId: string) {
  try {
    if (readSession() === sessionId) localStorage.removeItem(sessionKey)
  } catch {
    // The expired chat is cleared from the current page as well.
  }
}

function isExpired(error: unknown) {
  return error instanceof ApiError && (error.status === 404 || error.status === 410)
}

function conversationStatus(messages: ChatMessage[]) {
  const pendingTickets = new Map<string, string>()
  const resolvedMessageIds = new Set<string>()
  let yellowPending = false

  for (const message of messages) {
    const { reply } = message
    if (message.role === 'assistant' && reply?.level === 'yellow') yellowPending = true
    if (message.role === 'assistant' && reply?.level === 'red') {
      pendingTickets.set(reply.ticket_number ?? message.id, message.id)
    }
    if (message.role === 'specialist') {
      // Older servers may omit a ticket number on specialist messages.
      const ticket = reply?.ticket_number ?? pendingTickets.keys().next().value
      if (ticket === undefined) continue
      const originalId = pendingTickets.get(ticket)
      if (!originalId) continue
      resolvedMessageIds.add(originalId)
      pendingTickets.delete(ticket)
    }
  }

  return { resolvedMessageIds, needsPolling: yellowPending || pendingTickets.size > 0 }
}

function keepUserMessageIds(messages: ChatMessage[], sent: Map<string, ChatMessage>) {
  if (!sent.size) return messages
  return messages.map((message, index) => {
    if (message.role !== 'user') return message
    const assistant = messages[index + 1]
    if (assistant?.role !== 'assistant') return message
    const local = sent.get(assistant.reply?.message_id ?? assistant.id)
    return local?.text === message.text ? { ...message, id: local.id } : message
  })
}

interface SendAttempt {
  message: ChatMessage
  thinkingSince: number
}

export function usePublicChat() {
  const queryClient = useQueryClient()
  const [sessionId, setSessionId] = useState(readSession)
  const currentSession = useRef(sessionId)
  const inFlight = useRef(false)
  const sent = useRef(new Map<string, ChatMessage>())
  const seenGreen = useRef(new Set<string>())
  const hydratedSession = useRef<string | null>(null)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)

  function clearSession(id: string) {
    if (currentSession.current !== id) return
    discardSession(id)
    currentSession.current = null
    setSessionId(null)
    setStreamingMessageId(null)
  }

  const sendRequest = useMutation({
    mutationFn: async ({ message }: SendAttempt) => {
      let id = currentSession.current
      if (!id) {
        const session = await createChatSession()
        id = session.session_id
        currentSession.current = id
        saveSession(id)
        setSessionId(id)
      }

      await queryClient.cancelQueries({ queryKey: historyKey(id), exact: true })
      try {
        const reply = await sendChatMessage(id, message.text)
        return { id, reply }
      } catch (error) {
        if (isExpired(error)) clearSession(id)
        throw error
      }
    },
    onSuccess: ({ id, reply }, { message }) => {
      sent.current.set(reply.message_id, message)
      if (reply.level === 'green') {
        setStreamingMessageId(reply.message_id)
      }
      queryClient.setQueryData<ChatMessage[]>(historyKey(id), (previous = emptyHistory) => [
        ...previous,
        message,
        {
          id: reply.message_id,
          role: 'assistant',
          text: reply.answer,
          created_at: new Date().toISOString(),
          reply,
        },
      ])
    },
    onSettled: () => {
      inFlight.current = false
    },
    // A failed response does not prove that the server missed the POST.
    // TODO(backend): Add idempotency keys for retrying interrupted sends safely.
    retry: false,
  })

  const history = useQuery({
    queryKey: historyKey(sessionId),
    queryFn: sessionId ? async () => keepUserMessageIds(await getChatMessages(sessionId), sent.current) : skipToken,
    enabled: Boolean(sessionId) && !sendRequest.isPending,
    refetchInterval: ({ state }) => conversationStatus(state.data ?? emptyHistory).needsPolling ? pollInterval : false,
    refetchIntervalInBackground: true,
    staleTime: pollInterval,
    retry: false,
  })

  useEffect(() => {
    if (!sessionId) return
    return subscribeToCaseChanges(() => {
      void queryClient.invalidateQueries({ queryKey: historyKey(sessionId), exact: true })
    })
  }, [queryClient, sessionId])

  useEffect(() => {
    if (sessionId && !history.data && isExpired(history.error) && currentSession.current === sessionId) {
      discardSession(sessionId)
      currentSession.current = null
      setSessionId(null)
      setStreamingMessageId(null)
    }
  }, [history.data, history.error, sessionId])

  useLayoutEffect(() => {
    if (!sessionId || !history.data) return
    const green = history.data.filter(({ role, reply }) => role === 'assistant' && reply?.level === 'green')
    if (hydratedSession.current === sessionId) {
      const latest = green.filter(({ id }) => !seenGreen.current.has(id)).at(-1)
      if (latest) setStreamingMessageId(latest.id)
    }
    hydratedSession.current = sessionId
    seenGreen.current = new Set(green.map(({ id }) => id))
  }, [history.data, sessionId])

  const committed = history.data ?? emptyHistory
  const { resolvedMessageIds } = useMemo(() => conversationStatus(committed), [committed])
  const attempt = sendRequest.isPending || sendRequest.isError ? sendRequest.variables : undefined
  const messages = useMemo(() => (
    attempt && !committed.some(({ id }) => id === attempt.message.id) ? [...committed, attempt.message] : committed
  ), [attempt, committed])
  const isRestoring = Boolean(sessionId) && history.isPending && !sendRequest.isPending
  const error = sendRequest.isError ? 'send' : history.isError && !isExpired(history.error) ? 'restore' : null

  function start(attempt: SendAttempt) {
    if (inFlight.current) return
    inFlight.current = true
    sendRequest.mutate(attempt)
  }

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || trimmed.length > messageLimit || isRestoring || (history.isError && !history.data && !isExpired(history.error))) return
    const now = Date.now()
    start({
      message: { id: crypto.randomUUID(), role: 'user', text: trimmed, created_at: new Date(now).toISOString() },
      thinkingSince: now,
    })
  }

  function retry() {
    if (inFlight.current) return
    if (sendRequest.isError && sendRequest.variables) {
      start({ ...sendRequest.variables, thinkingSince: Date.now() })
    } else if (history.isError) {
      void history.refetch()
    }
  }

  return {
    sessionId,
    messages,
    isRestoring,
    isSending: sendRequest.isPending,
    thinkingSince: sendRequest.isPending ? attempt?.thinkingSince ?? null : null,
    streamingMessageId,
    resolvedMessageIds,
    error,
    send,
    retry,
  } as const
}
