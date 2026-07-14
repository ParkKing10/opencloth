import type { LocaleBundle } from '../types'

// Translations for the "garments" area. Keep en + de keys in sync.
export const garments: LocaleBundle = {
  en: {
    // Page chrome
    'garments.eyebrow': 'Workspace',
    'garments.title': 'Garments',
    'garments.subtitle': 'Your garment collection. Open one to edit its structure, or create a new garment.',
    'garments.signInSubtitle': 'Sign in to build your garment collection.',
    'garments.create': 'Create garment',

    // Sort
    'garments.sort.newest': 'Newest',
    'garments.sort.oldest': 'Oldest',
    'garments.sort.alpha': 'Alphabetical',
    'garments.sort.favorites': 'Favorites',

    // Search + section
    'garments.searchPlaceholder': 'Search garments…',
    'garments.searchAria': 'Search garments',
    'garments.section.mine': 'My Garments',
    'garments.resultOne': '{n} result',
    'garments.resultMany': '{n} results',

    // Import button
    'garments.import.title': 'Analyze one or many Illustrator SVG / AI / PDF flats into editable garments',
    'garments.import.analyzingProgress': 'Analyzing {current}/{total}…',
    'garments.import.analyzing': 'Analyzing…',
    'garments.import.button': 'Import garments',

    // Drag & drop overlay
    'garments.drop.title': 'Drop garment flats or a folder',
    'garments.drop.subtitle': 'SVG · AI · PDF — each is analyzed into an editable garment',

    // Empty-state onboarding
    'garments.onboard.welcome': 'Welcome to loom studios Garments',
    'garments.onboard.lead': 'Every garment you create becomes fully editable.',
    'garments.onboard.itemSleeves': 'Change sleeves',
    'garments.onboard.itemPockets': 'Move pockets',
    'garments.onboard.itemCollars': 'Replace collars',
    'garments.onboard.itemCuffs': 'Resize cuffs',
    'garments.onboard.itemDetail': 'Edit every detail — powered by AI',
    'garments.onboard.cta': 'Create your first Garment',
    'garments.onboard.hint': '…or drag a folder of SVG / AI / PDF flats anywhere here to import them all.',

    // Card
    'garments.card.designTitle': 'Design this garment',
    'garments.card.designAria': 'Design {name}',
    'garments.card.favorite': 'Favorite',
    'garments.card.unfavorite': 'Unfavorite',
    'garments.card.actionsAria': 'Garment actions',
    'garments.card.regions': '{n} regions',
    'garments.card.edited': 'Edited {when}',
    'garments.card.created': 'Created {when}',

    // Origin badges
    'garments.badge.ai': 'AI',
    'garments.badge.photo': 'PHOTO',
    'garments.badge.shop': 'SHOP',
    'garments.badge.imported': 'IMPORTED',

    // Card kebab menu
    'garments.menu.design': 'Design',
    'garments.menu.editStructure': 'Edit structure',
    'garments.menu.rename': 'Rename',
    'garments.menu.duplicate': 'Duplicate',
    'garments.menu.delete': 'Delete',

    // Relative time
    'garments.time.now': 'just now',
    'garments.time.minutes': '{n}m ago',
    'garments.time.hours': '{n}h ago',
    'garments.time.days': '{n}d ago',

    // Toasts + confirms
    'garments.toast.analyzed': 'Analyzed “{name}” — {count} regions ({parts}){learned}.',
    'garments.toast.learned': ' · recognised from a similar garment',
    'garments.toast.importedNoRegions': 'Imported “{name}” — no clear regions detected, edit it in the Studio.',
    'garments.toast.importedOne': 'Imported {n} garment',
    'garments.toast.importedMany': 'Imported {n} garments',
    'garments.toast.skippedSuffix': ' · {n} skipped',
    'garments.toast.noFlats': 'No SVG / AI / PDF garment flats found in that drop.',
    'garments.toast.duplicated': 'Duplicated as “{name}”.',
    'garments.toast.duplicateFail': 'Could not duplicate this garment.',
    'garments.toast.deleted': 'Deleted “{name}”.',
    'garments.confirm.delete': 'Delete “{name}”? This removes the garment and its entire edit history. This cannot be undone.',

    // Create-garment wizard
    'garments.wizard.dialogAria': 'Create garment',
    'garments.wizard.eyebrow': 'New garment',
    'garments.wizard.closeAria': 'Close',
    'garments.wizard.step1Title': 'How would you like to start?',
    'garments.wizard.step3Title': 'Review & create',
    'garments.wizard.step2Ai': 'Describe your garment',
    'garments.wizard.step2Upload': 'Upload a garment pack',
    'garments.wizard.step2Blank': 'Choose a template',

    // Wizard — step 1 method cards
    'garments.wizard.methodAiTitle': 'AI Garment',
    'garments.wizard.methodAiDesc': 'Describe it — start from the closest editable garment.',
    'garments.wizard.methodUploadTitle': 'Upload Garment Pack',
    'garments.wizard.methodUploadDesc': 'Bring a ZIP / SVG / AI / PNG / PDF.',
    'garments.wizard.methodBlankTitle': 'Blank Garment',
    'garments.wizard.methodBlankDesc': 'Pick a clean template to build from.',

    // Wizard — step 2 AI
    'garments.wizard.aiPlaceholder': 'e.g. Oversized cropped bomber with two chest pockets',
    'garments.wizard.aiAria': 'Describe your garment',
    'garments.wizard.example.oversizedHoodie': 'Oversized hoodie',
    'garments.wizard.example.luxuryBomber': 'Luxury bomber',
    'garments.wizard.example.doubleBreastedBlazer': 'Double breasted blazer',
    'garments.wizard.example.streetwearCargos': 'Streetwear cargos',
    'garments.wizard.aiNote': 'loom studios starts you from the closest real template, named from your prompt — every region stays editable.',
    'garments.wizard.aiNoteConnected': ' OpenAI is connected for garment editing; prompt-to-garment generation is a future milestone.',
    'garments.wizard.aiNotePending': ' Prompt-to-garment generation arrives with the AI worker (a future milestone).',

    // Wizard — step 2 upload
    'garments.wizard.uploadChoose': 'Choose a file',
    'garments.wizard.uploadNoteBold1': 'SVG files are analyzed automatically',
    'garments.wizard.uploadNoteMid': ' — loom studios reads the geometry and builds editable regions (body, sleeves, collar, buttons…) with a confidence score each. Direct ',
    'garments.wizard.uploadNoteEnd': ' vector extraction and ZIP packs are coming; those start from the closest editable template for now.',

    // Wizard — step 3 review
    'garments.wizard.reviewName': 'Name',
    'garments.wizard.reviewCategory': 'Category',
    'garments.wizard.reviewRegions': 'Regions',
    'garments.wizard.reviewSource': 'Source',
    'garments.wizard.source.ai': 'AI',
    'garments.wizard.source.upload': 'Upload',
    'garments.wizard.source.blank': 'Blank',
    'garments.wizard.reviewAnalysisLabel': 'Analysis: ',
    'garments.wizard.reviewRegionsDetected': '{n} regions detected',
    'garments.wizard.reviewLowConfidence': ' · {n} low-confidence, editable in the Studio',

    // Wizard — footer
    'garments.wizard.cancel': 'Cancel',
    'garments.wizard.back': 'Back',
    'garments.wizard.analyzing': 'Analyzing…',
    'garments.wizard.continue': 'Continue',
    'garments.wizard.createBtn': 'Create garment',
    'garments.wizard.createdToast': 'Garment created — added to My Garments.',
  },
  de: {
    // Page chrome
    'garments.eyebrow': 'Arbeitsbereich',
    'garments.title': 'Kleidungsstücke',
    'garments.subtitle': 'Deine Kleidungssammlung. Öffne ein Stück, um seine Struktur zu bearbeiten, oder erstelle ein neues Kleidungsstück.',
    'garments.signInSubtitle': 'Melde dich an, um deine Kleidungssammlung aufzubauen.',
    'garments.create': 'Kleidungsstück erstellen',

    // Sort
    'garments.sort.newest': 'Neueste',
    'garments.sort.oldest': 'Älteste',
    'garments.sort.alpha': 'Alphabetisch',
    'garments.sort.favorites': 'Favoriten',

    // Search + section
    'garments.searchPlaceholder': 'Kleidungsstücke suchen…',
    'garments.searchAria': 'Kleidungsstücke suchen',
    'garments.section.mine': 'Meine Kleidungsstücke',
    'garments.resultOne': '{n} Ergebnis',
    'garments.resultMany': '{n} Ergebnisse',

    // Import button
    'garments.import.title': 'Analysiere eine oder viele Illustrator-SVG-/AI-/PDF-Flats zu bearbeitbaren Kleidungsstücken',
    'garments.import.analyzingProgress': 'Analysiere {current}/{total}…',
    'garments.import.analyzing': 'Analysiere…',
    'garments.import.button': 'Kleidungsstücke importieren',

    // Drag & drop overlay
    'garments.drop.title': 'Kleidungs-Flats oder einen Ordner ablegen',
    'garments.drop.subtitle': 'SVG · AI · PDF — jede Datei wird zu einem bearbeitbaren Kleidungsstück analysiert',

    // Empty-state onboarding
    'garments.onboard.welcome': 'Willkommen bei den Kleidungsstücken von loom studios',
    'garments.onboard.lead': 'Jedes Kleidungsstück, das du erstellst, wird vollständig bearbeitbar.',
    'garments.onboard.itemSleeves': 'Ärmel ändern',
    'garments.onboard.itemPockets': 'Taschen verschieben',
    'garments.onboard.itemCollars': 'Kragen ersetzen',
    'garments.onboard.itemCuffs': 'Bündchen anpassen',
    'garments.onboard.itemDetail': 'Jedes Detail bearbeiten — mit KI',
    'garments.onboard.cta': 'Erstelle dein erstes Kleidungsstück',
    'garments.onboard.hint': '…oder ziehe einen Ordner mit SVG-/AI-/PDF-Flats irgendwohin hierher, um alle zu importieren.',

    // Card
    'garments.card.designTitle': 'Dieses Kleidungsstück gestalten',
    'garments.card.designAria': '{name} gestalten',
    'garments.card.favorite': 'Zu Favoriten hinzufügen',
    'garments.card.unfavorite': 'Aus Favoriten entfernen',
    'garments.card.actionsAria': 'Kleidungsstück-Aktionen',
    'garments.card.regions': '{n} Regionen',
    'garments.card.edited': 'Bearbeitet {when}',
    'garments.card.created': 'Erstellt {when}',

    // Origin badges
    'garments.badge.ai': 'KI',
    'garments.badge.photo': 'FOTO',
    'garments.badge.shop': 'SHOP',
    'garments.badge.imported': 'IMPORTIERT',

    // Card kebab menu
    'garments.menu.design': 'Gestalten',
    'garments.menu.editStructure': 'Struktur bearbeiten',
    'garments.menu.rename': 'Umbenennen',
    'garments.menu.duplicate': 'Duplizieren',
    'garments.menu.delete': 'Löschen',

    // Relative time
    'garments.time.now': 'gerade eben',
    'garments.time.minutes': 'vor {n} Min.',
    'garments.time.hours': 'vor {n} Std.',
    'garments.time.days': 'vor {n} Tagen',

    // Toasts + confirms
    'garments.toast.analyzed': '„{name}“ analysiert — {count} Regionen ({parts}){learned}.',
    'garments.toast.learned': ' · anhand eines ähnlichen Kleidungsstücks erkannt',
    'garments.toast.importedNoRegions': '„{name}“ importiert — keine eindeutigen Regionen erkannt, bearbeite es im Studio.',
    'garments.toast.importedOne': '{n} Kleidungsstück importiert',
    'garments.toast.importedMany': '{n} Kleidungsstücke importiert',
    'garments.toast.skippedSuffix': ' · {n} übersprungen',
    'garments.toast.noFlats': 'In diesem Drop wurden keine SVG-/AI-/PDF-Kleidungs-Flats gefunden.',
    'garments.toast.duplicated': 'Als „{name}“ dupliziert.',
    'garments.toast.duplicateFail': 'Dieses Kleidungsstück konnte nicht dupliziert werden.',
    'garments.toast.deleted': '„{name}“ gelöscht.',
    'garments.confirm.delete': '„{name}“ löschen? Damit werden das Kleidungsstück und sein gesamter Bearbeitungsverlauf entfernt. Dies kann nicht rückgängig gemacht werden.',

    // Create-garment wizard
    'garments.wizard.dialogAria': 'Kleidungsstück erstellen',
    'garments.wizard.eyebrow': 'Neues Kleidungsstück',
    'garments.wizard.closeAria': 'Schließen',
    'garments.wizard.step1Title': 'Wie möchtest du starten?',
    'garments.wizard.step3Title': 'Prüfen & erstellen',
    'garments.wizard.step2Ai': 'Beschreibe dein Kleidungsstück',
    'garments.wizard.step2Upload': 'Kleidungspaket hochladen',
    'garments.wizard.step2Blank': 'Vorlage auswählen',

    // Wizard — step 1 method cards
    'garments.wizard.methodAiTitle': 'KI-Kleidungsstück',
    'garments.wizard.methodAiDesc': 'Beschreibe es — starte vom nächstgelegenen bearbeitbaren Kleidungsstück.',
    'garments.wizard.methodUploadTitle': 'Kleidungspaket hochladen',
    'garments.wizard.methodUploadDesc': 'Bringe eine ZIP-/SVG-/AI-/PNG-/PDF-Datei mit.',
    'garments.wizard.methodBlankTitle': 'Leeres Kleidungsstück',
    'garments.wizard.methodBlankDesc': 'Wähle eine saubere Vorlage als Ausgangspunkt.',

    // Wizard — step 2 AI
    'garments.wizard.aiPlaceholder': 'z. B. Oversized-Cropped-Bomber mit zwei Brusttaschen',
    'garments.wizard.aiAria': 'Beschreibe dein Kleidungsstück',
    'garments.wizard.example.oversizedHoodie': 'Oversized-Hoodie',
    'garments.wizard.example.luxuryBomber': 'Luxus-Bomber',
    'garments.wizard.example.doubleBreastedBlazer': 'Zweireihiger Blazer',
    'garments.wizard.example.streetwearCargos': 'Streetwear-Cargos',
    'garments.wizard.aiNote': 'loom studios startet dich von der nächstgelegenen echten Vorlage, benannt nach deinem Prompt — jede Region bleibt bearbeitbar.',
    'garments.wizard.aiNoteConnected': ' OpenAI ist für die Kleidungsbearbeitung verbunden; die Prompt-zu-Kleidungsstück-Generierung ist ein zukünftiger Meilenstein.',
    'garments.wizard.aiNotePending': ' Die Prompt-zu-Kleidungsstück-Generierung kommt mit dem KI-Worker (ein zukünftiger Meilenstein).',

    // Wizard — step 2 upload
    'garments.wizard.uploadChoose': 'Datei auswählen',
    'garments.wizard.uploadNoteBold1': 'SVG-Dateien werden automatisch analysiert',
    'garments.wizard.uploadNoteMid': ' — loom studios liest die Geometrie und erstellt bearbeitbare Regionen (Körper, Ärmel, Kragen, Knöpfe…) mit jeweils einem Konfidenzwert. Direkte ',
    'garments.wizard.uploadNoteEnd': ' Vektor-Extraktion und ZIP-Pakete kommen bald; diese starten vorerst von der nächstgelegenen bearbeitbaren Vorlage.',

    // Wizard — step 3 review
    'garments.wizard.reviewName': 'Name',
    'garments.wizard.reviewCategory': 'Kategorie',
    'garments.wizard.reviewRegions': 'Regionen',
    'garments.wizard.reviewSource': 'Quelle',
    'garments.wizard.source.ai': 'KI',
    'garments.wizard.source.upload': 'Hochladen',
    'garments.wizard.source.blank': 'Leer',
    'garments.wizard.reviewAnalysisLabel': 'Analyse: ',
    'garments.wizard.reviewRegionsDetected': '{n} Regionen erkannt',
    'garments.wizard.reviewLowConfidence': ' · {n} mit geringer Konfidenz, im Studio bearbeitbar',

    // Wizard — footer
    'garments.wizard.cancel': 'Abbrechen',
    'garments.wizard.back': 'Zurück',
    'garments.wizard.analyzing': 'Analysiere…',
    'garments.wizard.continue': 'Weiter',
    'garments.wizard.createBtn': 'Kleidungsstück erstellen',
    'garments.wizard.createdToast': 'Kleidungsstück erstellt — zu Meine Kleidungsstücke hinzugefügt.',
  },
}
