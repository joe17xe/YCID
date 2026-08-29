import type { I18nText, Locale } from './types'

/** Lit un texte multilingue avec repli fr → en → ar : jamais de trou. */
export function tx(text: I18nText | null | undefined, locale: Locale | string): string {
  if (!text) return ''
  const l = locale as Locale
  return text[l] ?? text.fr ?? text.en ?? text.ar ?? ''
}

export const LOCALES: Locale[] = ['ar', 'fr', 'en']
export const DEFAULT_LOCALE: Locale = 'fr'

export function isLocale(v: string | undefined | null): v is Locale {
  return v === 'ar' || v === 'fr' || v === 'en'
}

/** Le nom de chaque langue dans sa propre écriture — jamais de drapeaux. */
export const LOCALE_NAMES: Record<Locale, string> = {
  ar: 'العربية',
  fr: 'Français',
  en: 'English',
}

export function dirFor(locale: string): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr'
}
