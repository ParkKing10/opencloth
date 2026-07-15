import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '@/i18n'
import { CHANNELS, listMessages, sendMessage, onlineNow, type ChannelId, type ChatMessage } from '../../community/communityClient'

/* The Lounge — channel-based brand chat. Near-realtime via polling (only while the tab is
   visible), optimistic sends, day dividers, consecutive-message grouping. */

const POLL_MS = 5000

/** Stable avatar gradient per author (reuses the com-grad-* classes from com.css). */
export function gradFor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return `com-grad-${(h % 6) + 1}`
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U'
}

function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

type Props = {
  user: { id: string; name: string }
  channel: ChannelId
  onChannelChange: (ch: ChannelId) => void
  /** Composer prefill (e.g. "@Mika Okafor " from a collab card); consumed once. */
  prefill: string
  onPrefillConsumed: () => void
}

export function Lounge({ user, channel, onChannelChange, prefill, onPrefillConsumed }: Props) {
  const t = useT()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const stickToBottom = useRef(true)
  const channelRef = useRef(channel)
  channelRef.current = channel

  const refresh = useCallback(async () => {
    const forChannel = channel
    const next = await listMessages(forChannel)
    // A slow response from a previous channel must never overwrite the current one.
    if (channelRef.current !== forChannel) return
    setMessages((prev) => {
      // Cheap change check keeps polling from re-rendering (and re-scrolling) needlessly.
      if (prev.length === next.length && prev[prev.length - 1]?.id === next[next.length - 1]?.id) return prev
      return next
    })
  }, [channel])

  // Load on channel switch + poll while visible.
  useEffect(() => {
    setMessages([])
    stickToBottom.current = true
    void refresh()
    const iv = setInterval(() => {
      if (!document.hidden) void refresh()
    }, POLL_MS)
    return () => clearInterval(iv)
  }, [refresh])

  // Consume a prefill (mention) once: put it in the composer and focus.
  useEffect(() => {
    if (!prefill) return
    setDraft(prefill)
    onPrefillConsumed()
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [prefill, onPrefillConsumed])

  // Keep pinned to the newest message unless the user scrolled up.
  useEffect(() => {
    const el = listRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages])

  function onScroll() {
    const el = listRef.current
    if (!el) return
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  async function send() {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setDraft('')
    const msg = await sendMessage({ channel, authorId: user.id, authorName: user.name, text })
    setSending(false)
    if (msg) {
      stickToBottom.current = true
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
    } else {
      setDraft(text) // let the user retry a failed/empty send
    }
  }

  function fmtTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function dayLabel(ts: number): string {
    const today = dayKey(Date.now())
    const yesterday = dayKey(Date.now() - 86_400_000)
    const key = dayKey(ts)
    if (key === today) return t('chub.lounge.today')
    if (key === yesterday) return t('chub.lounge.yesterday')
    return new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short' })
  }

  const online = onlineNow()

  return (
    <div className="chub-lounge">
      {/* Channel rail */}
      <aside className="chub-rail" aria-label="Channels">
        {CHANNELS.map((ch) => (
          <button
            key={ch}
            type="button"
            className={`chub-chan${ch === channel ? ' is-active' : ''}`}
            aria-pressed={ch === channel}
            onClick={() => onChannelChange(ch)}
          >
            <span className="chub-chan__hash">#</span>
            <span className="chub-chan__text">
              <b>{t(`chub.ch.${ch}`)}</b>
              <small>{t(`chub.chd.${ch}`)}</small>
            </span>
          </button>
        ))}
      </aside>

      {/* Chat pane */}
      <div className="chub-chat">
        <header className="chub-chat__head">
          <span className="chub-chat__name"># {t(`chub.ch.${channel}`)}</span>
          <span className="chub-chat__desc">{t(`chub.chd.${channel}`)}</span>
          <span className="chub-online">
            <span className="chub-online__dot" aria-hidden="true" />
            {t('chub.lounge.online', { n: online })}
          </span>
        </header>

        {/* role=log + tabIndex: keyboard users can focus and scroll the history; SRs announce new messages politely. */}
        <div className="chub-msgs" ref={listRef} onScroll={onScroll} tabIndex={0} role="log" aria-label={`# ${t(`chub.ch.${channel}`)}`}>
          {messages.length === 0 ? (
            <div className="chub-chat__empty">
              <b>{t('chub.lounge.empty.title')}</b>
              <span>{t('chub.lounge.empty.body')}</span>
            </div>
          ) : (
            messages.map((m, i) => {
              const prev = messages[i - 1]
              const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt)
              const grouped = !newDay && prev && prev.authorId === m.authorId && m.createdAt - prev.createdAt < 5 * 60_000
              const own = m.authorId === user.id
              return (
                <div key={m.id}>
                  {newDay && (
                    <div className="chub-day" role="separator">
                      <span>{dayLabel(m.createdAt)}</span>
                    </div>
                  )}
                  <div className={`chub-msg${own ? ' is-own' : ''}${grouped ? ' is-grouped' : ''}`}>
                    {!grouped && <span className={`com-av com-av--sm ${gradFor(m.authorName)}`}>{initialsOf(m.authorName)}</span>}
                    <div className="chub-msg__body">
                      {!grouped && (
                        <span className="chub-msg__meta">
                          <b>{own ? t('chub.lounge.you') : m.authorName}</b>
                          <small>{fmtTime(m.createdAt)}</small>
                        </span>
                      )}
                      <p className="chub-msg__text">{m.text}</p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <footer className="chub-composer">
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            placeholder={t('chub.lounge.placeholder', { channel: t(`chub.ch.${channel}`) })}
            aria-label={t('chub.lounge.placeholder', { channel: t(`chub.ch.${channel}`) })}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Never send mid-IME-composition (JA/ZH/KO candidate confirm) and let touch
              // keyboards insert newlines — they have no Shift, sending is the button's job there.
              if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
              if (window.matchMedia('(pointer: coarse)').matches) return
              e.preventDefault()
              void send()
            }}
          />
          <button type="button" className="s-btn s-btn--accent chub-send" disabled={!draft.trim() || sending} onClick={() => void send()}>
            {t('chub.lounge.send')}
          </button>
        </footer>
      </div>
    </div>
  )
}
