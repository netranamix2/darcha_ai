import { ApiError } from '../errors'
import { getTicketExtensionLimit } from '../ticket-deadlines'
import type { Citation, InboxItem, Ticket, TicketEvent, TicketPatch } from '../types'
import { cite, determineReply, topics } from './chat'
import type { ChatCase } from './chat-state'
import {
  cases, liveSchedule, persistChatState, ratings, requireRecord, sessions, takeTicketNumber, ticketFallbackDelay,
} from './chat-state'
import { dayMs } from './dates'
import { inbox, responseSeconds, tickets } from './fixtures'
import { currentStaff, departmentFor, similarResolvedTickets, staff, ticketExamples } from './ticket-examples'

const ratingDelay = 20_000
const arrivalInterval = 40_000
const knowledgeBase = [
  ...Object.values(topics).map(({ source }) => cite(source, 'uz-latn')),
  ...determineReply('shikoyat').citations,
]

export function getMockKnowledgeBase() {
  return structuredClone(knowledgeBase)
}

export function answerCitations(answer: string) {
  return knowledgeBase.filter(({ url }) => answer.includes(url))
}

function linkedCase(ticketId: string) {
  for (const entry of cases) {
    if (entry[1].ticketId === ticketId) return entry
  }
  return undefined
}

function originalReply(record: ChatCase) {
  return sessions.get(record.sessionId)?.find(({ id }) => id === record.messageId)
}

function eventsOf(ticket: Ticket): TicketEvent[] {
  return ticket.events ??= [{ type: 'created', actor: 'ai', created_at: ticket.created_at }]
}

export function markDelivered(record: ChatCase, item: InboxItem, now: number) {
  record.followUp = null
  item.status = 'sent'
  responseSeconds.set(item.id, Math.max(0, now - Date.parse(item.created_at)) / 1_000)
}

export function createTicketForInbox(item: InboxItem, now: number, draft: string | null): Ticket {
  const seq = takeTicketNumber()
  const ticket: Ticket = {
    id: `T-${seq}`,
    number: `DCH-${seq}`,
    topic: item.classification.topic,
    region: item.classification.region,
    priority: item.classification.flags.includes('fraud') ? 'high' : 'normal',
    status: 'new',
    channel: item.channel,
    created_at: new Date(now).toISOString(),
    due_at: new Date(now + 15 * dayMs).toISOString(),
    summary: item.text.length > 160 ? `${item.text.slice(0, 159)}…` : item.text,
    original_text: item.text,
    draft_answer: draft,
    final_answer: null,
    department: departmentFor(item.classification.topic, item.text),
    assignee_id: null,
    flags: [...item.classification.flags],
    similar_cases: [],
  }
  eventsOf(ticket)
  ticket.similar_cases = similarResolvedTickets(ticket, tickets.values())
  tickets.set(ticket.id, ticket)
  item.level = 'red'
  item.status = 'draft'
  item.ticket_id = ticket.id
  item.ticket_number = ticket.number
  responseSeconds.delete(item.id)
  return ticket
}

export function convertInboxItem(id: string): Ticket {
  const item = requireRecord(inbox, id)
  if (item.ticket_id) return requireRecord(tickets, item.ticket_id)

  const result = determineReply(item.text, true)
  const now = Date.now()
  const ticket = createTicketForInbox(item, now, item.draft?.answer ?? result.followUp)
  const record = cases.get(id)
  if (record) {
    record.ticketId = ticket.id
    record.followUp = { availableAt: now + ticketFallbackDelay, answer: result.followUp, citations: result.citations }
    const message = originalReply(record)
    if (message?.reply) {
      message.text = result.answer
      message.reply = {
        ...message.reply,
        answer: result.answer,
        citations: result.citations,
        level: 'red',
        ticket_number: ticket.number,
        due_at: ticket.due_at,
      }
    }
  }

  persistChatState()
  return ticket
}

export function viewTicket(id: string) {
  const ticket = requireRecord(tickets, id)
  const events = eventsOf(ticket)
  const viewed = events.some(({ type, actor }) => type === 'viewed' && actor === currentStaff.name)
  const followUp = linkedCase(id)?.[1]
  if (viewed && !followUp?.followUp) return
  if (followUp) followUp.followUp = null
  if (!viewed) events.push({ type: 'viewed', actor: currentStaff.name, created_at: new Date().toISOString() })
  persistChatState()
}

export function patchTicket(id: string, patch: TicketPatch) {
  const ticket = requireRecord(tickets, id)
  const dueDateChanged = patch.due_at !== undefined && patch.due_at !== ticket.due_at
  const assignedTo = patch.assignee_id ? staff.find((member) => member.id === patch.assignee_id) : null
  if (patch.assignee_id && !assignedTo) throw new ApiError(422, 'Unknown staff member')

  const originalDueAt = ticket.original_due_at ?? ticket.due_at
  const reason = patch.extension_reason?.trim()
  if (dueDateChanged) {
    const nextDue = Date.parse(patch.due_at ?? '')
    const maximum = Date.parse(getTicketExtensionLimit(originalDueAt))
    if (!reason || !(nextDue > Date.parse(ticket.due_at) && nextDue <= maximum)) {
      throw new ApiError(422, 'An extension must include a reason and stay within one month of the original deadline')
    }
  }

  const updated: Ticket = {
    ...ticket,
    ...structuredClone(patch),
    id,
    events: ticket.events,
    original_due_at: dueDateChanged ? originalDueAt : ticket.original_due_at,
    extension_reason: dueDateChanged ? reason : ticket.extension_reason,
  }
  if (JSON.stringify(ticket) === JSON.stringify(updated)) return

  const now = new Date().toISOString()
  const events = eventsOf(updated)
  if (patch.assignee_id !== undefined && patch.assignee_id !== ticket.assignee_id) {
    events.push({ type: 'assigned', actor: currentStaff.name, created_at: now, note: assignedTo?.name })
  }
  if (patch.status !== undefined && patch.status !== ticket.status) {
    events.push({ type: 'status_changed', actor: currentStaff.name, created_at: now, note: patch.status })
  }
  if (dueDateChanged) events.push({ type: 'extended', actor: currentStaff.name, created_at: now, note: reason })

  tickets.set(id, updated)
  const record = linkedCase(id)?.[1]
  if (record) {
    record.followUp = null
    const message = originalReply(record)
    if (message?.reply && dueDateChanged) message.reply.due_at = updated.due_at
  }
  persistChatState()
}

export function resolveTicket(ticket: Ticket, answer: string, actor: string, citations: Citation[]) {
  if (ticket.status === 'answered' && ticket.final_answer === answer) return false

  const now = Date.now()
  const timestamp = new Date(now).toISOString()
  ticket.status = 'answered'
  ticket.final_answer = answer
  eventsOf(ticket).push({ type: 'answered', actor, created_at: timestamp })
  if (!ticket.events?.some(({ type }) => type === 'rated')) ratings.set(ticket.id, now + ratingDelay)

  const match = linkedCase(ticket.id)
  if (!match) {
    const item = [...inbox.values()].find(({ ticket_id }) => ticket_id === ticket.id)
    if (item) {
      item.status = 'sent'
      responseSeconds.set(item.id, Math.max(0, now - Date.parse(item.created_at)) / 1_000)
    }
    return true
  }

  const [inboxId, record] = match
  const history = requireRecord(sessions, record.sessionId)
  const specialist = history.find(({ role, reply }) => role === 'specialist' && reply?.ticket_number === ticket.number)
  // Retried sends keep a single specialist reply per ticket, including a later correction.
  const id = specialist?.id ?? crypto.randomUUID()
  const message = {
    id,
    role: 'specialist',
    text: answer,
    created_at: timestamp,
    reply: {
      message_id: id,
      answer,
      citations,
      level: 'green',
      ticket_number: ticket.number,
      due_at: null,
    },
  } as const
  if (specialist) Object.assign(specialist, message)
  else history.push(message)
  markDelivered(record, requireRecord(inbox, inboxId), now)
  return true
}

export function processTicketActivity() {
  const now = Date.now()
  let changed = false

  for (const [id, due] of ratings) {
    if (due > now) continue
    ratings.delete(id)
    const ticket = tickets.get(id)
    if (ticket) eventsOf(ticket).push({ type: 'rated', actor: 'citizen', created_at: new Date(due).toISOString(), note: '4' })
    changed = true
  }

  if (liveSchedule.nextArrivalAt === null) {
    liveSchedule.nextArrivalAt = now + arrivalInterval
    changed = true
  } else if (liveSchedule.nextArrivalAt <= now) {
    liveSchedule.nextArrivalAt = now + arrivalInterval
    const example = ticketExamples[Math.floor(now / arrivalInterval) % ticketExamples.length]
    const item: InboxItem = {
      id: `IN-${crypto.randomUUID()}`,
      channel: example.channel,
      text: example.text,
      created_at: new Date(now).toISOString(),
      level: 'red',
      classification: {
        type: 'Shikoyat',
        topic: example.topic,
        region: example.region,
        sentiment: 'negative',
        flags: example.flags ?? [],
        lang: 'uz',
        script: 'latin',
      },
      draft: null,
      status: 'draft',
    }
    inbox.set(item.id, item)
    const ticket = createTicketForInbox(item, now, example.answer)
    ticket.summary = example.summary
    ticket.priority = example.priority
    ticket.department = example.department
    changed = true
  }

  if (changed) persistChatState()
}
