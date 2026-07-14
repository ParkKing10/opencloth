export type Lang = 'en' | 'de'

/** One feature's translations. Every key present in `en` should also be present in `de`. */
export type LocaleBundle = {
  en: Record<string, string>
  de: Record<string, string>
}
