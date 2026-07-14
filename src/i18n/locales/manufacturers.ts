import type { LocaleBundle } from '../types'

// Translations for the "manufacturers" area. Keep en + de keys in sync.
export const manufacturers: LocaleBundle = {
  en: {
    'manufacturers.page.eyebrow': 'Manufacturer Hub',
    'manufacturers.page.title': 'Manufacturers',
    'manufacturers.page.subtitle':
      'Discover vetted factories across the globe — filter by capability, country, MOQ and lead time, then request a sample in one tap.',
    'manufacturers.actions.postRequest': 'Post a Request',

    'manufacturers.cap.all': 'All',
    'manufacturers.cap.knitwear': 'Knitwear',
    'manufacturers.cap.cutSew': 'Cut & Sew',
    'manufacturers.cap.denim': 'Denim',
    'manufacturers.cap.outerwear': 'Outerwear',
    'manufacturers.cap.accessories': 'Accessories',

    'manufacturers.filter.countryTitle': 'Cycle country filter',
    'manufacturers.filter.moqTitle': 'Cycle MOQ ceiling',
    'manufacturers.filter.anyCountry': 'Any country',

    'manufacturers.moq.any': 'Any MOQ',
    'manufacturers.moq.u50': 'Under 50',
    'manufacturers.moq.u100': 'Under 100',
    'manufacturers.moq.u200': 'Under 200',

    'manufacturers.search.placeholder': 'Search factories, cities…',
    'manufacturers.search.aria': 'Search factories',

    'manufacturers.meta.factoryAvailable': 'factory available',
    'manufacturers.meta.factoriesAvailable': 'factories available',
    'manufacturers.meta.saved': '{n} saved',
    'manufacturers.meta.clearFilters': 'Clear filters',

    'manufacturers.sort.by': 'Sort by',
    'manufacturers.sort.rating': 'Top rated',
    'manufacturers.sort.moq': 'Lowest MOQ',
    'manufacturers.sort.price': 'Lowest price',
    'manufacturers.sort.lead': 'Fastest lead time',
    'manufacturers.sort.closeAria': 'Close sort menu',

    'manufacturers.card.verified': 'Verified',
    'manufacturers.card.newPartner': 'New partner',
    'manufacturers.card.saveFactory': 'Save factory',
    'manufacturers.card.removeSaved': 'Remove from saved',
    'manufacturers.card.from': 'from',
    'manufacturers.card.perUnit': '/unit',
    'manufacturers.card.moq': 'MOQ',
    'manufacturers.card.units': 'units',
    'manufacturers.card.leadTime': 'Lead time',
    'manufacturers.card.days': 'days',
    'manufacturers.card.reviews': 'Reviews',
    'manufacturers.card.specialty': 'Specialty',
    'manufacturers.card.requestSample': 'Request Sample',
    'manufacturers.card.requestTitle': 'Request a sample from {name}',

    'manufacturers.specialty.full': 'Full-package apparel production',
    'manufacturers.specialty.one': '{cap} specialist',
    'manufacturers.specialty.multi': '{a} · {b}{more}',
    'manufacturers.specialty.more': ' +more',

    'manufacturers.empty.title': 'No factories match those filters',
    'manufacturers.empty.desc': 'Try widening the country or MOQ range, or clear your search.',
    'manufacturers.empty.clearAll': 'Clear all filters',

    'manufacturers.factory': 'factory',
    'manufacturers.factories': 'factories',

    'manufacturers.toast.saved': 'Saved {name}',
    'manufacturers.toast.removed': 'Removed {name} from saved',
    'manufacturers.toast.signInSample': 'Sign in to request a sample.',
    'manufacturers.toast.sampleRequested': 'Sample requested from {name} · {n} units',
    'manufacturers.toast.signInRequest': 'Sign in to post a sourcing request.',
    'manufacturers.toast.briefExported': 'Request brief exported · {n} matched {factories}',
    'manufacturers.toast.exportError': 'Could not export the request brief. Please try again.',
  },
  de: {
    'manufacturers.page.eyebrow': 'Hersteller-Hub',
    'manufacturers.page.title': 'Hersteller',
    'manufacturers.page.subtitle':
      'Entdecke geprüfte Fabriken weltweit — filtere nach Fähigkeit, Land, MOQ und Lieferzeit und fordere mit einem Tipp ein Muster an.',
    'manufacturers.actions.postRequest': 'Anfrage stellen',

    'manufacturers.cap.all': 'Alle',
    'manufacturers.cap.knitwear': 'Strickwaren',
    'manufacturers.cap.cutSew': 'Cut & Sew',
    'manufacturers.cap.denim': 'Denim',
    'manufacturers.cap.outerwear': 'Oberbekleidung',
    'manufacturers.cap.accessories': 'Accessoires',

    'manufacturers.filter.countryTitle': 'Länderfilter wechseln',
    'manufacturers.filter.moqTitle': 'MOQ-Grenze wechseln',
    'manufacturers.filter.anyCountry': 'Beliebiges Land',

    'manufacturers.moq.any': 'Beliebige MOQ',
    'manufacturers.moq.u50': 'Unter 50',
    'manufacturers.moq.u100': 'Unter 100',
    'manufacturers.moq.u200': 'Unter 200',

    'manufacturers.search.placeholder': 'Fabriken, Städte suchen…',
    'manufacturers.search.aria': 'Fabriken suchen',

    'manufacturers.meta.factoryAvailable': 'Fabrik verfügbar',
    'manufacturers.meta.factoriesAvailable': 'Fabriken verfügbar',
    'manufacturers.meta.saved': '{n} gespeichert',
    'manufacturers.meta.clearFilters': 'Filter zurücksetzen',

    'manufacturers.sort.by': 'Sortieren nach',
    'manufacturers.sort.rating': 'Bestbewertet',
    'manufacturers.sort.moq': 'Niedrigste MOQ',
    'manufacturers.sort.price': 'Niedrigster Preis',
    'manufacturers.sort.lead': 'Schnellste Lieferzeit',
    'manufacturers.sort.closeAria': 'Sortiermenü schließen',

    'manufacturers.card.verified': 'Verifiziert',
    'manufacturers.card.newPartner': 'Neuer Partner',
    'manufacturers.card.saveFactory': 'Fabrik speichern',
    'manufacturers.card.removeSaved': 'Aus Gespeicherten entfernen',
    'manufacturers.card.from': 'ab',
    'manufacturers.card.perUnit': '/Einheit',
    'manufacturers.card.moq': 'MOQ',
    'manufacturers.card.units': 'Einheiten',
    'manufacturers.card.leadTime': 'Lieferzeit',
    'manufacturers.card.days': 'Tage',
    'manufacturers.card.reviews': 'Bewertungen',
    'manufacturers.card.specialty': 'Spezialität',
    'manufacturers.card.requestSample': 'Muster anfordern',
    'manufacturers.card.requestTitle': 'Ein Muster von {name} anfordern',

    'manufacturers.specialty.full': 'Full-Package-Bekleidungsproduktion',
    'manufacturers.specialty.one': '{cap}-Spezialist',
    'manufacturers.specialty.multi': '{a} · {b}{more}',
    'manufacturers.specialty.more': ' +mehr',

    'manufacturers.empty.title': 'Keine Fabriken entsprechen diesen Filtern',
    'manufacturers.empty.desc': 'Erweitere den Länder- oder MOQ-Bereich oder setze deine Suche zurück.',
    'manufacturers.empty.clearAll': 'Alle Filter zurücksetzen',

    'manufacturers.factory': 'Fabrik',
    'manufacturers.factories': 'Fabriken',

    'manufacturers.toast.saved': '{name} gespeichert',
    'manufacturers.toast.removed': '{name} aus Gespeicherten entfernt',
    'manufacturers.toast.signInSample': 'Melde dich an, um ein Muster anzufordern.',
    'manufacturers.toast.sampleRequested': 'Muster von {name} angefordert · {n} Einheiten',
    'manufacturers.toast.signInRequest': 'Melde dich an, um eine Beschaffungsanfrage zu stellen.',
    'manufacturers.toast.briefExported': 'Anfrage-Brief exportiert · {n} passende {factories}',
    'manufacturers.toast.exportError':
      'Der Anfrage-Brief konnte nicht exportiert werden. Bitte versuche es erneut.',
  },
}
