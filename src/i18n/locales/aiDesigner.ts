import type { LocaleBundle } from '../types'

// Translations for the "aiDesigner" area. Keep en + de keys in sync.
export const aiDesigner: LocaleBundle = {
  en: {
    'aiDesigner.eyebrow': 'AI Studio',
    'aiDesigner.title': 'AI Designer',
    'aiDesigner.subtitle':
      'Describe a garment and the studio renders it for real — front and back — then puts a model in it so you see how it looks on a person. Every design saves to your AI library.',
    'aiDesigner.coinsLabel': 'coins',

    'aiDesigner.prompt': 'Prompt',
    'aiDesigner.promptHint': 'Be specific — fabric, fit, finish',
    'aiDesigner.promptPlaceholder': 'Describe the garment you want to create…',
    'aiDesigner.enhance': 'Enhance',

    'aiDesigner.refImages': 'Reference images',
    'aiDesigner.optional': 'Optional',
    'aiDesigner.refReplace': 'Replace reference image',
    'aiDesigner.refAdd': 'Add reference image',
    'aiDesigner.refAlt': 'Reference {n}',

    'aiDesigner.brandStyle': 'Brand style',
    'aiDesigner.garmentType': 'Garment type',
    'aiDesigner.howMany': 'How many designs',

    'aiDesigner.generating': 'Generating…',
    'aiDesigner.generateOne': 'Generate 1 design',
    'aiDesigner.generateMany': 'Generate {n} designs',
    'aiDesigner.needKey': 'Add a Runware key to generate',
    'aiDesigner.costsPrefix': 'Costs',
    'aiDesigner.costsCoins': '{n} coins',
    'aiDesigner.costsSuffix': '— front + back each, {cost}/design',

    'aiDesigner.library': 'Your AI library',
    'aiDesigner.designCountOne': '1 design',
    'aiDesigner.designCountMany': '{n} designs',
    'aiDesigner.renderingN': 'Rendering {n}…',

    'aiDesigner.emptyTitleLive': 'No designs yet',
    'aiDesigner.emptyTitleKey': 'Connect a Runware key',
    'aiDesigner.emptyBodyLive': 'Describe a garment on the left and generate your first design.',
    'aiDesigner.emptyBodyKey':
      'Add your Runware API key in Settings → AI — the AI Designer renders real garments, it won’t fake it.',

    'aiDesigner.promptHistory': 'Prompt history',

    'aiDesigner.close': 'Close',
    'aiDesigner.download': 'Download',
    'aiDesigner.openInStudio': 'Open in Design Studio',
    'aiDesigner.shooting': 'Shooting…',
    'aiDesigner.onModel': 'On a Model',
    'aiDesigner.delete': 'Delete',

    'aiDesigner.favorite': 'Favorite',
    'aiDesigner.unfavorite': 'Unfavorite',
    'aiDesigner.front': 'Front',
    'aiDesigner.back': 'Back',
    'aiDesigner.enlargeModel': 'Enlarge on-model photo',
    'aiDesigner.cardAlt': '{name} — {view}',
    'aiDesigner.onModelAlt': '{name} on a model {n}',

    'aiDesigner.toastPickImage': 'Please choose an image file to use as a reference.',
    'aiDesigner.toastDescribeFirst': 'Describe the garment you want before generating.',
    'aiDesigner.toastSignIn': 'Sign in to generate designs.',
    'aiDesigner.toastNeedModel': 'The AI Designer needs a real image model. Add your Runware API key in Settings → AI.',
    'aiDesigner.toastNotEnoughDesign': 'Not enough coins — each design costs {n}.',
    'aiDesigner.progressFront': 'Rendering front {i}/{n}…',
    'aiDesigner.progressBack': 'Rendering back {i}/{n}…',
    'aiDesigner.errNoFront': 'No front render returned.',
    'aiDesigner.toastGeneratedOne': 'Generated 1 design (front + back) — saved to your AI library.',
    'aiDesigner.toastGeneratedMany': 'Generated {n} designs (front + back) — saved to your AI library.',
    'aiDesigner.errGenerationFailed': 'Generation failed. Please try again.',
    'aiDesigner.toastNotEnoughModel': 'Not enough coins — an on-model photo costs {n}.',
    'aiDesigner.errNoPhoto': 'No photo returned.',
    'aiDesigner.toastPhotoAdded': 'Real-life photo added to “{name}”.',
    'aiDesigner.errNoModelPhoto': 'Could not create the on-model photo.',
    'aiDesigner.toastDownloadFail': 'Could not download that image.',
    'aiDesigner.confirmDelete': 'Delete “{name}” from your AI library?',
    'aiDesigner.toastSentToStudio': '“{name}” sent to the Design Studio.',
  },
  de: {
    'aiDesigner.eyebrow': 'KI-Studio',
    'aiDesigner.title': 'KI-Designer',
    'aiDesigner.subtitle':
      'Beschreibe ein Kleidungsstück und das Studio rendert es wirklich — Vorder- und Rückseite — und zieht es dann einem Model an, damit du siehst, wie es an einer Person aussieht. Jedes Design wird in deiner KI-Bibliothek gespeichert.',
    'aiDesigner.coinsLabel': 'Coins',

    'aiDesigner.prompt': 'Prompt',
    'aiDesigner.promptHint': 'Sei konkret — Stoff, Passform, Finish',
    'aiDesigner.promptPlaceholder': 'Beschreibe das Kleidungsstück, das du erstellen möchtest…',
    'aiDesigner.enhance': 'Verbessern',

    'aiDesigner.refImages': 'Referenzbilder',
    'aiDesigner.optional': 'Optional',
    'aiDesigner.refReplace': 'Referenzbild ersetzen',
    'aiDesigner.refAdd': 'Referenzbild hinzufügen',
    'aiDesigner.refAlt': 'Referenz {n}',

    'aiDesigner.brandStyle': 'Markenstil',
    'aiDesigner.garmentType': 'Kleidungstyp',
    'aiDesigner.howMany': 'Wie viele Designs',

    'aiDesigner.generating': 'Generiere…',
    'aiDesigner.generateOne': '1 Design generieren',
    'aiDesigner.generateMany': '{n} Designs generieren',
    'aiDesigner.needKey': 'Runware-Schlüssel hinzufügen, um zu generieren',
    'aiDesigner.costsPrefix': 'Kostet',
    'aiDesigner.costsCoins': '{n} Coins',
    'aiDesigner.costsSuffix': '— je Vorder- + Rückseite, {cost}/Design',

    'aiDesigner.library': 'Deine KI-Bibliothek',
    'aiDesigner.designCountOne': '1 Design',
    'aiDesigner.designCountMany': '{n} Designs',
    'aiDesigner.renderingN': 'Rendere {n}…',

    'aiDesigner.emptyTitleLive': 'Noch keine Designs',
    'aiDesigner.emptyTitleKey': 'Runware-Schlüssel verbinden',
    'aiDesigner.emptyBodyLive': 'Beschreibe links ein Kleidungsstück und generiere dein erstes Design.',
    'aiDesigner.emptyBodyKey':
      'Füge deinen Runware-API-Schlüssel unter Einstellungen → KI hinzu — der KI-Designer rendert echte Kleidungsstücke, er täuscht nichts vor.',

    'aiDesigner.promptHistory': 'Prompt-Verlauf',

    'aiDesigner.close': 'Schließen',
    'aiDesigner.download': 'Herunterladen',
    'aiDesigner.openInStudio': 'Im Design-Studio öffnen',
    'aiDesigner.shooting': 'Fotografiere…',
    'aiDesigner.onModel': 'An einem Model',
    'aiDesigner.delete': 'Löschen',

    'aiDesigner.favorite': 'Zu Favoriten hinzufügen',
    'aiDesigner.unfavorite': 'Aus Favoriten entfernen',
    'aiDesigner.front': 'Vorne',
    'aiDesigner.back': 'Hinten',
    'aiDesigner.enlargeModel': 'Model-Foto vergrößern',
    'aiDesigner.cardAlt': '{name} — {view}',
    'aiDesigner.onModelAlt': '{name} an einem Model {n}',

    'aiDesigner.toastPickImage': 'Bitte wähle eine Bilddatei als Referenz.',
    'aiDesigner.toastDescribeFirst': 'Beschreibe das gewünschte Kleidungsstück, bevor du generierst.',
    'aiDesigner.toastSignIn': 'Melde dich an, um Designs zu generieren.',
    'aiDesigner.toastNeedModel':
      'Der KI-Designer benötigt ein echtes Bildmodell. Füge deinen Runware-API-Schlüssel unter Einstellungen → KI hinzu.',
    'aiDesigner.toastNotEnoughDesign': 'Nicht genug Coins — jedes Design kostet {n}.',
    'aiDesigner.progressFront': 'Rendere Vorderseite {i}/{n}…',
    'aiDesigner.progressBack': 'Rendere Rückseite {i}/{n}…',
    'aiDesigner.errNoFront': 'Kein Vorderseiten-Render zurückgegeben.',
    'aiDesigner.toastGeneratedOne': '1 Design generiert (Vorder- + Rückseite) — in deiner KI-Bibliothek gespeichert.',
    'aiDesigner.toastGeneratedMany': '{n} Designs generiert (Vorder- + Rückseite) — in deiner KI-Bibliothek gespeichert.',
    'aiDesigner.errGenerationFailed': 'Generierung fehlgeschlagen. Bitte versuche es erneut.',
    'aiDesigner.toastNotEnoughModel': 'Nicht genug Coins — ein Model-Foto kostet {n}.',
    'aiDesigner.errNoPhoto': 'Kein Foto zurückgegeben.',
    'aiDesigner.errNoModelPhoto': 'Model-Foto konnte nicht erstellt werden.',
    'aiDesigner.toastPhotoAdded': 'Realfoto zu „{name}“ hinzugefügt.',
    'aiDesigner.toastDownloadFail': 'Bild konnte nicht heruntergeladen werden.',
    'aiDesigner.confirmDelete': '„{name}“ aus deiner KI-Bibliothek löschen?',
    'aiDesigner.toastSentToStudio': '„{name}“ ans Design-Studio gesendet.',
  },
}
