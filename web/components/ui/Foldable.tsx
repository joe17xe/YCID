"use client"
import { useId, useState, useSyncExternalStore, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"

// ============================================================
// Un bloc qui se replie
// ============================================================
// Retour de recette du 04/09, capture à l'appui : sur téléphone, la
// « Répartition par financeur » occupe trois écrans à elle seule. Elle
// n'est pas de trop — c'est la vue du compte rendu — mais elle passe
// AVANT le tableau des lignes et les appels de fonds, que plus personne
// n'atteint. Le défaut se répète partout où un bloc dense précède ce
// qu'on est venu faire.
//
// Un bloc replié doit rester lisible : on garde le TITRE, mis en avant,
// et un RÉSUMÉ d'une ligne — le chiffre qui dit s'il faut ouvrir. Un
// accordéon qui cache jusqu'au sujet du bloc ne fait pas gagner de la
// place, il fait perdre l'information.
//
// L'affordance est dite deux fois, parce qu'un chevron seul ne se voit
// pas sur un écran de six pouces : une pastille aux couleurs de la
// marque, et le mot « Déplier ».
//
// AUCUN CLIGNOTEMENT AU CHARGEMENT. Tant qu'aucun choix n'a été
// exprimé, l'état visible est décidé par les classes responsives
// (`hidden sm:block`), pas par du JavaScript qui s'exécuterait après le
// premier rendu : décider après coup ferait apparaître puis disparaître
// le contenu sous les yeux. Le JavaScript n'intervient que pour un
// choix EXPLICITE.

// Une SEULE entrée de stockage pour tous les blocs de l'outil : une clé
// par bloc aurait rempli le navigateur de « solidpilot.fold.<uuid> »
// que rien n'aurait jamais nettoyés.
const STORE = "solidpilot.folds"

type Folds = Record<string, 0 | 1>

// Le navigateur est une source de vérité EXTÉRIEURE à React. On la lit
// donc comme telle (useSyncExternalStore) plutôt qu'en recopiant sa
// valeur dans un état après le premier rendu : recopier provoquerait un
// rendu en cascade, et deux blocs qui partagent une clé se
// contrediraient jusqu'au prochain chargement.
const listeners = new Set<() => void>()

function subscribe(fn: () => void) {
  listeners.add(fn)
  // « storage » ne se déclenche que dans les AUTRES onglets ; les
  // abonnés maison couvrent celui-ci.
  if (typeof window !== "undefined") window.addEventListener("storage", fn)
  return () => {
    listeners.delete(fn)
    if (typeof window !== "undefined") window.removeEventListener("storage", fn)
  }
}

function rawSnapshot(): string | null {
  try { return localStorage.getItem(STORE) } catch { return null }
}

// Le serveur ne connaît aucune préférence : il rend l'état par défaut,
// et React reprend la main juste après l'hydratation.
const serverSnapshot = () => null

// getSnapshot doit rendre une valeur STABLE tant que rien ne change —
// un objet reconstruit à chaque appel ferait boucler React. On garde
// donc la chaîne brute et on ne l'analyse qu'à ses changements.
let parsedFrom: string | null | undefined
let parsed: Folds = {}

function parseFolds(raw: string | null): Folds {
  if (raw !== parsedFrom) {
    parsedFrom = raw
    try {
      const v = raw ? JSON.parse(raw) : null
      parsed = v && typeof v === "object" ? (v as Folds) : {}
    } catch {
      // JSON abîmé : le défaut suffit.
      parsed = {}
    }
  }
  return parsed
}

function writeFold(key: string, open: boolean) {
  try {
    const all = { ...parseFolds(rawSnapshot()) }
    all[key] = open ? 1 : 0
    localStorage.setItem(STORE, JSON.stringify(all))
  } catch { /* navigation privée : la préférence ne vaudra que pour la visite */ }
  listeners.forEach(fn => fn())
}

export default function Foldable({
  title, summary, badge, meta, actions, children,
  rememberKey, collapsedOnMobile = false, defaultOpen = true,
  titleAs = "h2", id, className = "", headerBackground, bodyClassName = "", divider = true,
}: {
  title: ReactNode
  /** Reste visible REPLIÉ : le chiffre qui dit s'il faut ouvrir. */
  summary?: ReactNode
  /** Compteur ou pastille, à côté du titre — visible replié lui aussi. */
  badge?: ReactNode
  /** Chiffres du bloc, sous le titre et TOUJOURS visibles : ce qu'on
   *  lit sans ouvrir. Hors du bouton, car ils portent des infobulles. */
  meta?: ReactNode
  /** Boutons du bloc. Hors du bouton de repli : un bouton n'en contient pas un autre. */
  actions?: ReactNode
  children: ReactNode
  /** Sans clé, le repli ne vaut que pour la visite en cours. */
  rememberKey?: string
  /** Ouvert sur écran large, replié sous 640 px — le cas des blocs denses. */
  collapsedOnMobile?: boolean
  /** À `false`, le bloc est replié partout tant que personne ne l'ouvre. */
  defaultOpen?: boolean
  titleAs?: "h2" | "h3"
  id?: string
  className?: string
  headerBackground?: string
  bodyClassName?: string
  divider?: boolean
}) {
  const bodyId = useId()
  // Sans clé, le choix ne survit pas à la page : un état local suffit.
  const [local, setLocal] = useState<boolean | null>(null)
  const raw = useSyncExternalStore(subscribe, rawSnapshot, serverSnapshot)
  const stored = rememberKey ? parseFolds(raw)[rememberKey] : undefined
  // `null` = aucun choix exprimé : ce sont les classes responsives qui
  // décident, pas nous.
  const open: boolean | null = rememberKey
    ? (stored === 1 ? true : stored === 0 ? false : null)
    : local

  // Le seul cas où les classes font le travail toutes seules : ouvert
  // en large, replié en étroit.
  const auto = defaultOpen && collapsedOnMobile

  function toggle() {
    // Sans choix mémorisé, l'état visible dépend de la largeur — c'est
    // elle qu'on interroge, pour que le clic fasse l'inverse de ce qui
    // est à l'écran et non l'inverse d'un booléen imaginaire.
    const visible = open ?? (auto
      ? (typeof window !== "undefined" ? window.innerWidth >= 640 : defaultOpen)
      : defaultOpen)
    const next = !visible
    if (rememberKey) writeFold(rememberKey, next)
    else setLocal(next)
  }

  const bodyClass = open === null
    ? (auto ? "hidden sm:block" : defaultOpen ? "block" : "hidden")
    : (open ? "block" : "hidden")
  const chevronClass = open === null
    ? (auto ? "-rotate-90 sm:rotate-0" : defaultOpen ? "rotate-0" : "-rotate-90")
    : (open ? "rotate-0" : "-rotate-90")
  // Le mot suit l'état, y compris quand cet état dépend encore de la
  // largeur : deux libellés, chacun montré à sa taille d'écran.
  const label = open === null
    ? (auto
        ? <><span className="sm:hidden">Déplier</span><span className="hidden sm:inline">Replier</span></>
        : defaultOpen ? "Replier" : "Déplier")
    : (open ? "Replier" : "Déplier")

  const Heading = titleAs

  return (
    <div id={id} className={`bg-white rounded-2xl border ${className}`} style={{ borderColor: "#E3E6E2" }}>
      <div className="px-4 py-3 rounded-t-2xl"
        style={headerBackground ? { background: headerBackground } : undefined}>
        <div className="flex items-start gap-3">
        {/* Motif d'accordéon recommandé : le bouton EST le titre. Tout
            l'en-tête devient donc une cible tactile, et un lecteur
            d'écran annonce « Répartition par financeur, bouton, replié ». */}
        <Heading className="flex-1 min-w-0 m-0">
          <button type="button" onClick={toggle} aria-controls={bodyId}
            aria-expanded={open === null ? undefined : open}
            className="w-full flex items-start gap-2.5 text-left">
            <span aria-hidden="true"
              className="flex-shrink-0 w-7 h-7 rounded-lg grid place-items-center"
              style={{ background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }}>
              <ChevronDown size={16} className={`transition-transform ${chevronClass}`} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2 flex-wrap">
                <span className="font-semibold text-[15px] leading-6"
                  style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{title}</span>
                {badge}
              </span>
              {summary && (
                <span className="block text-xs mt-0.5 font-normal" style={{ color: "#66716B" }}>{summary}</span>
              )}
            </span>
            {/* Aligné sur la PREMIÈRE ligne du titre : centré, il
                flottait au milieu d'un titre qui passe à la ligne sur
                téléphone, et ne désignait plus rien. */}
            <span className="flex-shrink-0 text-xs font-semibold self-start mt-1 whitespace-nowrap"
              style={{ color: "var(--brand-accent,#0E6B5C)" }}>{label}</span>
          </button>
        </Heading>
        {actions && <div className="flex-shrink-0 flex items-center gap-1.5">{actions}</div>}
        </div>
        {meta && <div className="mt-2">{meta}</div>}
      </div>
      {/* Le filet vit sur le CORPS, pas sur l'en-tête : replié, le bloc
          n'a pas à porter une ligne qui ne sépare plus rien. */}
      <div id={bodyId} className={`${bodyClass} ${divider ? "border-t" : ""} ${bodyClassName}`}
        style={divider ? { borderColor: "#E3E6E2" } : undefined}>
        {children}
      </div>
    </div>
  )
}
