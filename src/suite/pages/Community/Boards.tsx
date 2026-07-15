import { useCallback, useEffect, useState } from 'react'
import { useT } from '@/i18n'
import { useToast } from '../../components/ui/Toast'
import { IcoPlus, IcoSparkle } from '../../components/ui/Icons'
import { listDesigns, type AIDesign } from '../../ai/aiDesignStore'
import {
  addReply,
  createPost,
  listPosts,
  toggleVote,
  COLLAB_TOPICS,
  type CommunityPost,
  type PostKind,
} from '../../community/communityClient'
import { gradFor, initialsOf } from './Lounge'

/* Feedback + Collab boards: post cards with votes and inline replies, plus the create dialog
   (feedback posts can attach a design straight from the user's AI library). */

type UserRef = { id: string; name: string }

function timeAgo(ts: number, t: (k: string, v?: Record<string, string | number>) => string): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return t('chub.time.now')
  const m = Math.floor(s / 60)
  if (m < 60) return t('chub.time.min', { n: m })
  const h = Math.floor(m / 60)
  if (h < 24) return t('chub.time.h', { n: h })
  return t('chub.time.d', { n: Math.floor(h / 24) })
}

/* ── One post card ─────────────────────────────────────────────────────────────────────── */

function PostCard({
  post,
  user,
  onChanged,
  onAnswerInChat,
}: {
  post: CommunityPost
  user: UserRef
  onChanged: (next: CommunityPost) => void
  onAnswerInChat?: (authorName: string) => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const voted = post.voterIds.includes(user.id)

  async function vote() {
    const next = await toggleVote(post.id, user.id)
    if (next) onChanged(next)
  }

  async function submitReply() {
    const text = reply.trim()
    if (!text || busy) return
    setBusy(true)
    const next = await addReply(post.id, { authorId: user.id, authorName: user.name, text })
    setBusy(false)
    if (next) {
      onChanged(next)
      setReply('')
    }
  }

  const replyLabel =
    post.replies.length === 0
      ? t('chub.replies.zero')
      : post.replies.length === 1
        ? t('chub.replies.one')
        : t('chub.replies.many', { n: post.replies.length })

  return (
    <article className={`chub-post${post.kind === 'collab' ? ' chub-post--collab' : ''}`}>
      {post.image && (
        <div className="chub-post__media">
          <img src={post.image} alt={post.title} loading="lazy" />
        </div>
      )}

      {post.tags.length > 0 && (
        <div className="chub-post__tags">
          {post.tags.map((tag) => (
            <span key={tag} className={`chub-tag chub-tag--${tag === 'seeking' || tag === 'offering' || tag === 'challenge' ? tag : 'topic'}`}>
              {t(`chub.tag.${tag}`)}
            </span>
          ))}
        </div>
      )}

      <h3 className="chub-post__title">{post.title}</h3>
      {post.body && <p className="chub-post__body">{post.body}</p>}

      <div className="chub-post__foot">
        <span className="chub-author">
          <span className={`com-av com-av--sm ${gradFor(post.authorName)}`}>{initialsOf(post.authorName)}</span>
          <span className="chub-author__text">
            <b>{post.authorId === user.id ? t('chub.lounge.you') : post.authorName}</b>
            <small>{timeAgo(post.createdAt, t)}</small>
          </span>
        </span>

        <div className="chub-post__actions">
          <button type="button" className={`chub-vote${voted ? ' is-on' : ''}`} aria-pressed={voted} title={t('chub.votes.title')} onClick={() => void vote()}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5m0 0l-6 6m6-6l6 6" /></svg>
            {post.votes}
          </button>
          <button type="button" className={`chub-replybtn${open ? ' is-open' : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {replyLabel}
          </button>
          {onAnswerInChat && (
            <button type="button" className="s-btn s-btn--subtle chub-chatbtn" onClick={() => onAnswerInChat(post.authorName)}>
              {t('chub.co.reply')}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="chub-replies">
          {post.replies.map((r) => (
            <div className="chub-replyrow" key={r.id}>
              <span className={`com-av com-av--sm ${gradFor(r.authorName)}`}>{initialsOf(r.authorName)}</span>
              <div className="chub-replyrow__body">
                <span className="chub-msg__meta">
                  <b>{r.authorId === user.id ? t('chub.lounge.you') : r.authorName}</b>
                  <small>{timeAgo(r.createdAt, t)}</small>
                </span>
                <p>{r.text}</p>
              </div>
            </div>
          ))}
          <div className="chub-replybox">
            <input
              type="text"
              value={reply}
              placeholder={t('chub.reply.placeholder')}
              aria-label={t('chub.reply.placeholder')}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submitReply()}
            />
            <button type="button" className="s-btn s-btn--accent" disabled={!reply.trim() || busy} onClick={() => void submitReply()}>
              {t('chub.reply.send')}
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

/* ── Create-post dialog ────────────────────────────────────────────────────────────────── */

export function PostDialog({
  kind,
  user,
  challenge,
  onClose,
  onCreated,
}: {
  kind: PostKind
  user: UserRef
  /** When set, this is a weekly-challenge entry: prefilled title + 'challenge' tag. */
  challenge?: { themeTitle: string; reward: number }
  onClose: () => void
  onCreated: (post: CommunityPost, isChallenge: boolean) => void
}) {
  const t = useT()
  const toast = useToast()
  const [title, setTitle] = useState(challenge ? challenge.themeTitle : '')
  const [body, setBody] = useState('')
  const [mode, setMode] = useState<'seeking' | 'offering'>('seeking')
  const [topic, setTopic] = useState<string>('collab-drop')
  const [designs, setDesigns] = useState<AIDesign[]>([])
  const [image, setImage] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)

  // Feedback posts can attach a design from the user's AI library.
  useEffect(() => {
    if (kind !== 'feedback') return
    void listDesigns(user.id).then(setDesigns)
  }, [kind, user.id])

  async function submit() {
    if (!title.trim() || busy) return
    setBusy(true)
    const tags = kind === 'collab' ? [mode, topic] : challenge ? ['challenge'] : []
    const post = await createPost({ kind, authorId: user.id, authorName: user.name, title, body, image, tags })
    setBusy(false)
    if (!post) {
      toast(t('chub.toast.fail'), 'info')
      return
    }
    onCreated(post, Boolean(challenge))
    onClose()
  }

  return (
    <div className="chub-scrim" role="presentation" onClick={onClose}>
      <div className="chub-dlg" role="dialog" aria-modal="true" aria-label={kind === 'feedback' ? t('chub.dlg.fb.title') : t('chub.dlg.co.title')} onClick={(e) => e.stopPropagation()}>
        <header className="chub-dlg__head">
          <h2>{kind === 'feedback' ? t('chub.dlg.fb.title') : t('chub.dlg.co.title')}</h2>
          <button type="button" className="chub-dlg__x" aria-label={t('chub.dlg.close')} onClick={onClose}>×</button>
        </header>

        {challenge && (
          <p className="chub-dlg__challenge">
            <IcoSparkle width="13" height="13" /> {t('chub.dlg.challenge.note', { n: challenge.reward })}
          </p>
        )}

        <label className="chub-field">
          <span>{t('chub.dlg.title.label')}</span>
          <input
            type="text"
            value={title}
            maxLength={120}
            placeholder={kind === 'feedback' ? t('chub.dlg.title.ph.fb') : t('chub.dlg.title.ph.co')}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="chub-field">
          <span>{t('chub.dlg.body.label')}</span>
          <textarea rows={3} value={body} maxLength={1000} placeholder={t('chub.dlg.body.ph')} onChange={(e) => setBody(e.target.value)} />
        </label>

        {kind === 'collab' && (
          <>
            <div className="chub-field">
              <span>{t('chub.dlg.mode.label')}</span>
              <div className="chub-modes" role="radiogroup" aria-label={t('chub.dlg.mode.label')}>
                <button type="button" role="radio" aria-checked={mode === 'seeking'} className={`chub-mode chub-mode--seek${mode === 'seeking' ? ' is-on' : ''}`} onClick={() => setMode('seeking')}>
                  {t('chub.tag.seeking')}
                </button>
                <button type="button" role="radio" aria-checked={mode === 'offering'} className={`chub-mode chub-mode--offer${mode === 'offering' ? ' is-on' : ''}`} onClick={() => setMode('offering')}>
                  {t('chub.tag.offering')}
                </button>
              </div>
            </div>
            <div className="chub-field">
              <span>{t('chub.dlg.topic.label')}</span>
              <div className="chub-topics">
                {COLLAB_TOPICS.map((tp) => (
                  <button key={tp} type="button" className={`chub-topic${topic === tp ? ' is-on' : ''}`} aria-pressed={topic === tp} onClick={() => setTopic(tp)}>
                    {t(`chub.tag.${tp}`)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {kind === 'feedback' && (
          <div className="chub-field">
            <span>{t('chub.dlg.image.label')}</span>
            {designs.length === 0 ? (
              <p className="chub-dlg__none">{t('chub.dlg.image.none')}</p>
            ) : (
              <div className="chub-picker">
                {designs.slice(0, 12).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className={`chub-pick${image === d.frontUrl ? ' is-on' : ''}`}
                    aria-pressed={image === d.frontUrl}
                    title={d.name}
                    onClick={() => setImage((cur) => (cur === d.frontUrl ? undefined : d.frontUrl))}
                  >
                    <img src={d.frontUrl} alt={d.name} loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <footer className="chub-dlg__foot">
          <button type="button" className="s-btn s-btn--subtle" onClick={onClose}>{t('chub.dlg.cancel')}</button>
          <button type="button" className="s-btn s-btn--accent" disabled={!title.trim() || busy} onClick={() => void submit()}>
            {busy ? t('chub.dlg.posting') : t('chub.dlg.post')}
          </button>
        </footer>
      </div>
    </div>
  )
}

/* ── Boards ────────────────────────────────────────────────────────────────────────────── */

function useBoard(kind: PostKind) {
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const refresh = useCallback(() => {
    void listPosts(kind).then(setPosts)
  }, [kind])
  useEffect(() => {
    refresh()
  }, [refresh])
  const patch = useCallback((next: CommunityPost) => {
    setPosts((prev) => prev.map((p) => (p.id === next.id ? next : p)))
  }, [])
  const prepend = useCallback((post: CommunityPost) => {
    setPosts((prev) => [post, ...prev])
  }, [])
  return { posts, patch, prepend }
}

export function FeedbackBoard({
  user,
  createOpen,
  challenge,
  onCloseCreate,
  onCreated,
}: {
  user: UserRef
  createOpen: boolean
  challenge?: { themeTitle: string; reward: number }
  onCloseCreate: () => void
  onCreated: (post: CommunityPost, isChallenge: boolean) => void
}) {
  const t = useT()
  const { posts, patch, prepend } = useBoard('feedback')
  const [open, setOpen] = useState(false)

  return (
    <section className="chub-board" aria-label={t('chub.fb.head')}>
      <div className="chub-board__head">
        <div>
          <h2>{t('chub.fb.head')}</h2>
          <p>{t('chub.fb.sub')}</p>
        </div>
        <button type="button" className="s-btn s-btn--accent" onClick={() => setOpen(true)}>
          <IcoPlus width="15" height="15" /> {t('chub.fb.cta')}
        </button>
      </div>

      {posts.length === 0 ? (
        <p className="chub-board__empty">{t('chub.fb.empty')}</p>
      ) : (
        <div className="chub-grid">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} user={user} onChanged={patch} />
          ))}
        </div>
      )}

      {(open || createOpen) && (
        <PostDialog
          kind="feedback"
          user={user}
          challenge={createOpen ? challenge : undefined}
          onClose={() => {
            setOpen(false)
            onCloseCreate()
          }}
          onCreated={(post, isChallenge) => {
            prepend(post)
            onCreated(post, isChallenge)
          }}
        />
      )}
    </section>
  )
}

export function CollabBoard({
  user,
  onAnswerInChat,
  onCreated,
}: {
  user: UserRef
  onAnswerInChat: (authorName: string) => void
  onCreated: (post: CommunityPost) => void
}) {
  const t = useT()
  const { posts, patch, prepend } = useBoard('collab')
  const [open, setOpen] = useState(false)

  return (
    <section className="chub-board" aria-label={t('chub.co.head')}>
      <div className="chub-board__head">
        <div>
          <h2>{t('chub.co.head')}</h2>
          <p>{t('chub.co.sub')}</p>
        </div>
        <button type="button" className="s-btn s-btn--accent" onClick={() => setOpen(true)}>
          <IcoPlus width="15" height="15" /> {t('chub.co.cta')}
        </button>
      </div>

      {posts.length === 0 ? (
        <p className="chub-board__empty">{t('chub.co.empty')}</p>
      ) : (
        <div className="chub-grid">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} user={user} onChanged={patch} onAnswerInChat={onAnswerInChat} />
          ))}
        </div>
      )}

      {open && (
        <PostDialog
          kind="collab"
          user={user}
          onClose={() => setOpen(false)}
          onCreated={(post) => {
            prepend(post)
            onCreated(post)
          }}
        />
      )}
    </section>
  )
}
