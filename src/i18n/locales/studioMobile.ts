import type { LocaleBundle } from '../types'

/**
 * Mobile Design Studio — on phones the canvas editor is impractical, so the Studio becomes an
 * AI-first launcher: the 3-choice chooser (reusing the dsAi.* choice strings) plus a lean generation
 * sheet. These keys cover only the mobile-specific chrome; the chooser reuses dsAi.chooser / dsAi.choice.
 */
export const studioMobile: LocaleBundle = {
  en: {
    'studioMobile.eyebrow': 'loom studios AI',
    'studioMobile.deskNote': 'On a laptop you get the full canvas editor. On your phone, create with AI.',
    'studioMobile.back': 'Back',

    'studioMobile.edit.addPhoto': 'Add a photo of your garment',
    'studioMobile.edit.addPhotoHint': 'We edit this exact piece — rips, holes, acid & bleach washes, colour.',
    'studioMobile.edit.replace': 'Replace photo',
    'studioMobile.edit.needPhoto': 'Add a photo of your garment first.',

    'studioMobile.generate': 'Generate',
    'studioMobile.generating': 'Generating…',
    'studioMobile.needKey': 'Connect an image model in Settings → AI to generate real garments.',
    'studioMobile.describeFirst': 'Describe what you want first.',
    'studioMobile.failed': 'Generation failed — try again.',

    'studioMobile.results': 'Results',
    'studioMobile.empty': 'Type an idea and tap Generate — your results appear here.',

    'studioMobile.download': 'Download',
    'studioMobile.saveGarment': 'Save as garment',
    'studioMobile.savedShort': 'Saved ✓',
    'studioMobile.savedGarment': 'Saved “{name}” to your garments',
    'studioMobile.savedAsset': 'Saved to your Asset Library',
    'studioMobile.readyGraphic': 'Graphic ready — saved to your library',
    'studioMobile.readyGarment': 'Garment ready',
    'studioMobile.newGarment': 'New garment',
    'studioMobile.downloadFail': 'Could not download that image.',
  },
  de: {
    'studioMobile.eyebrow': 'loom studios AI',
    'studioMobile.deskNote': 'Auf dem Laptop bekommst du den vollen Canvas-Editor. Auf dem Handy erstellst du mit KI.',
    'studioMobile.back': 'Zurück',

    'studioMobile.edit.addPhoto': 'Foto deines Kleidungsstücks hinzufügen',
    'studioMobile.edit.addPhotoHint': 'Wir bearbeiten genau dieses Teil — Risse, Löcher, Acid- & Bleichwaschungen, Farbe.',
    'studioMobile.edit.replace': 'Foto ersetzen',
    'studioMobile.edit.needPhoto': 'Füge zuerst ein Foto deines Kleidungsstücks hinzu.',

    'studioMobile.generate': 'Generieren',
    'studioMobile.generating': 'Generiere…',
    'studioMobile.needKey': 'Verbinde ein Bildmodell unter Einstellungen → AI, um echte Kleidungsstücke zu generieren.',
    'studioMobile.describeFirst': 'Beschreibe zuerst, was du möchtest.',
    'studioMobile.failed': 'Generierung fehlgeschlagen — versuch es nochmal.',

    'studioMobile.results': 'Ergebnisse',
    'studioMobile.empty': 'Beschreibe eine Idee und tippe auf Generieren — deine Ergebnisse erscheinen hier.',

    'studioMobile.download': 'Herunterladen',
    'studioMobile.saveGarment': 'Als Kleidungsstück speichern',
    'studioMobile.savedShort': 'Gespeichert ✓',
    'studioMobile.savedGarment': '„{name}“ zu deinen Kleidungsstücken gespeichert',
    'studioMobile.savedAsset': 'In deiner Asset-Bibliothek gespeichert',
    'studioMobile.readyGraphic': 'Grafik fertig — in deiner Bibliothek gespeichert',
    'studioMobile.readyGarment': 'Kleidungsstück fertig',
    'studioMobile.newGarment': 'Neues Kleidungsstück',
    'studioMobile.downloadFail': 'Bild konnte nicht heruntergeladen werden.',
  },
}
