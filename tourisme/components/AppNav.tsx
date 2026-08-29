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

export default function AppNav() {
  const pathname = usePathname()
  const t = useTranslations('nav')
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--ligne)] bg-[var(--surface)]/95 backdrop-blur"
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
                'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ' +
                (actif ? 'text-[var(--pin)]' : 'text-[var(--encre-3)]')
              }
            >
              <Icon size={20} strokeWidth={actif ? 2.4 : 2} aria-hidden />
              {t(key)}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
