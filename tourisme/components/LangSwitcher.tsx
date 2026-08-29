'use client'
import { useLocale } from 'next-intl'
import { LOCALES, LOCALE_NAMES } from '@/lib/i18n-text'

function poserCookieLangue(l: string) {
  document.cookie = `VA_LOCALE=${l}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
  window.location.reload()
}

// Chaque langue dans sa propre écriture — jamais de drapeaux.
export default function LangSwitcher({ compact = true }: { compact?: boolean }) {
  const locale = useLocale()
  const choisir = poserCookieLangue
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Language">
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => choisir(l)}
          aria-pressed={l === locale}
          lang={l}
          className={
            'rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ' +
            (l === locale
              ? 'bg-[var(--pin)] text-[var(--sur-pin)]'
              : 'bg-[var(--surface-2)] text-[var(--encre-2)]')
          }
        >
          {compact ? (l === 'ar' ? 'ع' : l.toUpperCase()) : LOCALE_NAMES[l]}
        </button>
      ))}
    </div>
  )
}
