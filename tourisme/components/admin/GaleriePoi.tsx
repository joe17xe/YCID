'use client'
import { useState } from 'react'
import { ArrowLeft, ArrowRight, ImagePlus, X } from 'lucide-react'
import type { Photo } from '@/lib/types'

/* Choisir les photos d'un lieu, sans taper un chemin de mémoire : on
   ouvre la grille des images déposées dans public/photos, on clique.
   La PREMIÈRE de la liste est la couverture — c'est elle qui part dans
   les listes, les vignettes et l'en-tête de fiche ; les flèches servent
   donc à décider quelle image représente le lieu.

   Le crédit se saisit ici, photo par photo : il s'affiche sous l'image
   sur le site. Une photo prêtée par un établissement se cite. */
export default function GaleriePoi({
  photos,
  disponibles,
  onChange,
}: {
  photos: Photo[]
  /** Chemins servis par /api/photos — ce qui est réellement sur le disque. */
  disponibles: string[]
  onChange: (p: Photo[]) => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const prises = new Set(photos.map((p) => p.src))
  const libres = disponibles.filter((s) => !prises.has(s))

  const deplacer = (i: number, pas: number) => {
    const j = i + pas
    if (j < 0 || j >= photos.length) return
    const copie = [...photos]
    ;[copie[i], copie[j]] = [copie[j], copie[i]]
    onChange(copie)
  }

  return (
    <fieldset className="w-full">
      <legend className="text-[12px] font-semibold">
        Photos{' '}
        <span className="font-normal text-[var(--encre-3)]">
          ({photos.length} — la première sert de couverture)
        </span>
      </legend>

      {photos.length ? (
        <ul className="mt-1.5 space-y-1.5">
          {photos.map((ph, i) => (
            <li key={ph.src} className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- vignette d'admin, pas de mise en page à optimiser */}
              <img
                src={ph.src}
                alt=""
                className="h-11 w-14 shrink-0 rounded-[var(--r-media)] object-cover"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="mono truncate text-[11px] text-[var(--encre-3)]">
                  {ph.src.replace('/photos/', '')}
                  {i === 0 ? <b className="ms-1.5 text-[var(--ocre)]">couverture</b> : null}
                </span>
                <input
                  value={ph.credit ?? ''}
                  placeholder="Crédit — qui l'a prise"
                  onChange={(e) =>
                    onChange(
                      photos.map((x, k) => (k === i ? { ...x, credit: e.target.value } : x)),
                    )
                  }
                  className="w-full rounded-lg border border-[var(--ligne)] bg-[var(--surface)] px-2 py-1.5 text-[12.5px]"
                />
              </span>
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  aria-label="Monter"
                  disabled={i === 0}
                  onClick={() => deplacer(i, -1)}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--ligne)] disabled:opacity-30"
                >
                  <ArrowLeft size={14} className="-rotate-90" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Descendre"
                  disabled={i === photos.length - 1}
                  onClick={() => deplacer(i, 1)}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--ligne)] disabled:opacity-30"
                >
                  <ArrowRight size={14} className="-rotate-90" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Retirer"
                  onClick={() => onChange(photos.filter((_, k) => k !== i))}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--danger)] text-[var(--danger)]"
                >
                  <X size={14} aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        className="btn btn-surface !min-h-[36px] !py-1.5 mt-2 text-[12.5px]"
      >
        <ImagePlus size={15} aria-hidden />
        {ouvert ? 'Fermer' : `Ajouter une photo (${libres.length} disponibles)`}
      </button>

      {ouvert ? (
        libres.length ? (
          <ul className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {libres.map((src) => (
              <li key={src}>
                <button
                  type="button"
                  title={src.replace('/photos/', '')}
                  onClick={() => onChange([...photos, { src }])}
                  className="block w-full overflow-hidden rounded-[var(--r-media)] border border-[var(--ligne)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- grille de choix, images locales */}
                  <img src={src} alt={src} className="aspect-[4/3] w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[12.5px] text-[var(--encre-2)]">
            Toutes les images de <code className="mono">public/photos</code> sont déjà utilisées
            ici. Déposez-en d&rsquo;autres dans ce dossier pour les voir apparaître.
          </p>
        )
      ) : null}
    </fieldset>
  )
}
