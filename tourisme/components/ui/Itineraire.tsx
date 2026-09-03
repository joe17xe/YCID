import { ExternalLink, Navigation } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Position } from '@/lib/types'

/* Les coordonnées, et de quoi les ouvrir dans l'application que le
   visiteur a déjà. Trois liens universels — pas de SDK, pas de clé,
   rien à charger : ce sont des URL, elles marchent hors-ligne une fois
   la page en cache et ouvrent l'app native quand elle est installée.
   Les coordonnées restent affichées : au Liban, on se donne rendez-vous
   en collant une paire de chiffres dans WhatsApp. */

export function lienGoogleMaps([lon, lat]: Position) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
}
export function lienWaze([lon, lat]: Position) {
  return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`
}
export function lienPlans([lon, lat]: Position, nom?: string) {
  const q = nom ? `&q=${encodeURIComponent(nom)}` : ''
  return `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d${q}`
}

export default function Itineraire({
  geom,
  nom,
  compact = false,
}: {
  geom: Position
  nom?: string
  /** Sur une fiche déjà chargée en boutons, on se contente des liens. */
  compact?: boolean
}) {
  const t = useTranslations('itineraire')
  const [lon, lat] = geom
  // 5 décimales ≈ 1 m : au-delà on affiche du bruit de mesure.
  const coords = `${lat.toFixed(5)}, ${lon.toFixed(5)}`
  const liens = [
    { href: lienGoogleMaps(geom), label: 'Google Maps' },
    { href: lienWaze(geom), label: 'Waze' },
    { href: lienPlans(geom, nom), label: t('plans') },
  ]
  return (
    <div className={compact ? '' : 'bloc p-[var(--s3)]'}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-[var(--s3)] gap-y-1">
        <p className="eyebrow flex items-center gap-1.5">
          <Navigation size={13} aria-hidden /> {t('titre')}
        </p>
        {/* Sélectionnable : on colle ces chiffres dans un message. */}
        <p dir="ltr" className="mono mesure select-all text-[12.5px] text-[var(--encre-2)]">
          {coords}
        </p>
      </div>
      <div className="mt-[var(--s2)] flex flex-wrap gap-[var(--s2)]">
        {liens.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noopener"
            className="btn btn-surface btn-sm"
          >
            <ExternalLink size={15} aria-hidden />
            {l.label}
          </a>
        ))}
      </div>
    </div>
  )
}
