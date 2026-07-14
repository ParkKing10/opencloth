import type { LocaleBundle } from '../types'

// Translations for the "dsAi" area (Design Studio AI modal + command palette). Keep en + de keys in sync.
export const dsAi: LocaleBundle = {
  en: {
    // Command palette
    'dsAi.cmdp.ariaLabel': 'Command palette',
    'dsAi.cmdp.searchPlaceholder': 'Search actions…',
    'dsAi.cmdp.searchAria': 'Search actions',
    'dsAi.cmdp.noMatch': 'No matching action.',

    // Graphic follow-up chips
    'dsAi.sug.chrome': 'Make it chrome',
    'dsAi.sug.neonGlow': 'Neon glow',
    'dsAi.sug.vintageWash': 'Vintage wash',
    'dsAi.sug.gothic': 'Gothic',
    'dsAi.sug.gold': 'Gold',
    'dsAi.sug.graffiti': 'Graffiti',
    'dsAi.sug.moreAggressive': 'More aggressive',
    'dsAi.sug.cleaner': 'Cleaner',
    'dsAi.sug.moreLuxurious': 'More luxurious',

    // Create-garment chips
    'dsAi.csug.streetwear': 'Streetwear',
    'dsAi.csug.luxury': 'Luxury',
    'dsAi.csug.oversized': 'Oversized',
    'dsAi.csug.techwear': 'Techwear',
    'dsAi.csug.vintageWash': 'Vintage wash',
    'dsAi.csug.minimal': 'Minimal',
    'dsAi.csug.addHood': 'Add a hood',
    'dsAi.csug.cargoPockets': 'Cargo pockets',

    // Garment-edit chips
    'dsAi.gsug.distressed': 'Distressed',
    'dsAi.gsug.addHoles': 'Add holes',
    'dsAi.gsug.acidWash': 'Acid wash',
    'dsAi.gsug.bleached': 'Bleached',
    'dsAi.gsug.vintageFaded': 'Vintage faded',
    'dsAi.gsug.oversized': 'Oversized',
    'dsAi.gsug.cropped': 'Cropped',
    'dsAi.gsug.patchwork': 'Patchwork',

    // Toasts / status messages
    'dsAi.toast.garmentNeedsModel': 'Editing the garment needs a real image model. Add your Runware API key in Settings → AI.',
    'dsAi.toast.cannotRenderGarment': 'Could not render the garment to edit — open a garment first.',
    'dsAi.toast.garmentEditFailed': 'Garment edit failed.',
    'dsAi.toast.createNeedsModel': 'Creating a garment needs a real image model. Add your Runware API key in Settings → AI.',
    'dsAi.toast.garmentCreationFailed': 'Garment creation failed.',
    'dsAi.toast.timeout': 'Runware took too long to respond. Try again in a moment.',
    'dsAi.toast.genFailed': 'Image generation failed — showing vector previews instead.',
    'dsAi.toast.regenFailed': 'Could not regenerate that one.',
    'dsAi.toast.downloadedSvg': 'Concept downloaded as SVG.',
    'dsAi.toast.downloadedPng': 'Concept downloaded as PNG.',
    'dsAi.toast.useImageFiles': 'Please use image files as a reference.',
    'dsAi.toast.maxReferences': 'You can attach up to 3 reference images.',
    'dsAi.toast.addedSome': 'Added {n} — 3 references is the max.',

    // Engine note (footer)
    'dsAi.note.garmentLive': 'Editing your garment with Runware · Nano Banana 2 — the same piece, transformed. Upload examples to steer the look, then apply one to update the design.',
    'dsAi.note.garmentDead': 'Garment editing needs a real image model. Add your Runware API key in Settings → AI — loom studios won’t fake it.',
    'dsAi.note.createLive': 'Creating a brand-new garment with Runware · Nano Banana 2 — no base needed. Upload style references to steer the look, then apply it to start designing on top.',
    'dsAi.note.createDead': 'Creating a garment needs a real image model. Add your Runware API key in Settings → AI — loom studios won’t fake it.',
    'dsAi.note.graphicLive': 'Generating with Runware · Nano Banana 2. Upload a reference image to guide the look.',
    'dsAi.note.graphicDead': 'On-device vector previews. Add your Runware API key in Settings → AI to generate photoreal images — same workflow.',

    // Drag-and-drop overlay
    'dsAi.drop.example': 'Drop to add an example',
    'dsAi.drop.styleRef': 'Drop to add a style reference',
    'dsAi.drop.reference': 'Drop to add a reference',
    'dsAi.dropSub.garment': 'Up to 3 images guide the garment edit',
    'dsAi.dropSub.create': 'Up to 3 images guide the new garment',
    'dsAi.dropSub.graphic': 'Up to 3 images guide the look',

    // Header
    'dsAi.back.title': 'Back — choose Graphic or Edit Garment',
    'dsAi.back.aria': 'Back to chooser',
    'dsAi.modes.aria': 'AI mode',
    'dsAi.mode.graphic': 'Graphic',
    'dsAi.mode.create': 'Create',
    'dsAi.mode.edit': 'Edit',
    'dsAi.close': 'Close',

    // Chooser
    'dsAi.chooser.title': 'What do you want to create?',
    'dsAi.chooser.sub': 'loom studios AI works two ways — pick one to begin.',
    'dsAi.choice.graphicTitle': 'Design a Graphic',
    'dsAi.choice.graphicDesc': 'Artwork, logos & prints to place on your garment — generated on a clean transparent background, ready to drop onto the canvas.',
    'dsAi.choice.graphicGo': 'Start designing →',
    'dsAi.choice.needsKeyBadge': 'Needs Runware key',
    'dsAi.choice.createTitle': 'Create a Garment',
    'dsAi.choice.createDesc': 'No garment yet? Describe one — “oversized cargo pants”, “cropped varsity jacket” — and loom studios generates a photoreal piece to design on.',
    'dsAi.choice.createGo': 'Start creating →',
    'dsAi.choice.addKeyGo': 'Add a key in Settings → AI',
    'dsAi.choice.garmentTitle': 'Edit the Garment',
    'dsAi.choice.garmentDesc': 'Transform the actual piece — rips, holes, acid & bleach washes, distressing, colour. loom studios edits your real garment, not a graphic.',
    'dsAi.choice.garmentGo': 'Start editing →',

    // Prompt input
    'dsAi.ph.garment': 'Change the garment — “add crazy holes”, “acid wash”, “oversized fit”…',
    'dsAi.ph.create': 'Describe a garment to create — “oversized cargo pants”, “cropped varsity jacket”…',
    'dsAi.ph.graphic': 'Describe your graphic — “chrome tribal star”, “vintage skull with roses”…',
    'dsAi.promptAria': 'Design prompt',

    // Upload reference button
    'dsAi.upload.garmentTitle': 'Upload example images to guide the edit',
    'dsAi.upload.createTitle': 'Upload style references to steer the new garment',
    'dsAi.upload.graphicTitle': 'Upload a reference image to guide the result',
    'dsAi.upload.example': 'Example',
    'dsAi.upload.style': 'Style',
    'dsAi.upload.reference': 'Reference',

    'dsAi.history': 'History',
    'dsAi.generating': 'Generating…',
    'dsAi.composing': 'Composing…',
    'dsAi.generate': 'Generate',

    // Reference chips
    'dsAi.refs.examples': 'Examples',
    'dsAi.refs.styleRefs': 'Style references',
    'dsAi.refs.references': 'References',
    'dsAi.refAlt': 'Reference {n}',
    'dsAi.removeRef': 'Remove reference',

    // Empty state
    'dsAi.empty.garmentTitle': 'Edit your garment',
    'dsAi.empty.createTitle': 'Create a garment',
    'dsAi.empty.graphicTitle': 'Design a graphic',
    'dsAi.empty.garmentDesc': 'Describe the change above — “add crazy holes”, “acid wash”, “oversized fit” — and hit Generate.',
    'dsAi.empty.createDesc': 'Describe the piece above — “oversized bomber jacket”, “pleated midi skirt” — and hit Generate.',
    'dsAi.empty.graphicDesc': 'Describe your graphic above — “chrome tribal star”, “vintage skull with roses” — and hit Generate.',

    // Concept card
    'dsAi.card.generatingAria': 'Generating',
    'dsAi.ready': 'Ready',
    'dsAi.card.conceptAlt': '{prompt} concept {n}',
    'dsAi.favorite': 'Favorite',
    'dsAi.unfavorite': 'Unfavorite',
    'dsAi.zoom': 'Zoom',
    'dsAi.downloadSvg': 'Download SVG',
    'dsAi.download': 'Download',
    'dsAi.regenTitle': 'Regenerate this one',
    'dsAi.regen': 'Regenerate',
    'dsAi.card.editedGarment': 'Edited garment',
    'dsAi.card.newGarment': 'New garment',
    'dsAi.preparing': 'Preparing…',
    'dsAi.useGarment': 'Use this Garment',
    'dsAi.applyGarment': 'Apply to Garment',
    'dsAi.addToCanvas': 'Add to Canvas',

    // Keep creating / favorites / zoom
    'dsAi.keepCreating': 'Keep creating',
    'dsAi.generateMore': '↻ Generate 1 more',
    'dsAi.favorites': 'Favorites',
    'dsAi.fav.title': '{prompt} — Add to Canvas',
    'dsAi.zoomAria': 'Concept preview',
  },
  de: {
    // Command palette
    'dsAi.cmdp.ariaLabel': 'Befehlspalette',
    'dsAi.cmdp.searchPlaceholder': 'Aktionen suchen…',
    'dsAi.cmdp.searchAria': 'Aktionen suchen',
    'dsAi.cmdp.noMatch': 'Keine passende Aktion.',

    // Graphic follow-up chips
    'dsAi.sug.chrome': 'Verchromen',
    'dsAi.sug.neonGlow': 'Neon-Leuchten',
    'dsAi.sug.vintageWash': 'Vintage-Waschung',
    'dsAi.sug.gothic': 'Gothic',
    'dsAi.sug.gold': 'Gold',
    'dsAi.sug.graffiti': 'Graffiti',
    'dsAi.sug.moreAggressive': 'Aggressiver',
    'dsAi.sug.cleaner': 'Sauberer',
    'dsAi.sug.moreLuxurious': 'Luxuriöser',

    // Create-garment chips
    'dsAi.csug.streetwear': 'Streetwear',
    'dsAi.csug.luxury': 'Luxus',
    'dsAi.csug.oversized': 'Oversized',
    'dsAi.csug.techwear': 'Techwear',
    'dsAi.csug.vintageWash': 'Vintage-Waschung',
    'dsAi.csug.minimal': 'Minimalistisch',
    'dsAi.csug.addHood': 'Kapuze hinzufügen',
    'dsAi.csug.cargoPockets': 'Cargo-Taschen',

    // Garment-edit chips
    'dsAi.gsug.distressed': 'Used-Look',
    'dsAi.gsug.addHoles': 'Löcher hinzufügen',
    'dsAi.gsug.acidWash': 'Acid-Waschung',
    'dsAi.gsug.bleached': 'Gebleicht',
    'dsAi.gsug.vintageFaded': 'Vintage-verblasst',
    'dsAi.gsug.oversized': 'Oversized',
    'dsAi.gsug.cropped': 'Cropped',
    'dsAi.gsug.patchwork': 'Patchwork',

    // Toasts / status messages
    'dsAi.toast.garmentNeedsModel': 'Das Bearbeiten des Kleidungsstücks benötigt ein echtes Bildmodell. Füge deinen Runware-API-Schlüssel unter Einstellungen → AI hinzu.',
    'dsAi.toast.cannotRenderGarment': 'Das Kleidungsstück konnte nicht zum Bearbeiten gerendert werden — öffne zuerst ein Kleidungsstück.',
    'dsAi.toast.garmentEditFailed': 'Bearbeitung des Kleidungsstücks fehlgeschlagen.',
    'dsAi.toast.createNeedsModel': 'Das Erstellen eines Kleidungsstücks benötigt ein echtes Bildmodell. Füge deinen Runware-API-Schlüssel unter Einstellungen → AI hinzu.',
    'dsAi.toast.garmentCreationFailed': 'Erstellung des Kleidungsstücks fehlgeschlagen.',
    'dsAi.toast.timeout': 'Runware hat zu lange gebraucht. Versuche es gleich noch einmal.',
    'dsAi.toast.genFailed': 'Bildgenerierung fehlgeschlagen — stattdessen werden Vektor-Vorschauen angezeigt.',
    'dsAi.toast.regenFailed': 'Dieses konnte nicht neu generiert werden.',
    'dsAi.toast.downloadedSvg': 'Konzept als SVG heruntergeladen.',
    'dsAi.toast.downloadedPng': 'Konzept als PNG heruntergeladen.',
    'dsAi.toast.useImageFiles': 'Bitte verwende Bilddateien als Referenz.',
    'dsAi.toast.maxReferences': 'Du kannst bis zu 3 Referenzbilder anhängen.',
    'dsAi.toast.addedSome': '{n} hinzugefügt — maximal 3 Referenzen.',

    // Engine note (footer)
    'dsAi.note.garmentLive': 'Bearbeite dein Kleidungsstück mit Runware · Nano Banana 2 — dasselbe Teil, transformiert. Lade Beispiele hoch, um den Look zu steuern, und wende dann eines an, um das Design zu aktualisieren.',
    'dsAi.note.garmentDead': 'Das Bearbeiten von Kleidungsstücken benötigt ein echtes Bildmodell. Füge deinen Runware-API-Schlüssel unter Einstellungen → AI hinzu — loom studios täuscht es nicht vor.',
    'dsAi.note.createLive': 'Erstelle ein brandneues Kleidungsstück mit Runware · Nano Banana 2 — keine Basis nötig. Lade Stil-Referenzen hoch, um den Look zu steuern, und wende es dann an, um darauf zu gestalten.',
    'dsAi.note.createDead': 'Das Erstellen eines Kleidungsstücks benötigt ein echtes Bildmodell. Füge deinen Runware-API-Schlüssel unter Einstellungen → AI hinzu — loom studios täuscht es nicht vor.',
    'dsAi.note.graphicLive': 'Generierung mit Runware · Nano Banana 2. Lade ein Referenzbild hoch, um den Look zu steuern.',
    'dsAi.note.graphicDead': 'Vektor-Vorschauen auf dem Gerät. Füge deinen Runware-API-Schlüssel unter Einstellungen → AI hinzu, um fotorealistische Bilder zu generieren — derselbe Workflow.',

    // Drag-and-drop overlay
    'dsAi.drop.example': 'Ablegen, um ein Beispiel hinzuzufügen',
    'dsAi.drop.styleRef': 'Ablegen, um eine Stil-Referenz hinzuzufügen',
    'dsAi.drop.reference': 'Ablegen, um eine Referenz hinzuzufügen',
    'dsAi.dropSub.garment': 'Bis zu 3 Bilder steuern die Bearbeitung des Kleidungsstücks',
    'dsAi.dropSub.create': 'Bis zu 3 Bilder steuern das neue Kleidungsstück',
    'dsAi.dropSub.graphic': 'Bis zu 3 Bilder steuern den Look',

    // Header
    'dsAi.back.title': 'Zurück — Grafik oder Kleidungsstück bearbeiten wählen',
    'dsAi.back.aria': 'Zurück zur Auswahl',
    'dsAi.modes.aria': 'KI-Modus',
    'dsAi.mode.graphic': 'Grafik',
    'dsAi.mode.create': 'Erstellen',
    'dsAi.mode.edit': 'Bearbeiten',
    'dsAi.close': 'Schließen',

    // Chooser
    'dsAi.chooser.title': 'Was möchtest du erstellen?',
    'dsAi.chooser.sub': 'loom studios AI funktioniert auf zwei Arten — wähle eine, um zu beginnen.',
    'dsAi.choice.graphicTitle': 'Eine Grafik gestalten',
    'dsAi.choice.graphicDesc': 'Artworks, Logos & Prints für dein Kleidungsstück — auf sauberem transparentem Hintergrund generiert, bereit zum Ablegen auf der Leinwand.',
    'dsAi.choice.graphicGo': 'Gestaltung starten →',
    'dsAi.choice.needsKeyBadge': 'Runware-Schlüssel nötig',
    'dsAi.choice.createTitle': 'Ein Kleidungsstück erstellen',
    'dsAi.choice.createDesc': 'Noch kein Kleidungsstück? Beschreibe eins — „übergroße Cargohose“, „cropped College-Jacke“ — und loom studios generiert ein fotorealistisches Teil zum Gestalten.',
    'dsAi.choice.createGo': 'Erstellung starten →',
    'dsAi.choice.addKeyGo': 'Schlüssel unter Einstellungen → AI hinzufügen',
    'dsAi.choice.garmentTitle': 'Das Kleidungsstück bearbeiten',
    'dsAi.choice.garmentDesc': 'Verwandle das echte Teil — Risse, Löcher, Acid- & Bleichwaschungen, Used-Look, Farbe. loom studios bearbeitet dein echtes Kleidungsstück, keine Grafik.',
    'dsAi.choice.garmentGo': 'Bearbeitung starten →',

    // Prompt input
    'dsAi.ph.garment': 'Ändere das Kleidungsstück — „verrückte Löcher hinzufügen“, „Acid-Waschung“, „Oversized-Passform“…',
    'dsAi.ph.create': 'Beschreibe ein zu erstellendes Kleidungsstück — „übergroße Cargohose“, „cropped College-Jacke“…',
    'dsAi.ph.graphic': 'Beschreibe deine Grafik — „Chrom-Tribal-Stern“, „Vintage-Totenkopf mit Rosen“…',
    'dsAi.promptAria': 'Design-Prompt',

    // Upload reference button
    'dsAi.upload.garmentTitle': 'Beispielbilder hochladen, um die Bearbeitung zu steuern',
    'dsAi.upload.createTitle': 'Stil-Referenzen hochladen, um das neue Kleidungsstück zu steuern',
    'dsAi.upload.graphicTitle': 'Ein Referenzbild hochladen, um das Ergebnis zu steuern',
    'dsAi.upload.example': 'Beispiel',
    'dsAi.upload.style': 'Stil',
    'dsAi.upload.reference': 'Referenz',

    'dsAi.history': 'Verlauf',
    'dsAi.generating': 'Generiere…',
    'dsAi.composing': 'Komponiere…',
    'dsAi.generate': 'Generieren',

    // Reference chips
    'dsAi.refs.examples': 'Beispiele',
    'dsAi.refs.styleRefs': 'Stil-Referenzen',
    'dsAi.refs.references': 'Referenzen',
    'dsAi.refAlt': 'Referenz {n}',
    'dsAi.removeRef': 'Referenz entfernen',

    // Empty state
    'dsAi.empty.garmentTitle': 'Bearbeite dein Kleidungsstück',
    'dsAi.empty.createTitle': 'Erstelle ein Kleidungsstück',
    'dsAi.empty.graphicTitle': 'Gestalte eine Grafik',
    'dsAi.empty.garmentDesc': 'Beschreibe oben die Änderung — „verrückte Löcher hinzufügen“, „Acid-Waschung“, „Oversized-Passform“ — und klicke auf Generieren.',
    'dsAi.empty.createDesc': 'Beschreibe oben das Teil — „übergroße Bomberjacke“, „plissierter Midirock“ — und klicke auf Generieren.',
    'dsAi.empty.graphicDesc': 'Beschreibe oben deine Grafik — „Chrom-Tribal-Stern“, „Vintage-Totenkopf mit Rosen“ — und klicke auf Generieren.',

    // Concept card
    'dsAi.card.generatingAria': 'Generiere',
    'dsAi.ready': 'Bereit',
    'dsAi.card.conceptAlt': '{prompt} Konzept {n}',
    'dsAi.favorite': 'Favorisieren',
    'dsAi.unfavorite': 'Aus Favoriten entfernen',
    'dsAi.zoom': 'Vergrößern',
    'dsAi.downloadSvg': 'SVG herunterladen',
    'dsAi.download': 'Herunterladen',
    'dsAi.regenTitle': 'Dieses neu generieren',
    'dsAi.regen': 'Neu generieren',
    'dsAi.card.editedGarment': 'Bearbeitetes Kleidungsstück',
    'dsAi.card.newGarment': 'Neues Kleidungsstück',
    'dsAi.preparing': 'Wird vorbereitet…',
    'dsAi.useGarment': 'Dieses Kleidungsstück verwenden',
    'dsAi.applyGarment': 'Auf Kleidungsstück anwenden',
    'dsAi.addToCanvas': 'Zur Leinwand hinzufügen',

    // Keep creating / favorites / zoom
    'dsAi.keepCreating': 'Weiter gestalten',
    'dsAi.generateMore': '↻ 1 weiteres generieren',
    'dsAi.favorites': 'Favoriten',
    'dsAi.fav.title': '{prompt} — Zur Leinwand hinzufügen',
    'dsAi.zoomAria': 'Konzept-Vorschau',
  },
}
