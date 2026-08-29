'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Download } from 'lucide-react'

// Le « pack sentier » : la fiche, le mode sentier, la trace GPX et les
// photos entrent dans une cache nommée et versionnée. Le service worker
// sert ces caches hors-ligne et met les tuiles de carte en cache au fil
// de la consultation. Toute modification du parcours change `version`
// (trigger SQL) → nouveau nom de cache → re-téléchargement.
export default function PackHorsLigne({
  slug,
  version,
  urls,
}: {
  slug: string
  version: number
  urls: string[]
}) {
  const t = useTranslations('commun')
  const cacheName = `va-pack-${slug}-v${version}`
  const [etat, setEtat] = useState<'inconnu' | 'absent' | 'encours' | 'present' | 'indisponible'>('inconnu')

  useEffect(() => {
    let actif = true
    if (typeof caches === 'undefined') {
      queueMicrotask(() => actif && setEtat('indisponible'))
      return () => {
        actif = false
      }
    }
    caches.has(cacheName).then((oui) => actif && setEtat(oui ? 'present' : 'absent'))
    return () => {
      actif = false
    }
  }, [cacheName])

  const telecharger = async () => {
    try {
      setEtat('encours')
      // Purge les anciennes versions du même pack
      const noms = await caches.keys()
      await Promise.all(
        noms.filter((n) => n.startsWith(`va-pack-${slug}-`) && n !== cacheName).map((n) => caches.delete(n)),
      )
      const cache = await caches.open(cacheName)
      await cache.addAll(urls)
      setEtat('present')
    } catch {
      setEtat('absent')
    }
  }

  if (etat === 'indisponible') return null
  if (etat === 'present') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[var(--ligne)] bg-[var(--vert-pale)] px-4 py-3 text-[13.5px] font-semibold text-[var(--pin)]">
        <Check size={17} aria-hidden /> {t('dispoHorsLigne')}
      </div>
    )
  }
  return (
    <button onClick={telecharger} disabled={etat === 'encours'} className="btn btn-pin w-full">
      <Download size={18} aria-hidden />
      {etat === 'encours' ? '…' : t('telechargerSentier')}
    </button>
  )
}
