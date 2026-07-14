import type { LocaleBundle } from '../types'

// Translations for the "techPacks" area. Keep en + de keys in sync.
export const techPacks: LocaleBundle = {
  en: {
    // Page header
    'techPacks.eyebrow': 'Library',
    'techPacks.title': 'Tech Packs',
    'techPacks.subtitle':
      'Production-ready specs for every garment — preview, status, matched manufacturer and PDF export.',
    'techPacks.new': 'New Tech Pack',

    // Status labels
    'techPacks.status.ready': 'Ready',
    'techPacks.status.in_review': 'In Review',
    'techPacks.status.draft': 'Draft',

    // Filters
    'techPacks.filter.all': 'All',
    'techPacks.filterAria': 'Filter tech packs',

    // Summary
    'techPacks.summary.aria': 'Tech pack summary',
    'techPacks.summary.total': 'Total packs',
    'techPacks.summary.ready': 'Ready to produce',
    'techPacks.summary.inReview': 'In review',
    'techPacks.summary.drafts': 'Drafts',

    // Toolbar
    'techPacks.search.placeholder': 'Search packs, styles, factories…',
    'techPacks.search.aria': 'Search tech packs',
    'techPacks.export.title': 'Export the visible tech packs as a CSV file',
    'techPacks.export.label': 'Export list',
    'techPacks.view.aria': 'View mode',
    'techPacks.view.grid': 'Grid view',
    'techPacks.view.list': 'List view',

    // Card / row
    'techPacks.download': 'Download PDF',
    'techPacks.download.draftTitle': 'Finish the draft to export a PDF',
    'techPacks.download.title': 'Download the tech pack PDF',
    'techPacks.moreOptions': 'More options',
    'techPacks.closeMenu': 'Close menu',
    'techPacks.delete': 'Delete tech pack',
    'techPacks.matchedManufacturer': 'Matched manufacturer',
    'techPacks.noManufacturer': 'No manufacturer yet',
    'techPacks.matchFactory': 'Match a factory to produce',
    'techPacks.updated': 'Updated {time}',
    'techPacks.pages': '{n} pages',

    // List columns
    'techPacks.col.techPack': 'Tech pack',
    'techPacks.col.status': 'Status',
    'techPacks.col.manufacturer': 'Manufacturer',
    'techPacks.col.updated': 'Updated',

    // Empty states
    'techPacks.empty.foundTitle': 'No tech packs found',
    'techPacks.empty.foundBody': 'Try a different search term or filter.',
    'techPacks.empty.clear': 'Clear filters',
    'techPacks.empty.title': 'No tech packs yet',
    'techPacks.empty.body':
      'Create your first spec sheet — status, pages and a matched manufacturer, all in one place.',

    // Toasts
    'techPacks.toast.signIn': 'Sign in to create a tech pack.',
    'techPacks.toast.created': 'New draft tech pack created.',
    'techPacks.toast.finishDraft': 'Finish this draft before exporting a PDF.',
    'techPacks.toast.downloaded': '“{name}” PDF downloaded.',
    'techPacks.toast.pdfError': 'Could not generate the PDF. Please try again.',
    'techPacks.toast.nothingExport': 'Nothing to export in the current view.',
    'techPacks.toast.exportedOne': 'Exported {n} tech pack to CSV.',
    'techPacks.toast.exportedMany': 'Exported {n} tech packs to CSV.',
    'techPacks.toast.exportError': 'Could not export the list. Please try again.',
    'techPacks.toast.deleted': '“{name}” deleted.',

    // Default names for newly created packs
    'techPacks.newName.hoodie': 'Untitled Hoodie',
    'techPacks.newName.tee': 'Untitled Tee',
    'techPacks.newName.jacket': 'Untitled Jacket',
    'techPacks.newName.pants': 'Untitled Pants',
    'techPacks.newName.cap': 'Untitled Cap',
  },
  de: {
    // Page header
    'techPacks.eyebrow': 'Bibliothek',
    'techPacks.title': 'Tech Packs',
    'techPacks.subtitle':
      'Produktionsreife Spezifikationen für jedes Kleidungsstück – Vorschau, Status, zugeordneter Hersteller und PDF-Export.',
    'techPacks.new': 'Neues Tech Pack',

    // Status labels
    'techPacks.status.ready': 'Bereit',
    'techPacks.status.in_review': 'In Prüfung',
    'techPacks.status.draft': 'Entwurf',

    // Filters
    'techPacks.filter.all': 'Alle',
    'techPacks.filterAria': 'Tech Packs filtern',

    // Summary
    'techPacks.summary.aria': 'Tech-Pack-Übersicht',
    'techPacks.summary.total': 'Packs gesamt',
    'techPacks.summary.ready': 'Produktionsbereit',
    'techPacks.summary.inReview': 'In Prüfung',
    'techPacks.summary.drafts': 'Entwürfe',

    // Toolbar
    'techPacks.search.placeholder': 'Packs, Styles, Fabriken suchen…',
    'techPacks.search.aria': 'Tech Packs suchen',
    'techPacks.export.title': 'Sichtbare Tech Packs als CSV-Datei exportieren',
    'techPacks.export.label': 'Liste exportieren',
    'techPacks.view.aria': 'Ansichtsmodus',
    'techPacks.view.grid': 'Rasteransicht',
    'techPacks.view.list': 'Listenansicht',

    // Card / row
    'techPacks.download': 'PDF herunterladen',
    'techPacks.download.draftTitle': 'Entwurf abschließen, um ein PDF zu exportieren',
    'techPacks.download.title': 'Tech-Pack-PDF herunterladen',
    'techPacks.moreOptions': 'Weitere Optionen',
    'techPacks.closeMenu': 'Menü schließen',
    'techPacks.delete': 'Tech Pack löschen',
    'techPacks.matchedManufacturer': 'Zugeordneter Hersteller',
    'techPacks.noManufacturer': 'Noch kein Hersteller',
    'techPacks.matchFactory': 'Fabrik zuordnen zum Produzieren',
    'techPacks.updated': 'Aktualisiert {time}',
    'techPacks.pages': '{n} Seiten',

    // List columns
    'techPacks.col.techPack': 'Tech Pack',
    'techPacks.col.status': 'Status',
    'techPacks.col.manufacturer': 'Hersteller',
    'techPacks.col.updated': 'Aktualisiert',

    // Empty states
    'techPacks.empty.foundTitle': 'Keine Tech Packs gefunden',
    'techPacks.empty.foundBody': 'Versuche einen anderen Suchbegriff oder Filter.',
    'techPacks.empty.clear': 'Filter zurücksetzen',
    'techPacks.empty.title': 'Noch keine Tech Packs',
    'techPacks.empty.body':
      'Erstelle dein erstes Spezifikationsblatt – Status, Seiten und ein zugeordneter Hersteller, alles an einem Ort.',

    // Toasts
    'techPacks.toast.signIn': 'Melde dich an, um ein Tech Pack zu erstellen.',
    'techPacks.toast.created': 'Neuer Tech-Pack-Entwurf erstellt.',
    'techPacks.toast.finishDraft': 'Schließe diesen Entwurf ab, bevor du ein PDF exportierst.',
    'techPacks.toast.downloaded': '„{name}“-PDF heruntergeladen.',
    'techPacks.toast.pdfError': 'PDF konnte nicht erstellt werden. Bitte versuche es erneut.',
    'techPacks.toast.nothingExport': 'Nichts zu exportieren in der aktuellen Ansicht.',
    'techPacks.toast.exportedOne': '{n} Tech Pack als CSV exportiert.',
    'techPacks.toast.exportedMany': '{n} Tech Packs als CSV exportiert.',
    'techPacks.toast.exportError': 'Liste konnte nicht exportiert werden. Bitte versuche es erneut.',
    'techPacks.toast.deleted': '„{name}“ gelöscht.',

    // Default names for newly created packs
    'techPacks.newName.hoodie': 'Unbenannter Hoodie',
    'techPacks.newName.tee': 'Unbenanntes T-Shirt',
    'techPacks.newName.jacket': 'Unbenannte Jacke',
    'techPacks.newName.pants': 'Unbenannte Hose',
    'techPacks.newName.cap': 'Unbenannte Mütze',
  },
}
