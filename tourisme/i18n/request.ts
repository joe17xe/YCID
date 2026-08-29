import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n-text'

// Même parti pris que Solid'Pilot : pas de préfixe d'URL, la langue vit
// dans un cookie. Les QR et liens partagés peuvent forcer ?lang=ar|fr|en
// — proxy.ts pose alors le cookie et nettoie l'URL.
export default getRequestConfig(async () => {
  const store = await cookies()
  const raw = store.get('VA_LOCALE')?.value
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
