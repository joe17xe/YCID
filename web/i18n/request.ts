import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

// i18n sans routage par préfixe d'URL : la langue vit dans un cookie,
// choisie depuis le menu compte. Français par défaut.
export default getRequestConfig(async () => {
  const store = await cookies()
  const locale = store.get('SP_LOCALE')?.value === 'en' ? 'en' : 'fr'
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
