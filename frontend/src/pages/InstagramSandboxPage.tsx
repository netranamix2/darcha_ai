import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeft, Bookmark, ChevronLeft, Heart, MessageCircle, MoreHorizontal, Send, SignalHigh, Wifi,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { getInstagramFeed, postInstagramComment } from '../api/client'
import type { InstagramComment, InstagramTrace } from '../api/types'
import { WindowMark } from '../components/Brand'
import { GlassPanel } from '../components/ui'
import { instagramMessages } from '../i18n/instagram'
import { useT } from '../i18n/useT'
import './instagram-sandbox.css'

const emojis = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂']
const avatarColors = ['#f58529', '#dd2a7b', '#8134af', '#515bd4', '#2a9d8f', '#e76f51', '#457b9d', '#6a4c93']
const langLabel = { 'uz-latn': 'Oʻzbek (lotin)', 'uz-cyrl': 'Ўзбек (кирилл)', ru: 'Русский' } as const

function defaultName() {
  try {
    const saved = localStorage.getItem('darcha:instagram-sandbox:name')
    if (saved) return saved
  } catch {
    // Storage may be unavailable.
  }
  return `mehmon_${Math.floor(100 + Math.random() * 900)}`
}

function rememberName(name: string) {
  try { localStorage.setItem('darcha:instagram-sandbox:name', name) } catch { /* in-memory only */ }
}

function ago(date: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(date)) / 60_000))
  if (minutes < 1) return 'hozir'
  if (minutes < 60) return `${minutes} daq`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} soat`
  return `${Math.floor(hours / 24)} kun`
}

function clock(date: string) {
  return new Date(date).toLocaleTimeString('uz-Latn', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function colorFor(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return avatarColors[hash % avatarColors.length]
}

function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

function UserAvatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span className="igs-avatar" style={{ width: size, height: size, background: colorFor(name) }} aria-hidden="true">
      {name.replace(/[^\p{L}\p{N}]/gu, '').charAt(0).toUpperCase() || '?'}
    </span>
  )
}

function BotAvatar({ size = 32, ring = false }: { size?: number; ring?: boolean }) {
  return (
    <span className={ring ? 'igs-bot-avatar igs-bot-avatar--ring' : 'igs-bot-avatar'} style={{ width: size, height: size }} aria-hidden="true">
      <span><WindowMark /></span>
    </span>
  )
}

function LikeButton({ small = false }: { small?: boolean }) {
  const [liked, setLiked] = useState(false)
  const size = small ? 12 : 24
  return (
    <motion.button
      type="button"
      className={small ? 'igs-icon igs-icon--small' : 'igs-icon'}
      aria-label="Yoqtirish"
      aria-pressed={liked}
      whileTap={{ scale: 0.8 }}
      animate={liked ? { scale: [1, 1.25, 1] } : { scale: 1 }}
      transition={{ duration: 0.3 }}
      onClick={() => setLiked((value) => !value)}
    >
      <Heart size={size} strokeWidth={small ? 2 : 1.75} fill={liked ? '#ff3040' : 'none'} color={liked ? '#ff3040' : 'currentColor'} />
    </motion.button>
  )
}

function CommentText({ text }: { text: string }) {
  const [first, ...rest] = text.split('\n')
  return (
    <>
      {first}
      {rest.map((line, index) => <span key={index} className={line.startsWith('📄') ? 'igs-source' : 'igs-line'}>{line}</span>)}
    </>
  )
}

function CommentRow({ comment, now, reply = false }: { comment: InstagramComment; now: number; reply?: boolean }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: reply ? 8 : -6 }}
      animate={{ opacity: comment.hidden ? 0.45 : 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className={reply ? 'igs-comment igs-comment--reply' : 'igs-comment'}
    >
      {comment.is_bot ? <BotAvatar size={reply ? 26 : 32} /> : <UserAvatar name={comment.author} size={reply ? 26 : 32} />}
      <div className="igs-comment-body">
        {comment.hidden ? (
          <p className="igs-hidden">Izoh yashirildi</p>
        ) : (
          <p><b>{comment.author}</b>{comment.is_bot ? <span className="igs-author-pill">Sandbox</span> : null} <CommentText text={comment.text} /></p>
        )}
        <div className="igs-meta">
          <span>{ago(comment.created_at, now)}</span>
          {comment.is_bot ? <span>{comment.pending ? 'kutilmoqda' : '2 ta yoqtirish'}</span> : null}
          <button type="button">Javob berish</button>
        </div>
      </div>
      {comment.hidden ? null : <LikeButton small />}
    </motion.div>
  )
}

function Typing() {
  return (
    <motion.div className="igs-comment igs-comment--reply igs-typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <BotAvatar size={26} />
      <p><b>darcha.demo</b> yozmoqda<span className="igs-dots"><i /><i /><i /></span></p>
    </motion.div>
  )
}

function PostMedia() {
  const [burst, setBurst] = useState(0)
  return (
    <div className="igs-media" onDoubleClick={() => setBurst((value) => value + 1)}>
      <div className="igs-media-glow" />
      <span className="igs-media-mark"><WindowMark /></span>
      <h2>Taʼlim boʻyicha savolingiz bormi?</h2>
      <p>Izohda yozing — hujjat asosida javob beramiz</p>
      <span className="igs-media-tag">darcha.demo · sandbox</span>
      <AnimatePresence>
        {burst ? (
          <motion.span
            key={burst}
            className="igs-burst"
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: [0.2, 1.15, 1], opacity: [0, 1, 1] }}
            exit={{ scale: 1.3, opacity: 0 }}
            transition={{ duration: 0.45 }}
            onAnimationComplete={() => window.setTimeout(() => setBurst(0), 350)}
          >
            <Heart size={96} fill="#fff" color="#fff" />
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function TracePanel({ trace, comment }: { trace?: InstagramTrace; comment?: InstagramComment }) {
  const t = useT(instagramMessages)
  if (!trace) return <p className="igs-trace-empty">{t('ig.traceEmpty')}</p>
  const reply = comment?.replies.find(({ is_bot }) => is_bot)
  const steps: Array<{ label: string; value: string; time?: string; tone?: string }> = [
    { label: t('ig.received'), value: comment ? `@${comment.author}` : '—', time: clock(trace.received_at) },
  ]
  if (trace.lang) steps.push({ label: t('ig.lang'), value: langLabel[trace.lang] })
  if (trace.topic) steps.push({ label: t('ig.topic'), value: trace.topic })
  if (trace.documents !== undefined && trace.level !== 'hidden') steps.push({ label: t('ig.documents'), value: String(trace.documents) })
  steps.push({ label: t('ig.level'), value: t(`ig.${trace.level}`), tone: trace.level })
  if (trace.ticket_number) steps.push({ label: t('ig.ticket'), value: `№ ${trace.ticket_number}` })
  if (trace.level === 'hidden') {
    steps.push({ label: '—', value: trace.reason === 'abuse' ? t('ig.hiddenAbuse') : t('ig.hiddenOffTopic') })
  } else if (trace.replied_at && !reply?.pending) {
    steps.push({ label: t('ig.replied'), value: '✓', time: clock(trace.replied_at), tone: 'done' })
  } else {
    steps.push({ label: t('ig.replied'), value: t('ig.waiting'), tone: 'wait' })
  }
  return (
    <ol className="igs-trace">
      {steps.map((step, index) => (
        <motion.li key={`${trace.comment_id}-${step.label}-${index}`} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.12 }} data-tone={step.tone}>
          <span className="igs-trace-label">{step.label}</span>
          <span className="igs-trace-value">{step.value}</span>
          {step.time ? <time>{step.time}</time> : null}
        </motion.li>
      ))}
    </ol>
  )
}

export default function InstagramSandboxPage() {
  const t = useT(instagramMessages)
  const now = useNow()
  const queryClient = useQueryClient()
  const [name, setName] = useState(defaultName)
  const [editingName, setEditingName] = useState(false)
  const [text, setText] = useState('')
  const [typingFor, setTypingFor] = useState<string | null>(null)
  const [optimistic, setOptimistic] = useState<InstagramComment | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const feed = useQuery({ queryKey: ['instagram-feed'], queryFn: getInstagramFeed, refetchInterval: 3000 })

  const post = useMutation({
    mutationFn: (message: string) => postInstagramComment(feed.data?.post_id ?? '', name, message),
    onMutate: (message) => {
      const id = `pending-${Date.now()}`
      setOptimistic({ id, author: name, text: message, created_at: new Date().toISOString(), is_bot: false, replies: [] })
      setTypingFor(id)
      listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    },
    onSuccess: async (trace) => {
      const started = Date.now()
      await queryClient.invalidateQueries({ queryKey: ['instagram-feed'] })
      const wait = Math.max(0, 1400 - (Date.now() - started))
      window.setTimeout(() => {
        setOptimistic(null)
        setTypingFor(trace.level === 'hidden' ? null : trace.comment_id)
        window.setTimeout(() => setTypingFor(null), 900)
      }, wait)
    },
    onError: () => { setOptimistic(null); setTypingFor(null) },
  })

  const comments = useMemo(() => {
    const list = feed.data?.comments ?? []
    return optimistic ? [optimistic, ...list] : list
  }, [feed.data, optimistic])
  const latestTrace = feed.data?.traces[0]
  const latestComment = latestTrace ? feed.data?.comments.find(({ id }) => id === latestTrace.comment_id) : undefined
  const commentCount = (feed.data?.comments.length ?? 0) + 20

  function submit(event?: FormEvent) {
    event?.preventDefault()
    const message = text.trim()
    if (!message || post.isPending) return
    setText('')
    post.mutate(message)
  }

  return (
    <main className="igs-page">
      <header className="igs-top">
        <Link to="/#channels" className="igs-back"><ArrowLeft size={16} aria-hidden="true" />{t('ig.back')}</Link>
      </header>
      <div className="igs-stage">
        <aside className="igs-intro">
          <span className="igs-intro-kicker">Darcha · {t('ig.title')}</span>
          <p>{t('ig.lead')}</p>
          <Link to="/panel/inbox" className="igs-intro-link">{t('ig.panel')} →</Link>
          <small>{t('ig.note')}</small>
        </aside>

        <div className="igs-phone" aria-label="Instagram sandbox">
          <div className="igs-screen">
            <div className="igs-status">
              <span>{new Date(now).toLocaleTimeString('uz-Latn', { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="igs-notch" aria-hidden="true" />
              <span className="igs-status-icons" aria-hidden="true"><SignalHigh size={14} /><Wifi size={14} /><i className="igs-battery" /></span>
            </div>
            <div className="igs-bar">
              <ChevronLeft size={26} strokeWidth={1.75} aria-hidden="true" />
              <div><small>DARCHA.DEMO</small><b>Postlar</b></div>
              <span />
            </div>

            <div className="igs-scroll" ref={listRef}>
              <div className="igs-post-head">
                <BotAvatar ring size={36} />
                <div>
                  <p><b>darcha.demo</b><span className="igs-author-pill">Sandbox</span></p>
                  <small>Toshkent</small>
                </div>
                <MoreHorizontal size={20} aria-hidden="true" />
              </div>
              <PostMedia />
              <div className="igs-actions">
                <LikeButton />
                <button type="button" className="igs-icon" aria-label="Izoh"><MessageCircle size={24} strokeWidth={1.75} /></button>
                <button type="button" className="igs-icon" aria-label="Ulashish"><Send size={24} strokeWidth={1.75} /></button>
                <button type="button" className="igs-icon igs-icon--end" aria-label="Saqlash"><Bookmark size={24} strokeWidth={1.75} /></button>
              </div>
              <div className="igs-caption">
                <p><b>1 248 ta yoqtirish</b></p>
                <p><b>darcha.demo</b> Kontrakt, oʻqishni koʻchirish, attestatsiya — savolingizni yozing 👇</p>
                <button type="button" className="igs-muted">Barcha {commentCount} ta izohni koʻrish</button>
                <small className="igs-muted">2 soat oldin</small>
              </div>

              <div className="igs-comments">
                <AnimatePresence initial={false}>
                  {comments.map((comment) => (
                    <motion.div key={comment.id} layout>
                      <CommentRow comment={comment} now={now} />
                      <div className="igs-replies">
                        {comment.replies.map((reply) => <CommentRow key={reply.id} comment={reply} now={now} reply />)}
                        <AnimatePresence>{typingFor === comment.id ? <Typing /> : null}</AnimatePresence>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <form className="igs-composer" onSubmit={submit}>
              <div className="igs-emoji">
                {emojis.map((emoji) => <button key={emoji} type="button" onClick={() => setText((value) => value + emoji)}>{emoji}</button>)}
              </div>
              {editingName ? (
                <div className="igs-name">
                  <label htmlFor="igs-name">Ism:</label>
                  <input id="igs-name" value={name} maxLength={30} autoFocus
                    onChange={(event) => setName(event.target.value.replace(/\s+/g, '_'))}
                    onBlur={() => { setEditingName(false); rememberName(name || defaultName()) }}
                    onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); (event.target as HTMLInputElement).blur() } }} />
                </div>
              ) : null}
              <div className="igs-input-row">
                <button type="button" className="igs-name-button" onClick={() => setEditingName(true)} aria-label="Ismni o‘zgartirish">
                  <UserAvatar name={name || '?'} size={32} />
                </button>
                <input value={text} maxLength={500} placeholder="darcha.demo uchun izoh qoldiring…"
                  onChange={(event) => setText(event.target.value)} aria-label="Izoh" />
                <button type="submit" className="igs-post" disabled={!text.trim() || post.isPending}>Joylash</button>
              </div>
            </form>
          </div>
        </div>

        <GlassPanel className="igs-trace-panel">
          <h2>{t('ig.traceTitle')}</h2>
          <AnimatePresence mode="wait">
            <motion.div key={latestTrace?.comment_id ?? 'empty'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <TracePanel trace={latestTrace} comment={latestComment} />
            </motion.div>
          </AnimatePresence>
        </GlassPanel>
      </div>
    </main>
  )
}
