'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import LangSwitcher from './LangSwitcher'

/** Le bandeau se compacte dès les premiers pixels de défilement :
 *  la marque reste, l'encombrement diminue. Aucune fonction masquée —
 *  le sélecteur de langue ne bouge jamais de place. */
export default function SiteHeader({ marque }: { marque: string }) {
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className="sticky top-0 z-40 border-b border-[var(--ligne)] bg-[color-mix(in_srgb,var(--fond)_92%,transparent)] backdrop-blur-md"
      style={{ transition: 'padding 0.18s ease' }}
    >
      <div
        className="mx-auto flex max-w-3xl items-center justify-between gap-[var(--s2)] px-[var(--s3)]"
        style={{ paddingBlock: compact ? '7px' : '11px', transition: 'padding 0.18s ease' }}
      >
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <span className="balise balise-sm" aria-hidden />
          <span
            className="titres truncate font-semibold tracking-tight text-[var(--pin)]"
            style={{ fontSize: compact ? '16px' : '19px', transition: 'font-size 0.18s ease' }}
          >
            {marque}
          </span>
        </Link>
        <LangSwitcher />
      </div>
    </header>
  )
}
