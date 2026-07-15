import { useCallback, useEffect, useState } from 'react'
import { useT } from '@/i18n'
import { SuitePage } from '../_shared/SuitePage'
import { useAuth } from '../../auth/auth'
import { useToast } from '../../components/ui/Toast'
import { useRewards } from '../../economy/useRewards'
import { IcoCoins, IcoCommunity, IcoSparkle, IcoBolt, IcoCheck } from '../../components/ui/Icons'
import {
  CHALLENGE_REWARD,
  challengeClaimed,
  communityShared,
  currentChallenge,
  markChallengeClaimed,
  onlineNow,
  CHANNELS,
  type ChannelId,
} from '../../community/communityClient'
import { Lounge } from './Lounge'
import { FeedbackBoard, CollabBoard } from './Boards'
import { Showcase } from './Showcase'
import './com.css'
import './hub.css'

/* Community 2.0 — the hub where brands actually help each other:
   Lounge (channel chat) · Feedback board · Collab board · Designer showcase,
   topped by a hero with live stats and the weekly coin challenge. */

type TabId = 'lounge' | 'feedback' | 'collabs' | 'designers'
const TABS: TabId[] = ['lounge', 'feedback', 'collabs', 'designers']

export function Community() {
  const t = useT()
  const toast = useToast()
  const { user } = useAuth()
  const { grant } = useRewards()

  const [tab, setTab] = useState<TabId>('lounge')
  const [channel, setChannel] = useState<ChannelId>('general')
  const [prefill, setPrefill] = useState('')
  const [challengeOpen, setChallengeOpen] = useState(false)
  const [shared, setShared] = useState<boolean | null>(null)

  const challenge = currentChallenge()
  const claimed = user ? challengeClaimed(user.id, challenge.id) : false
  const [claimedNow, setClaimedNow] = useState(claimed)

  useEffect(() => {
    void communityShared().then(setShared)
  }, [])

  // A collab card's "answer in chat": jump to the Lounge collabs channel with an @mention ready.
  const answerInChat = useCallback((authorName: string) => {
    setPrefill(`@${authorName} `)
    setChannel('collabs')
    setTab('lounge')
  }, [])

  // A posted challenge entry earns coins — once per user per week.
  const onFeedbackCreated = useCallback(
    (_post: unknown, isChallenge: boolean) => {
      toast(t('chub.toast.posted'), 'success')
      if (!isChallenge || !user) return
      if (challengeClaimed(user.id, challenge.id)) return
      markChallengeClaimed(user.id, challenge.id)
      setClaimedNow(true)
      grant(CHALLENGE_REWARD, `Weekly challenge ${challenge.id}`)
      toast(t('chub.toast.challenge', { n: CHALLENGE_REWARD }), 'accent')
    },
    [user, challenge.id, grant, toast, t],
  )

  if (!user) return null

  const userRef = { id: user.id, name: user.name }
  const done = claimed || claimedNow

  return (
    <SuitePage eyebrow={t('chub.eyebrow')} title={t('chub.title')} subtitle={t('chub.subtitle')} wide>
      <div className="chub">
        {/* ── Hero: mission + live stats + weekly challenge ── */}
        <div className="chub-hero">
          <div className="chub-hero__glow" aria-hidden="true" />
          <div className="chub-hero__main">
            <h2 className="chub-hero__title">{t('chub.hero.title')}</h2>
            <p className="chub-hero__sub">{t('chub.hero.sub')}</p>
            <div className="chub-stats">
              <span className="chub-stat">
                <b>12.4k</b> {t('chub.stat.members')}
              </span>
              <span className="chub-stat chub-stat--live">
                <span className="chub-online__dot" aria-hidden="true" />
                <b>{onlineNow()}</b> {t('chub.stat.online')}
              </span>
              <span className="chub-stat">
                <b>{CHANNELS.length}</b> {t('chub.stat.channels')}
              </span>
            </div>
          </div>

          <div className="chub-challenge">
            <span className="chub-challenge__kicker">
              <IcoBolt width="12" height="12" /> {t('chub.challenge.kicker')}
              <span className="chub-challenge__reward">
                <IcoCoins width="12" height="12" /> {t('chub.challenge.reward', { n: CHALLENGE_REWARD })}
              </span>
            </span>
            <b className="chub-challenge__theme">{t(challenge.themeKey)}</b>
            <p className="chub-challenge__hint">{t('chub.challenge.hint', { n: CHALLENGE_REWARD })}</p>
            <button
              type="button"
              className={`s-btn chub-challenge__cta${done ? '' : ' s-btn--accent'}`}
              disabled={done}
              onClick={() => {
                setTab('feedback')
                setChallengeOpen(true)
              }}
            >
              {done ? (
                <>
                  <IcoCheck width="14" height="14" /> {t('chub.challenge.done')}
                </>
              ) : (
                <>
                  <IcoSparkle width="14" height="14" /> {t('chub.challenge.cta')}
                </>
              )}
            </button>
          </div>
        </div>

        {shared === false && <p className="chub-localnote">{t('chub.local.note')}</p>}

        {/* ── Tabs ── */}
        <div className="chub-tabs" role="tablist" aria-label={t('chub.title')}>
          {TABS.map((tb) => (
            <button
              key={tb}
              type="button"
              role="tab"
              aria-selected={tab === tb}
              className={`chub-tabbtn${tab === tb ? ' is-active' : ''}`}
              onClick={() => setTab(tb)}
            >
              {tb === 'lounge' && <IcoCommunity width="15" height="15" />}
              {t(`chub.tab.${tb}`)}
              {tb === 'lounge' && <span className="chub-livepill">{t('chub.tab.live')}</span>}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        {tab === 'lounge' && (
          <Lounge
            user={userRef}
            channel={channel}
            onChannelChange={setChannel}
            prefill={prefill}
            onPrefillConsumed={() => setPrefill('')}
          />
        )}
        {tab === 'feedback' && (
          <FeedbackBoard
            user={userRef}
            createOpen={challengeOpen}
            challenge={{ themeTitle: t(challenge.themeKey), reward: CHALLENGE_REWARD }}
            onCloseCreate={() => setChallengeOpen(false)}
            onCreated={onFeedbackCreated}
          />
        )}
        {tab === 'collabs' && (
          <CollabBoard user={userRef} onAnswerInChat={answerInChat} onCreated={() => toast(t('chub.toast.posted'), 'success')} />
        )}
        {tab === 'designers' && <Showcase />}
      </div>
    </SuitePage>
  )
}
