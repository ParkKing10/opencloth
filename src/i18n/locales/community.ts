import type { LocaleBundle } from '../types'

/* Community 2.0 — the hub (`chub.*`: hero, challenge, lounge chat, feedback + collab boards)
   plus the retained designer-showcase strings (`community.*`). Keep en and de key sets identical. */
export const community: LocaleBundle = {
  en: {
    /* ── Page frame ── */
    'chub.eyebrow': 'Community',
    'chub.title': 'Community',
    'chub.subtitle': 'Do not grow alone — ask, get feedback, find partners and ship drops together.',

    /* ── Hero + stats ── */
    'chub.hero.title': 'Brands grow faster together.',
    'chub.hero.sub': 'Ask the lounge, get honest design feedback, find collab partners — this is where loom brands help each other ship.',
    'chub.stat.members': 'members',
    'chub.stat.online': 'online now',
    'chub.stat.channels': 'channels',

    /* ── Weekly challenge ── */
    'chub.challenge.kicker': 'Weekly Challenge',
    'chub.challenge.reward': '+{n} coins',
    'chub.challenge.cta': 'Submit a design',
    'chub.challenge.done': 'Submitted',
    'chub.challenge.hint': 'Post your take on the feedback board — your first submission this week earns {n} coins.',
    'chub.challenge.theme.varsity': 'Reinvent the varsity jacket',
    'chub.challenge.theme.denim': 'Denim, but unexpected',
    'chub.challenge.theme.techrunner': 'Techwear for the everyday runner',
    'chub.challenge.theme.monochrome': 'One colour, full look',
    'chub.challenge.theme.oversized': 'Oversized done elegantly',
    'chub.challenge.theme.workwear': 'Workwear off the worksite',
    'chub.challenge.theme.y2k': 'Y2K without the costume',
    'chub.challenge.theme.capsule': 'A 3-piece capsule that sells',

    /* ── Tabs ── */
    'chub.tab.lounge': 'Lounge',
    'chub.tab.feedback': 'Feedback',
    'chub.tab.collabs': 'Collabs',
    'chub.tab.designers': 'Designers',
    'chub.tab.live': 'LIVE',

    /* ── Local fallback notice ── */
    'chub.local.note': 'Shared mode is off — the community runs per-browser until the Supabase migration (supabase/community.sql) is applied.',

    /* ── Lounge ── */
    'chub.ch.general': 'general',
    'chub.ch.feedback': 'feedback',
    'chub.ch.production': 'production',
    'chub.ch.collabs': 'collabs',
    'chub.ch.drops': 'drops',
    'chub.chd.general': 'Intros & what you are working on',
    'chub.chd.feedback': 'Quick takes on work in progress',
    'chub.chd.production': 'Manufacturers, QC, sourcing help',
    'chub.chd.collabs': 'Find partners, split drops',
    'chub.chd.drops': 'Announce and celebrate launches',
    'chub.lounge.online': '{n} online',
    'chub.lounge.placeholder': 'Message #{channel} — ask anything…',
    'chub.lounge.send': 'Send',
    'chub.lounge.empty.title': 'It’s quiet in here',
    'chub.lounge.empty.body': 'Be the first — ask a question or share what you’re building.',
    'chub.lounge.today': 'Today',
    'chub.lounge.yesterday': 'Yesterday',
    'chub.lounge.you': 'You',

    /* ── Boards: shared ── */
    'chub.votes.title': 'Helpful — vote up',
    'chub.replies.zero': 'Reply',
    'chub.replies.one': '1 reply',
    'chub.replies.many': '{n} replies',
    'chub.reply.placeholder': 'Write a helpful reply…',
    'chub.reply.send': 'Reply',

    /* ── Feedback board ── */
    'chub.fb.head': 'Design feedback',
    'chub.fb.sub': 'Post a piece, ask a precise question, get honest takes from other brands.',
    'chub.fb.cta': 'Ask for feedback',
    'chub.fb.empty': 'No feedback posts yet — yours could be the first.',

    /* ── Collab board ── */
    'chub.co.head': 'Collab board',
    'chub.co.sub': 'Seek or offer: production capacity, photography, design help, split drops.',
    'chub.co.cta': 'Create a listing',
    'chub.co.reply': 'Answer in chat',
    'chub.co.empty': 'No listings yet — post the first one.',

    /* ── Tags ── */
    'chub.tag.seeking': 'SEEKING',
    'chub.tag.offering': 'OFFERING',
    'chub.tag.collab-drop': 'Collab drop',
    'chub.tag.manufacturer': 'Manufacturer',
    'chub.tag.photography': 'Photography',
    'chub.tag.print': 'Print',
    'chub.tag.design-help': 'Design help',
    'chub.tag.other': 'Other',
    'chub.tag.challenge': 'Challenge',

    /* ── Post dialog ── */
    'chub.dlg.fb.title': 'Ask the community for feedback',
    'chub.dlg.co.title': 'Create a collab listing',
    'chub.dlg.title.label': 'Title',
    'chub.dlg.title.ph.fb': 'One precise question — “Is the neckline too wide?”',
    'chub.dlg.title.ph.co': '“Seeking: lookbook photographer in Berlin”',
    'chub.dlg.body.label': 'Details',
    'chub.dlg.body.ph': 'Context, constraints, what you already tried…',
    'chub.dlg.image.label': 'Attach a design (optional)',
    'chub.dlg.image.none': 'No designs yet — generate one in the AI Designer first.',
    'chub.dlg.mode.label': 'I am…',
    'chub.dlg.topic.label': 'Topic',
    'chub.dlg.cancel': 'Cancel',
    'chub.dlg.post': 'Post',
    'chub.dlg.posting': 'Posting…',
    'chub.dlg.challenge.note': 'Challenge entry — earns {n} coins when posted.',
    'chub.dlg.close': 'Close',

    /* ── Toasts ── */
    'chub.toast.posted': 'Posted to the community',
    'chub.toast.challenge': '+{n} coins — challenge entry submitted!',
    'chub.toast.fail': 'That didn’t go through — try again.',

    /* ── Relative time ── */
    'chub.time.now': 'now',
    'chub.time.min': '{n}m',
    'chub.time.h': '{n}h',
    'chub.time.d': '{n}d',

    /* ── Designer showcase (retained) ── */
    'community.designers.head': 'Top designers',
    'community.designers.sub': 'Verified makers shipping the most-loved work this month.',
    'community.designer.verified': 'Verified designer',
    'community.designer.followers': 'followers',
    'community.designer.projects': 'projects',
    'community.thumb.title': '{kind} project',
    'community.designer.following': 'Following',
    'community.designer.follow': 'Follow',
    'community.designer.unfollowTitle': 'Unfollow {name}',
    'community.designer.followTitle': 'Follow {name}',
    'community.designer.hire': 'Hire',
    'community.designer.copied': 'Copied',
    'community.designer.hireTitle': 'Copy a hire link for {name}',
    'community.designer.hireTitleCopied': 'Hire link for {name} copied — copy again',
    'community.toast.following': 'Following {name}',
    'community.toast.unfollowed': 'Unfollowed {name}',
    'community.toast.hireCopied': 'Hire link for {name} copied to clipboard',
    'community.toast.hireFail': 'Could not copy the hire link — clipboard is blocked',
    'community.hire.subject': 'Project enquiry — {name}',
    'community.hire.member': 'A loom studios member',
    'community.hire.body':
      'Hi {name},\n\n{from} would like to discuss a {category} project with you. Are you open to new commissions?\n\nSent via the loom studios community.',
    'community.cat.Streetwear': 'Streetwear',
    'community.cat.Outerwear': 'Outerwear',
    'community.cat.Denim': 'Denim',
    'community.cat.Techwear': 'Techwear',
    'community.cat.Knitwear': 'Knitwear',
    'community.cat.Vintage': 'Vintage',
  },
  de: {
    /* ── Page frame ── */
    'chub.eyebrow': 'Community',
    'chub.title': 'Community',
    'chub.subtitle': 'Wachse nicht allein — frag, hol dir Feedback, finde Partner und launcht Drops zusammen.',

    /* ── Hero + stats ── */
    'chub.hero.title': 'Marken wachsen schneller zusammen.',
    'chub.hero.sub': 'Frag die Lounge, hol dir ehrliches Design-Feedback, finde Collab-Partner — hier helfen sich loom-Marken gegenseitig beim Launchen.',
    'chub.stat.members': 'Mitglieder',
    'chub.stat.online': 'jetzt online',
    'chub.stat.channels': 'Channels',

    /* ── Weekly challenge ── */
    'chub.challenge.kicker': 'Weekly Challenge',
    'chub.challenge.reward': '+{n} Coins',
    'chub.challenge.cta': 'Design einreichen',
    'chub.challenge.done': 'Eingereicht',
    'chub.challenge.hint': 'Poste deine Version aufs Feedback-Board — deine erste Einreichung diese Woche bringt {n} Coins.',
    'chub.challenge.theme.varsity': 'Erfinde die College-Jacke neu',
    'chub.challenge.theme.denim': 'Denim, aber unerwartet',
    'chub.challenge.theme.techrunner': 'Techwear für den Alltags-Runner',
    'chub.challenge.theme.monochrome': 'Eine Farbe, ein ganzer Look',
    'chub.challenge.theme.oversized': 'Oversized, aber elegant',
    'chub.challenge.theme.workwear': 'Workwear abseits der Baustelle',
    'chub.challenge.theme.y2k': 'Y2K ohne Kostüm',
    'chub.challenge.theme.capsule': 'Eine 3-teilige Capsule, die sich verkauft',

    /* ── Tabs ── */
    'chub.tab.lounge': 'Lounge',
    'chub.tab.feedback': 'Feedback',
    'chub.tab.collabs': 'Collabs',
    'chub.tab.designers': 'Designer',
    'chub.tab.live': 'LIVE',

    /* ── Local fallback notice ── */
    'chub.local.note': 'Geteilter Modus ist aus — die Community läuft pro Browser, bis die Supabase-Migration (supabase/community.sql) eingespielt ist.',

    /* ── Lounge ── */
    'chub.ch.general': 'allgemein',
    'chub.ch.feedback': 'feedback',
    'chub.ch.production': 'produktion',
    'chub.ch.collabs': 'collabs',
    'chub.ch.drops': 'drops',
    'chub.chd.general': 'Vorstellen & woran du gerade arbeitest',
    'chub.chd.feedback': 'Schnelle Meinungen zu Work-in-Progress',
    'chub.chd.production': 'Hersteller, QC, Sourcing-Hilfe',
    'chub.chd.collabs': 'Partner finden, Drops teilen',
    'chub.chd.drops': 'Launches ankündigen und feiern',
    'chub.lounge.online': '{n} online',
    'chub.lounge.placeholder': 'Nachricht an #{channel} — frag einfach…',
    'chub.lounge.send': 'Senden',
    'chub.lounge.empty.title': 'Hier ist es still',
    'chub.lounge.empty.body': 'Sei der Erste — stell eine Frage oder zeig, woran du baust.',
    'chub.lounge.today': 'Heute',
    'chub.lounge.yesterday': 'Gestern',
    'chub.lounge.you': 'Du',

    /* ── Boards: shared ── */
    'chub.votes.title': 'Hilfreich — upvoten',
    'chub.replies.zero': 'Antworten',
    'chub.replies.one': '1 Antwort',
    'chub.replies.many': '{n} Antworten',
    'chub.reply.placeholder': 'Schreib eine hilfreiche Antwort…',
    'chub.reply.send': 'Antworten',

    /* ── Feedback board ── */
    'chub.fb.head': 'Design-Feedback',
    'chub.fb.sub': 'Poste ein Teil, stell eine präzise Frage, bekomm ehrliche Meinungen anderer Marken.',
    'chub.fb.cta': 'Feedback holen',
    'chub.fb.empty': 'Noch keine Feedback-Posts — deiner könnte der erste sein.',

    /* ── Collab board ── */
    'chub.co.head': 'Collab-Board',
    'chub.co.sub': 'Suche oder biete: Produktionskapazität, Fotografie, Design-Hilfe, geteilte Drops.',
    'chub.co.cta': 'Anzeige erstellen',
    'chub.co.reply': 'Im Chat antworten',
    'chub.co.empty': 'Noch keine Anzeigen — erstell die erste.',

    /* ── Tags ── */
    'chub.tag.seeking': 'SUCHE',
    'chub.tag.offering': 'BIETE',
    'chub.tag.collab-drop': 'Collab-Drop',
    'chub.tag.manufacturer': 'Hersteller',
    'chub.tag.photography': 'Fotografie',
    'chub.tag.print': 'Druck',
    'chub.tag.design-help': 'Design-Hilfe',
    'chub.tag.other': 'Sonstiges',
    'chub.tag.challenge': 'Challenge',

    /* ── Post dialog ── */
    'chub.dlg.fb.title': 'Hol dir Feedback aus der Community',
    'chub.dlg.co.title': 'Collab-Anzeige erstellen',
    'chub.dlg.title.label': 'Titel',
    'chub.dlg.title.ph.fb': 'Eine präzise Frage — „Ist der Ausschnitt zu weit?“',
    'chub.dlg.title.ph.co': '„Suche: Lookbook-Fotograf in Berlin“',
    'chub.dlg.body.label': 'Details',
    'chub.dlg.body.ph': 'Kontext, Rahmenbedingungen, was du schon probiert hast…',
    'chub.dlg.image.label': 'Design anhängen (optional)',
    'chub.dlg.image.none': 'Noch keine Designs — generiere zuerst eins im KI-Designer.',
    'chub.dlg.mode.label': 'Ich…',
    'chub.dlg.topic.label': 'Thema',
    'chub.dlg.cancel': 'Abbrechen',
    'chub.dlg.post': 'Posten',
    'chub.dlg.posting': 'Wird gepostet…',
    'chub.dlg.challenge.note': 'Challenge-Beitrag — bringt {n} Coins beim Posten.',
    'chub.dlg.close': 'Schließen',

    /* ── Toasts ── */
    'chub.toast.posted': 'In der Community gepostet',
    'chub.toast.challenge': '+{n} Coins — Challenge-Beitrag eingereicht!',
    'chub.toast.fail': 'Hat nicht geklappt — versuch es nochmal.',

    /* ── Relative time ── */
    'chub.time.now': 'jetzt',
    'chub.time.min': '{n} Min.',
    'chub.time.h': '{n} Std.',
    'chub.time.d': '{n} T.',

    /* ── Designer showcase (retained) ── */
    'community.designers.head': 'Top-Designer',
    'community.designers.sub': 'Verifizierte Macher mit den beliebtesten Arbeiten dieses Monats.',
    'community.designer.verified': 'Verifizierter Designer',
    'community.designer.followers': 'Follower',
    'community.designer.projects': 'Projekte',
    'community.thumb.title': '{kind}-Projekt',
    'community.designer.following': 'Folgt',
    'community.designer.follow': 'Folgen',
    'community.designer.unfollowTitle': '{name} nicht mehr folgen',
    'community.designer.followTitle': '{name} folgen',
    'community.designer.hire': 'Beauftragen',
    'community.designer.copied': 'Kopiert',
    'community.designer.hireTitle': 'Auftrags-Link für {name} kopieren',
    'community.designer.hireTitleCopied': 'Auftrags-Link für {name} kopiert — erneut kopieren',
    'community.toast.following': 'Du folgst {name}',
    'community.toast.unfollowed': 'Du folgst {name} nicht mehr',
    'community.toast.hireCopied': 'Auftrags-Link für {name} in die Zwischenablage kopiert',
    'community.toast.hireFail': 'Auftrags-Link konnte nicht kopiert werden — Zwischenablage ist blockiert',
    'community.hire.subject': 'Projektanfrage — {name}',
    'community.hire.member': 'Ein Mitglied von loom studios',
    'community.hire.body':
      'Hallo {name},\n\n{from} würde gerne ein {category}-Projekt mit dir besprechen. Bist du offen für neue Aufträge?\n\nGesendet über loom studios Community.',
    'community.cat.Streetwear': 'Streetwear',
    'community.cat.Outerwear': 'Oberbekleidung',
    'community.cat.Denim': 'Denim',
    'community.cat.Techwear': 'Techwear',
    'community.cat.Knitwear': 'Strickwaren',
    'community.cat.Vintage': 'Vintage',
  },
}
