import type { LocaleBundle } from '../types'

// Translations for the "settings" area. Keep en + de keys in sync.
export const settings: LocaleBundle = {
  en: {
    /* -- Page shell -- */
    'settings.title': 'Settings',
    'settings.subtitle':
      'Manage your profile, brand, plan, team and integrations across the loom studios workspace.',
    'settings.documentation': 'Documentation',
    'settings.save': 'Save changes',
    'settings.save.title.dirty': 'Save your profile changes',
    'settings.save.title.clean': 'No unsaved changes',

    /* -- Sub-nav -- */
    'settings.nav.aria': 'Settings sections',
    'settings.nav.account': 'Account',
    'settings.nav.profile': 'Profile',
    'settings.nav.workspace': 'Workspace',
    'settings.nav.brand': 'Brand Kit',
    'settings.nav.billing': 'Billing',
    'settings.nav.team': 'Team',
    'settings.nav.integrations': 'Integrations',
    'settings.nav.ai': 'AI',

    /* -- Common -- */
    'settings.common.cancel': 'Cancel',

    /* -- Profile -- */
    'settings.profile.title': 'Profile',
    'settings.profile.desc': 'This information appears on tech packs, invites and factory intros.',
    'settings.profile.verified': 'Verified',
    'settings.profile.exportData': 'Export data',
    'settings.profile.avatarAlt': 'Your avatar',
    'settings.profile.yourName': 'Your name',
    'settings.profile.avatarHint': 'PNG or JPG, up to 4MB. 512×512 recommended.',
    'settings.profile.upload': 'Upload',
    'settings.profile.remove': 'Remove',
    'settings.profile.fullName': 'Full name',
    'settings.profile.email': 'Email address',
    'settings.profile.company': 'Company',
    'settings.profile.companyPlaceholder': 'Brand name',
    'settings.profile.handle': 'Brand handle',
    'settings.profile.handleAvailable': 'Available',
    'settings.profile.handlePlaceholder': 'handle',
    'settings.profile.bio': 'Studio bio',
    'settings.profile.optional': 'Optional',
    'settings.profile.bioPlaceholder': 'Tell factories about your brand',
    'settings.profile.bioHint': 'Shown on your public marketplace profile and factory intros.',
    'settings.profile.nameRequired': 'Enter your full name before saving.',
    'settings.profile.emailInvalid': 'Enter a valid email address.',
    'settings.profile.emailClash': 'That email is already used by another account.',
    'settings.profile.storageUnavailable': 'Could not save — browser storage is unavailable.',
    'settings.profile.saved': 'Profile saved',
    'settings.profile.reverted': 'Reverted to your last saved profile',
    'settings.profile.avatarType': 'Choose a PNG or JPG image.',
    'settings.profile.avatarTooBig': 'Image is over 4MB — choose a smaller file.',
    'settings.profile.avatarUpdated': 'Avatar updated',
    'settings.profile.avatarReadError': 'Could not read that image — try another file.',
    'settings.profile.avatarNone': 'No avatar image to remove.',
    'settings.profile.avatarRemoved': 'Avatar removed — using your initials.',
    'settings.profile.exported': 'Account data exported',

    /* -- Workspace -- */
    'settings.workspace.title': 'Workspace',
    'settings.workspace.desc': 'Name, data region and defaults for everyone in {name}.',
    'settings.workspace.thisWorkspace': 'this workspace',
    'settings.workspace.active': 'Active',
    'settings.workspace.name': 'Workspace name',
    'settings.workspace.region': 'Data region',
    'settings.workspace.regionHint': 'Where your designs, tech packs and orders are stored.',
    'settings.workspace.regionSet': 'Data region set to {region}',

    /* -- Data regions -- */
    'settings.region.eu': 'Europe (EU)',
    'settings.region.uk': 'United Kingdom',
    'settings.region.us': 'North America',
    'settings.region.apac': 'Asia-Pacific',

    /* -- Danger zone -- */
    'settings.danger.title': 'Danger zone',
    'settings.danger.desc': 'Irreversible and destructive actions.',
    'settings.danger.transferTitle': 'Transfer ownership',
    'settings.danger.transferDesc':
      'Move this workspace to another team member. The change is recorded in this workspace — no emails are sent.',
    'settings.danger.newOwnerAria': 'New workspace owner',
    'settings.danger.chooseMember': 'Choose a member…',
    'settings.danger.confirmTransfer': 'Confirm transfer',
    'settings.danger.transferredTitle': 'Ownership already transferred',
    'settings.danger.transfer': 'Transfer',
    'settings.danger.deleteTitle': 'Delete workspace',
    'settings.danger.deleteDesc':
      'Downloads a backup, then permanently deletes all loom studios data stored in this browser — designs, garments, tech packs, drive files and preferences — and reloads the app to a fresh state.',
    'settings.danger.deleteTypePlaceholder': 'Type “{phrase}” to confirm',
    'settings.danger.deleteTypeAria': 'Type {phrase} to confirm deletion',
    'settings.danger.deleteForever': 'Delete forever',

    /* -- Brand accent -- */
    'settings.brand.accentTitle': 'Brand accent',
    'settings.brand.accentDesc':
      'Sets the highlight color across your workspace, exports and share pages.',
    'settings.brand.accentColor': 'Accent color',
    'settings.brand.accentGroupAria': 'Brand accent color',
    'settings.brand.customColor': 'Custom color',
    'settings.brand.customColorTitle': 'Custom colors are on the Atelier plan',
    'settings.brand.accentHint': 'Lime is the loom studios default and keeps contrast AA-compliant.',
    'settings.brand.customToast': 'Custom accent colors are available on the Atelier plan.',
    'settings.accent.set': '{color} set as your brand accent',
    'settings.accent.lime': 'Lime',
    'settings.accent.indigo': 'Indigo',
    'settings.accent.emerald': 'Emerald',
    'settings.accent.amber': 'Amber',
    'settings.accent.rose': 'Rose',
    'settings.accent.slate': 'Slate',

    /* -- Notifications -- */
    'settings.notif.title': 'Notifications',
    'settings.notif.desc': 'Choose what loom studios emails and pushes to your team.',
    'settings.notif.channels': 'Email + Push',
    'settings.notif.tech.title': 'Tech pack activity',
    'settings.notif.tech.sub': 'When a tech pack finishes generating or is edited.',
    'settings.notif.factory.title': 'Manufacturer matches',
    'settings.notif.factory.sub': 'New factory matches and quote responses for your designs.',
    'settings.notif.prod.title': 'Production milestones',
    'settings.notif.prod.sub': 'Sampling, bulk start, QC and shipment status changes.',
    'settings.notif.digest.title': 'Weekly brand digest',
    'settings.notif.digest.sub': 'A Monday summary of drops, orders and community activity.',
    'settings.notif.muted': 'Muted “{title}”',
    'settings.notif.on': '“{title}” notifications on',

    /* -- Billing -- */
    'settings.billing.title': 'Plan & billing',
    'settings.billing.desc': 'Your current subscription and monthly usage.',
    'settings.billing.exportSummary': 'Export plan summary',
    'settings.billing.planName': '{plan} plan',
    'settings.billing.current': 'Current',
    'settings.billing.planDesc':
      'Unlimited designs, AI tech packs, factory matching and {n} seats — everything to run a small-batch label end to end.',
    'settings.billing.perMonth': '/ month',
    'settings.billing.coins': 'AI coins',
    'settings.billing.storage': 'Storage',
    'settings.billing.measuring': 'Measuring…',
    'settings.billing.noteFree': 'Free plan — no billing set up.',
    'settings.billing.noteConnected':
      'Billing isn’t connected yet — no card on file, no charges processed.',
    'settings.billing.downloadSummary': 'Download plan summary',
    'settings.billing.upgradeTo': 'Upgrade to {plan}',
    'settings.billing.topPlan': 'Top plan',
    'settings.billing.exportedToast': 'Plan summary exported — no charges have been processed yet.',
    'settings.billing.downloadedToast': 'Plan summary downloaded — no payment has been processed.',
    'settings.billing.upgraded': 'Upgraded to the {plan} plan',
    'settings.billing.alreadyTop': 'You are already on the top plan.',

    /* -- Team -- */
    'settings.team.title': 'Team members',
    'settings.team.seats': '{used} of {total} seats used on the {plan} plan.',
    'settings.team.inviteAria': 'Invite by email',
    'settings.team.invite': 'Invite',
    'settings.team.you': 'You',
    'settings.team.ownerTransferredTitle': 'Ownership was transferred',
    'settings.team.youOwnTitle': 'You own this workspace',
    'settings.team.ownerRoleTitle': 'Workspace owner',
    'settings.team.invitedPending': 'Invited · pending',
    'settings.team.invitedTitle': 'Invite recorded locally — awaiting backend email delivery',
    'settings.team.revokeAria': 'Revoke invite for {email}',
    'settings.team.changeRoleTitle': 'Click to change role',
    'settings.team.removeAria': 'Remove {name}',
    'settings.team.seatsFull': 'All {n} seats are in use — upgrade to add more.',
    'settings.team.inviteEmailInvalid': 'Enter a valid email address to invite.',
    'settings.team.emailOnTeam': 'That email is already on this team.',
    'settings.team.inviteRecorded':
      'Invite for {email} recorded — email delivery arrives with the backend.',
    'settings.team.inviteNeeded': 'Invite a teammate before transferring ownership.',
    'settings.team.chooseOwner': 'Choose a member to receive ownership.',
    'settings.team.transferred': '{name} is now the workspace owner — recorded in this workspace.',
    'settings.team.inviteRevoked': 'Invite for {email} revoked',
    'settings.team.memberRemoved': '{name} removed from the workspace',

    /* -- Roles -- */
    'settings.role.admin': 'Admin',
    'settings.role.designer': 'Designer',
    'settings.role.production': 'Production',
    'settings.role.owner': 'Owner',
    'settings.role.invited': 'Invited',
    'settings.role.changed': '{name} is now {role}',

    /* -- Integrations -- */
    'settings.integ.title': 'Integrations',
    'settings.integ.desc': 'Connections to outside tools are in development and are not live yet.',
    'settings.integ.comingSoon': 'Coming soon',
    'settings.integ.shopify.desc': 'Sync drops and inventory to your storefront.',
    'settings.integ.figma.desc': 'Pull artboards straight into the design studio.',
    'settings.integ.stripe.desc': 'Collect deposits and settle factory invoices.',
    'settings.integ.slack.desc': 'Post production milestones to a team channel.',
    'settings.integ.switchLabel': '{name} integration — coming soon',

    /* -- Save bar -- */
    'settings.savebar.unsaved': 'You have unsaved changes',
    'settings.savebar.discard': 'Discard',

    /* -- Documentation -- */
    'settings.doc.opening': 'Opening the loom studios documentation',

    /* -- AI provider -- */
    'settings.ai.title': 'AI Provider · Runware',
    'settings.ai.sub':
      'One key powers all of loom studios AI — graphics, garment edits and campaign photos (Nano Banana 2). Get a key at runware.ai and top up your wallet (external models need credit).',
    'settings.ai.connected': 'Connected',
    'settings.ai.notConnected': 'Not connected',
    'settings.ai.keyLabel': 'Runware API Key',
    'settings.ai.keyPlaceholder': 'Your Runware API key',
    'settings.ai.hide': 'Hide',
    'settings.ai.show': 'Show',
    'settings.ai.save': 'Save',
    'settings.ai.securityLabel': 'Security:',
    'settings.ai.securityBefore':
      ' saved obfuscated in your browser — a static app can’t truly encrypt it. For production, set ',
    'settings.ai.securityAfter':
      ' at build time instead. The key is never hardcoded, and without one loom studios AI falls back to on-device vector previews (garment & campaign photos are gated, never faked).',
    'settings.ai.savedToast': 'Runware key saved — loom studios AI images are live.',
    'settings.ai.clearedToast': 'Runware key cleared.',
  },
  de: {
    /* -- Page shell -- */
    'settings.title': 'Einstellungen',
    'settings.subtitle':
      'Verwalte dein Profil, deine Marke, deinen Plan, dein Team und Integrationen im gesamten loom studios-Workspace.',
    'settings.documentation': 'Dokumentation',
    'settings.save': 'Änderungen speichern',
    'settings.save.title.dirty': 'Profiländerungen speichern',
    'settings.save.title.clean': 'Keine ungespeicherten Änderungen',

    /* -- Sub-nav -- */
    'settings.nav.aria': 'Einstellungsbereiche',
    'settings.nav.account': 'Konto',
    'settings.nav.profile': 'Profil',
    'settings.nav.workspace': 'Workspace',
    'settings.nav.brand': 'Brand Kit',
    'settings.nav.billing': 'Abrechnung',
    'settings.nav.team': 'Team',
    'settings.nav.integrations': 'Integrationen',
    'settings.nav.ai': 'KI',

    /* -- Common -- */
    'settings.common.cancel': 'Abbrechen',

    /* -- Profile -- */
    'settings.profile.title': 'Profil',
    'settings.profile.desc': 'Diese Angaben erscheinen auf Tech Packs, Einladungen und Fabrik-Vorstellungen.',
    'settings.profile.verified': 'Verifiziert',
    'settings.profile.exportData': 'Daten exportieren',
    'settings.profile.avatarAlt': 'Dein Avatar',
    'settings.profile.yourName': 'Dein Name',
    'settings.profile.avatarHint': 'PNG oder JPG, bis zu 4 MB. 512×512 empfohlen.',
    'settings.profile.upload': 'Hochladen',
    'settings.profile.remove': 'Entfernen',
    'settings.profile.fullName': 'Vollständiger Name',
    'settings.profile.email': 'E-Mail-Adresse',
    'settings.profile.company': 'Unternehmen',
    'settings.profile.companyPlaceholder': 'Markenname',
    'settings.profile.handle': 'Marken-Handle',
    'settings.profile.handleAvailable': 'Verfügbar',
    'settings.profile.handlePlaceholder': 'handle',
    'settings.profile.bio': 'Studio-Bio',
    'settings.profile.optional': 'Optional',
    'settings.profile.bioPlaceholder': 'Erzähle Fabriken von deiner Marke',
    'settings.profile.bioHint': 'Wird auf deinem öffentlichen Marktplatz-Profil und in Fabrik-Vorstellungen angezeigt.',
    'settings.profile.nameRequired': 'Gib deinen vollständigen Namen ein, bevor du speicherst.',
    'settings.profile.emailInvalid': 'Gib eine gültige E-Mail-Adresse ein.',
    'settings.profile.emailClash': 'Diese E-Mail-Adresse wird bereits von einem anderen Konto verwendet.',
    'settings.profile.storageUnavailable': 'Speichern fehlgeschlagen — der Browser-Speicher ist nicht verfügbar.',
    'settings.profile.saved': 'Profil gespeichert',
    'settings.profile.reverted': 'Auf dein zuletzt gespeichertes Profil zurückgesetzt',
    'settings.profile.avatarType': 'Wähle ein PNG- oder JPG-Bild.',
    'settings.profile.avatarTooBig': 'Das Bild ist größer als 4 MB — wähle eine kleinere Datei.',
    'settings.profile.avatarUpdated': 'Avatar aktualisiert',
    'settings.profile.avatarReadError': 'Dieses Bild konnte nicht gelesen werden — versuche eine andere Datei.',
    'settings.profile.avatarNone': 'Kein Avatar-Bild zum Entfernen vorhanden.',
    'settings.profile.avatarRemoved': 'Avatar entfernt — deine Initialen werden verwendet.',
    'settings.profile.exported': 'Kontodaten exportiert',

    /* -- Workspace -- */
    'settings.workspace.title': 'Workspace',
    'settings.workspace.desc': 'Name, Datenregion und Standardeinstellungen für alle in {name}.',
    'settings.workspace.thisWorkspace': 'diesem Workspace',
    'settings.workspace.active': 'Aktiv',
    'settings.workspace.name': 'Workspace-Name',
    'settings.workspace.region': 'Datenregion',
    'settings.workspace.regionHint': 'Wo deine Designs, Tech Packs und Bestellungen gespeichert werden.',
    'settings.workspace.regionSet': 'Datenregion auf {region} gesetzt',

    /* -- Data regions -- */
    'settings.region.eu': 'Europa (EU)',
    'settings.region.uk': 'Vereinigtes Königreich',
    'settings.region.us': 'Nordamerika',
    'settings.region.apac': 'Asien-Pazifik',

    /* -- Danger zone -- */
    'settings.danger.title': 'Gefahrenzone',
    'settings.danger.desc': 'Unwiderrufliche und destruktive Aktionen.',
    'settings.danger.transferTitle': 'Eigentum übertragen',
    'settings.danger.transferDesc':
      'Übertrage diesen Workspace auf ein anderes Teammitglied. Die Änderung wird in diesem Workspace erfasst — es werden keine E-Mails versendet.',
    'settings.danger.newOwnerAria': 'Neuer Workspace-Inhaber',
    'settings.danger.chooseMember': 'Mitglied auswählen…',
    'settings.danger.confirmTransfer': 'Übertragung bestätigen',
    'settings.danger.transferredTitle': 'Eigentum bereits übertragen',
    'settings.danger.transfer': 'Übertragen',
    'settings.danger.deleteTitle': 'Workspace löschen',
    'settings.danger.deleteDesc':
      'Lädt ein Backup herunter und löscht dann dauerhaft alle loom studios-Daten, die in diesem Browser gespeichert sind — Designs, Kleidungsstücke, Tech Packs, Drive-Dateien und Einstellungen — und lädt die App in einen frischen Zustand neu.',
    'settings.danger.deleteTypePlaceholder': 'Gib „{phrase}“ zur Bestätigung ein',
    'settings.danger.deleteTypeAria': 'Gib {phrase} ein, um das Löschen zu bestätigen',
    'settings.danger.deleteForever': 'Endgültig löschen',

    /* -- Brand accent -- */
    'settings.brand.accentTitle': 'Markenakzent',
    'settings.brand.accentDesc':
      'Legt die Hervorhebungsfarbe in deinem Workspace, in Exporten und auf Freigabeseiten fest.',
    'settings.brand.accentColor': 'Akzentfarbe',
    'settings.brand.accentGroupAria': 'Markenakzentfarbe',
    'settings.brand.customColor': 'Eigene Farbe',
    'settings.brand.customColorTitle': 'Eigene Farben gibt es im Atelier-Plan',
    'settings.brand.accentHint': 'Limette ist der Standard von loom studios und hält den Kontrast AA-konform.',
    'settings.brand.customToast': 'Eigene Akzentfarben sind im Atelier-Plan verfügbar.',
    'settings.accent.set': '{color} als deinen Markenakzent festgelegt',
    'settings.accent.lime': 'Limette',
    'settings.accent.indigo': 'Indigo',
    'settings.accent.emerald': 'Smaragd',
    'settings.accent.amber': 'Bernstein',
    'settings.accent.rose': 'Rosé',
    'settings.accent.slate': 'Schiefer',

    /* -- Notifications -- */
    'settings.notif.title': 'Benachrichtigungen',
    'settings.notif.desc': 'Wähle, was loom studios per E-Mail und Push an dein Team sendet.',
    'settings.notif.channels': 'E-Mail + Push',
    'settings.notif.tech.title': 'Tech-Pack-Aktivität',
    'settings.notif.tech.sub': 'Wenn ein Tech Pack fertig generiert oder bearbeitet wird.',
    'settings.notif.factory.title': 'Hersteller-Treffer',
    'settings.notif.factory.sub': 'Neue Fabrik-Treffer und Angebots-Antworten für deine Designs.',
    'settings.notif.prod.title': 'Produktions-Meilensteine',
    'settings.notif.prod.sub': 'Musteranfertigung, Serienstart, QK und Änderungen des Versandstatus.',
    'settings.notif.digest.title': 'Wöchentliche Marken-Zusammenfassung',
    'settings.notif.digest.sub': 'Eine Montags-Zusammenfassung von Drops, Bestellungen und Community-Aktivität.',
    'settings.notif.muted': '„{title}“ stummgeschaltet',
    'settings.notif.on': 'Benachrichtigungen für „{title}“ aktiviert',

    /* -- Billing -- */
    'settings.billing.title': 'Plan & Abrechnung',
    'settings.billing.desc': 'Dein aktuelles Abonnement und deine monatliche Nutzung.',
    'settings.billing.exportSummary': 'Plan-Zusammenfassung exportieren',
    'settings.billing.planName': '{plan}-Plan',
    'settings.billing.current': 'Aktuell',
    'settings.billing.planDesc':
      'Unbegrenzte Designs, KI-Tech-Packs, Fabrik-Matching und {n} Plätze — alles, um ein Small-Batch-Label von A bis Z zu betreiben.',
    'settings.billing.perMonth': '/ Monat',
    'settings.billing.coins': 'KI-Coins',
    'settings.billing.storage': 'Speicher',
    'settings.billing.measuring': 'Wird gemessen…',
    'settings.billing.noteFree': 'Kostenloser Plan — keine Abrechnung eingerichtet.',
    'settings.billing.noteConnected':
      'Die Abrechnung ist noch nicht verbunden — keine Karte hinterlegt, keine Abbuchungen verarbeitet.',
    'settings.billing.downloadSummary': 'Plan-Zusammenfassung herunterladen',
    'settings.billing.upgradeTo': 'Upgrade auf {plan}',
    'settings.billing.topPlan': 'Höchster Plan',
    'settings.billing.exportedToast': 'Plan-Zusammenfassung exportiert — es wurden noch keine Abbuchungen verarbeitet.',
    'settings.billing.downloadedToast': 'Plan-Zusammenfassung heruntergeladen — es wurde keine Zahlung verarbeitet.',
    'settings.billing.upgraded': 'Upgrade auf den {plan}-Plan durchgeführt',
    'settings.billing.alreadyTop': 'Du bist bereits im höchsten Plan.',

    /* -- Team -- */
    'settings.team.title': 'Teammitglieder',
    'settings.team.seats': '{used} von {total} Plätzen im {plan}-Plan belegt.',
    'settings.team.inviteAria': 'Per E-Mail einladen',
    'settings.team.invite': 'Einladen',
    'settings.team.you': 'Du',
    'settings.team.ownerTransferredTitle': 'Eigentum wurde übertragen',
    'settings.team.youOwnTitle': 'Dir gehört dieser Workspace',
    'settings.team.ownerRoleTitle': 'Workspace-Inhaber',
    'settings.team.invitedPending': 'Eingeladen · ausstehend',
    'settings.team.invitedTitle': 'Einladung lokal erfasst — E-Mail-Zustellung folgt mit dem Backend',
    'settings.team.revokeAria': 'Einladung für {email} widerrufen',
    'settings.team.changeRoleTitle': 'Klicken, um die Rolle zu ändern',
    'settings.team.removeAria': '{name} entfernen',
    'settings.team.seatsFull': 'Alle {n} Plätze sind belegt — führe ein Upgrade durch, um mehr hinzuzufügen.',
    'settings.team.inviteEmailInvalid': 'Gib eine gültige E-Mail-Adresse zum Einladen ein.',
    'settings.team.emailOnTeam': 'Diese E-Mail-Adresse ist bereits in diesem Team.',
    'settings.team.inviteRecorded':
      'Einladung für {email} erfasst — die E-Mail-Zustellung folgt mit dem Backend.',
    'settings.team.inviteNeeded': 'Lade ein Teammitglied ein, bevor du das Eigentum überträgst.',
    'settings.team.chooseOwner': 'Wähle ein Mitglied, das das Eigentum erhalten soll.',
    'settings.team.transferred': '{name} ist jetzt Inhaber des Workspace — in diesem Workspace erfasst.',
    'settings.team.inviteRevoked': 'Einladung für {email} widerrufen',
    'settings.team.memberRemoved': '{name} aus dem Workspace entfernt',

    /* -- Roles -- */
    'settings.role.admin': 'Admin',
    'settings.role.designer': 'Designer',
    'settings.role.production': 'Produktion',
    'settings.role.owner': 'Inhaber',
    'settings.role.invited': 'Eingeladen',
    'settings.role.changed': '{name} ist jetzt {role}',

    /* -- Integrations -- */
    'settings.integ.title': 'Integrationen',
    'settings.integ.desc': 'Verbindungen zu externen Tools sind in Entwicklung und noch nicht aktiv.',
    'settings.integ.comingSoon': 'Demnächst',
    'settings.integ.shopify.desc': 'Synchronisiere Drops und Bestand mit deinem Shop.',
    'settings.integ.figma.desc': 'Hol Artboards direkt ins Design-Studio.',
    'settings.integ.stripe.desc': 'Ziehe Anzahlungen ein und begleiche Fabrik-Rechnungen.',
    'settings.integ.slack.desc': 'Poste Produktions-Meilensteine in einen Team-Kanal.',
    'settings.integ.switchLabel': '{name}-Integration — demnächst',

    /* -- Save bar -- */
    'settings.savebar.unsaved': 'Du hast ungespeicherte Änderungen',
    'settings.savebar.discard': 'Verwerfen',

    /* -- Documentation -- */
    'settings.doc.opening': 'Öffne die loom studios-Dokumentation',

    /* -- AI provider -- */
    'settings.ai.title': 'KI-Anbieter · Runware',
    'settings.ai.sub':
      'Ein Schlüssel treibt die gesamte KI von loom studios an — Grafiken, Kleidungs-Bearbeitungen und Kampagnenfotos (Nano Banana 2). Hol dir einen Schlüssel auf runware.ai und lade dein Guthaben auf (externe Modelle benötigen Guthaben).',
    'settings.ai.connected': 'Verbunden',
    'settings.ai.notConnected': 'Nicht verbunden',
    'settings.ai.keyLabel': 'Runware-API-Schlüssel',
    'settings.ai.keyPlaceholder': 'Dein Runware-API-Schlüssel',
    'settings.ai.hide': 'Verbergen',
    'settings.ai.show': 'Anzeigen',
    'settings.ai.save': 'Speichern',
    'settings.ai.securityLabel': 'Sicherheit:',
    'settings.ai.securityBefore':
      ' verschleiert in deinem Browser gespeichert — eine statische App kann ihn nicht wirklich verschlüsseln. Für die Produktion setze stattdessen ',
    'settings.ai.securityAfter':
      ' zur Build-Zeit. Der Schlüssel wird nie fest einprogrammiert, und ohne ihn greift die KI von loom studios auf geräteinterne Vektor-Vorschauen zurück (Kleidungs- & Kampagnenfotos werden gesperrt, nie gefälscht).',
    'settings.ai.savedToast': 'Runware-Schlüssel gespeichert — die KI-Bilder von loom studios sind aktiv.',
    'settings.ai.clearedToast': 'Runware-Schlüssel gelöscht.',
  },
}
