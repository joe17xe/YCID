'use client'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import maplibregl, { type Map as MlMap } from 'maplibre-gl'
import { useTranslations } from 'next-intl'
import { ArrowLeft, ListOrdered, PhoneCall, X } from 'lucide-react'
import MapView from '@/components/carte/MapView'
import type { LineString, Position, Urgence } from '@/lib/types'
import { distanceM, nearestOnLine, remainingM } from '@/lib/geo'
import { tx } from '@/lib/i18n-text'

type Etape = { slug: string; nom: string; position: Position; panneau: number }

const SEUIL_HORS_TRACE_M = 150

// Statut réseau via useSyncExternalStore : pas de setState dans l'effet.
function sAbonnerReseau(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}
const lireEnLigne = () => navigator.onLine
const lireEnLigneServeur = () => true

export default function SentierMode({
  nom,
  slug,
  trace,
  etapes,
  urgences,
  locale,
  centre,
}: {
  nom: string
  slug: string
  trace: LineString
  etapes: Etape[]
  urgences: Urgence[]
  locale: string
  centre: Position
}) {
  const t = useTranslations('sentier')
  const tc = useTranslations('commun')
  const [position, setPosition] = useState<Position | null>(null)
  const [gpsErreur, setGpsErreur] = useState(false)
  const enLigne = useSyncExternalStore(sAbonnerReseau, lireEnLigne, lireEnLigneServeur)
  const [voirEtapes, setVoirEtapes] = useState(false)
  const [voirUrgences, setVoirUrgences] = useState(false)
  const mapRef = useRef<MlMap | null>(null)
  const posMarker = useRef<maplibregl.Marker | null>(null)

  // Index de chaque étape le long de la trace (calculé une fois)
  const etapeIndexes = useMemo(
    () => etapes.map((e) => ({ ...e, index: nearestOnLine(trace, e.position).index })),
    [etapes, trace],
  )

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      queueMicrotask(() => setGpsErreur(true))
      return
    }
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        setGpsErreur(false)
        setPosition([p.coords.longitude, p.coords.latitude])
      },
      () => setGpsErreur(true),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    )
    return () => {
      navigator.geolocation.clearWatch(watch)
    }
  }, [])

  // Marqueur de position vivant sur la carte
  useEffect(() => {
    const map = mapRef.current
    if (!map || !position) return
    if (!posMarker.current) {
      const node = document.createElement('div')
      node.className = 'va-marker-position'
      posMarker.current = new maplibregl.Marker({ element: node }).setLngLat(position).addTo(map)
    } else {
      posMarker.current.setLngLat(position)
    }
  }, [position])

  const surTrace = position ? nearestOnLine(trace, position) : null
  const horsTrace = surTrace ? surTrace.distanceM > SEUIL_HORS_TRACE_M : false
  const restant = surTrace ? remainingM(trace, surTrace.index) : null
  const prochaine = surTrace
    ? etapeIndexes.find((e) => e.index > surTrace.index) ?? etapeIndexes[etapeIndexes.length - 1]
    : etapeIndexes[0]
  const distProchaine =
    position && prochaine ? Math.round(distanceM(position, prochaine.position)) : null

  const fmt = (m: number) =>
    m >= 1000
      ? `${(m / 1000).toFixed(1).replace('.', locale === 'fr' ? ',' : '.')} km`
      : `${m} m`

  return (
    <div className="fixed inset-0 z-50 bg-[var(--fond)]">
      <MapView
        center={centre}
        traces={[{ id: slug, line: trace }]}
        markers={etapeIndexes.map((e) => ({
          id: e.slug,
          position: e.position,
          label: e.nom,
          kind: 'etape' as const,
          no: e.panneau,
        }))}
        className="h-full w-full"
        onMapReady={(m) => {
          mapRef.current = m
        }}
      />

      {/* Bandeau haut */}
      <div className="pointer-events-none absolute inset-x-0 top-0 p-3.5" style={{ paddingTop: 'max(14px, env(safe-area-inset-top))' }}>
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Link
            href={`/parcours/${slug}`}
            className="pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--ligne)] bg-[var(--surface)] shadow"
            aria-label={tc('retour')}
          >
            <ArrowLeft size={19} className="rtl:-scale-x-100" aria-hidden />
          </Link>
          <div className="pointer-events-auto flex min-w-0 flex-1 items-center justify-between gap-2 rounded-full border border-[var(--ligne)] bg-[var(--surface)] px-4 py-2.5 shadow">
            <span className="truncate text-[13.5px] font-bold">{nom}</span>
            <span className="mono shrink-0 text-[12.5px] text-[var(--encre-2)]">
              {restant != null ? `${fmt(restant)} ${t('restants')}` : ''}
            </span>
          </div>
          {!enLigne ? (
            <span className="pointer-events-auto shrink-0 rounded-full border border-[var(--ligne)] bg-[var(--surface)] px-3 py-2 text-[11.5px] font-bold text-[var(--pin)] shadow">
              ● {tc('horsLigne')}
            </span>
          ) : null}
        </div>
        {horsTrace ? (
          <p className="pointer-events-auto mx-auto mt-2 max-w-3xl rounded-xl border border-[var(--ocre-bord)] bg-[var(--ocre-pale)] px-3.5 py-2 text-[13px] font-semibold text-[var(--ocre)] shadow">
            {t('horsTrace', { distance: SEUIL_HORS_TRACE_M })}
          </p>
        ) : null}
      </div>

      {/* Carte du bas */}
      <div className="absolute inset-x-0 bottom-0 p-3.5" style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
        <div className="card mx-auto max-w-3xl p-4">
          {gpsErreur ? (
            <p className="text-[13px] leading-snug text-[var(--encre-2)]">{t('gpsRefuse')}</p>
          ) : !position ? (
            <p className="text-[13px] text-[var(--encre-2)]">{t('gpsAttente')}</p>
          ) : prochaine ? (
            <>
              <p className="eyebrow">{t('prochainPoint')}</p>
              <div className="mt-0.5 flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-[16.5px] font-bold">{prochaine.nom}</p>
                {distProchaine != null ? (
                  <p className="mono shrink-0 text-[15px] font-bold text-[var(--pin)]">
                    {fmt(distProchaine)}
                  </p>
                ) : null}
              </div>
              <p className="mt-0.5 text-[12px] text-[var(--encre-2)]">
                {tc('panneau')} {prochaine.panneau} — {t('note')}
              </p>
            </>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button onClick={() => setVoirEtapes(true)} className="btn btn-surface flex-1 !min-h-[44px] !py-2 text-[13.5px]">
              <ListOrdered size={17} aria-hidden /> {tc('etapes').split('—')[0]}
            </button>
            <button onClick={() => setVoirUrgences(true)} className="btn btn-danger flex-1 !min-h-[44px] !py-2 text-[13.5px]">
              <PhoneCall size={17} aria-hidden /> {tc('urgences')}
            </button>
          </div>
        </div>
      </div>

      {/* Feuille étapes */}
      {voirEtapes ? (
        <Feuille titre={tc('etapes')} onClose={() => setVoirEtapes(false)}>
          <ol className="space-y-2">
            {etapeIndexes.map((e) => (
              <li key={e.slug} className="flex items-center gap-3 rounded-xl border border-[var(--ligne)] bg-[var(--surface)] p-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--pin)] text-[13px] font-bold text-[var(--sur-pin)]">
                  {e.panneau}
                </span>
                <span className="flex-1 text-[14px] font-semibold">{e.nom}</span>
                {position ? (
                  <span className="mono text-[12px] text-[var(--encre-2)]">
                    {fmt(Math.round(distanceM(position, e.position)))}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </Feuille>
      ) : null}

      {/* Feuille urgences */}
      {voirUrgences ? (
        <Feuille titre={tc('urgences')} onClose={() => setVoirUrgences(false)}>
          <div className="space-y-2">
            {urgences.map((u) => (
              <a
                key={u.tel}
                href={`tel:${u.tel}`}
                className="flex items-center justify-between rounded-xl border border-[var(--danger)] bg-[var(--danger-pale)] px-4 py-3.5"
              >
                <span className="text-[15px] font-bold text-[var(--encre)]">{tx(u.nom, locale)}</span>
                <span className="mono text-[17px] font-bold text-[var(--danger)]">{u.tel}</span>
              </a>
            ))}
          </div>
        </Feuille>
      ) : null}
    </div>
  )
}

function Feuille({
  titre,
  onClose,
  children,
}: {
  titre: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="absolute inset-0 z-10 flex items-end bg-black/45" onClick={onClose}>
      <div
        className="max-h-[75%] w-full overflow-y-auto rounded-t-3xl bg-[var(--fond)] p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[17px] font-bold">{titre}</h2>
          <button onClick={onClose} aria-label="Fermer" className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-2)]">
            <X size={17} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
