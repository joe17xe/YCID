'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CalendarDays, Compass, Home, Info, Waypoints } from 'lucide-react'

const ITEMS = [
  { href: '/', key: 'accueil', Icon: Home },
  { href: '/parcours', key: 'parcours', Icon: Waypoints },
  { href: '/explorer', key: 'explorer', Icon: Compass },
  { href: '/agenda', key: 'agenda', Icon: CalendarDays },
  { href: '/pratique', key: 'pratique', Icon: Info },
] as const

/** Barre basse allégée : un filet plutôt qu'un bloc, et la balise du
 *  sentier pour marquer l'onglet actif. Safe-area iOS respectée. */
export default function AppNav() {
  const pathname = usePathname()
  const t = useTranslations('nav')
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--ligne)] bg-[color-mix(in_srgb,var(--fond)_94%,transparent)] backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navigation"
    >
      <div className="mx-auto flex max-w-3xl">
        {ITEMS.map(({ href, key, Icon }) => {
          const actif = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={actif ? 'page' : undefined}
              className={
                'relative flex h-[var(--nav-h)] flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-medium ' +
                (actif ? 'text-[var(--pin)]' : 'text-[var(--encre-3)]')
              }
            >
              {actif ? (
                <span
                  className="absolute inset-x-[34%] top-0 h-[3px] rounded-b-[2px] bg-[var(--ocre)]"
                  aria-hidden
                />
              ) : null}
              <Icon size={19} strokeWidth={actif ? 2.3 : 1.9} aria-hidden />
              {t(key)}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
