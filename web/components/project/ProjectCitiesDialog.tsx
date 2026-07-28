"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { MapPin, Check, Plus } from "lucide-react"
import Modal, { ErrorMessage } from "@/components/ui/Modal"
import { countryFlag } from "@/lib/flags"
import { createCity, setProjectCities } from "@/app/(app)/projets/[id]/actions"

// ============================================================
// Les villes d'un projet (28/07)
// ============================================================
// Le travail est ENTRE des villes — une triade en implique deux ou
// trois. Elles se cochent ici, dans un référentiel partagé : une ville
// créée pour un projet sert au suivant, et la carte du tableau de bord
// agrège tout le monde sur le même repère.
//
// Créer une ville demande nom, pays ET coordonnées : une ville sans
// position ne placerait aucun repère — elle donnerait l'impression
// d'une saisie réussie qui ne montre rien (même règle que lat/lng du
// lot 3). Saisie MANUELLE, pas de géocodage : un service externe pour
// une poignée de communes connues.

const inputCls = "w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
const border = { borderColor: "#E3E6E2" }
const label = "block text-sm font-medium mb-1"

export type CityOption = { id: string; name: string; country: string | null }

export default function ProjectCitiesDialog({ projectId, linkedIds, cities }: {
  projectId: string
  linkedIds: string[]
  cities: CityOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set(linkedIds))
  const [options, setOptions] = useState<CityOption[]>(cities)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ name: "", country: "", lat: "", lng: "" })

  function toggleCity(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function addCity() {
    setError("")
    startTransition(async () => {
      const res = await createCity(draft)
      if (!res.ok || !res.id) { setError(res.error ?? "Une erreur est survenue."); return }
      const created = { id: res.id, name: draft.name.trim(), country: draft.country.trim() || null }
      // La ville existait peut-être déjà (créée depuis un autre projet) :
      // on ne l'ajoute pas deux fois à la liste, on la coche.
      setOptions(prev => prev.some(c => c.id === created.id) ? prev : [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "fr")))
      setSelected(prev => new Set(prev).add(res.id as string))
      setDraft({ name: "", country: "", lat: "", lng: "" })
      setAdding(false)
    })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const res = await setProjectCities({ projectId, cityIds: [...selected] })
      if (res.ok) { setOpen(false); router.refresh() }
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  return (
    <>
      <button type="button" onClick={() => { setSelected(new Set(linkedIds)); setOpen(true) }}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium"
        style={{ ...border, color: "#17211D" }} title="Villes concernées par le projet">
        <MapPin size={14} aria-hidden="true" />
        <span className="hidden sm:inline">Villes</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} busy={pending} maxWidth="max-w-lg"
        title="Villes concernées par le projet">
        <form onSubmit={submit} className="space-y-3">
          <p className="text-xs" style={{ color: "#66716B" }}>
            Chaque ville cochée porte un repère sur la carte du tableau de bord —
            un projet entre deux villes apparaît sur les deux.
          </p>
          <div className="space-y-1">
            {options.map(c => {
              const flag = countryFlag(c.country)
              return (
                <label key={c.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer"
                  style={{ ...border, background: selected.has(c.id) ? "var(--brand-accent-soft,#E4F0EC)" : "#fff" }}>
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleCity(c.id)}
                    className="accent-emerald-700" />
                  <span className="text-sm" style={{ color: "#17211D" }}>
                    {flag && <span className="mr-1.5" aria-hidden="true">{flag}</span>}
                    {c.name}
                    {c.country && <span className="ml-1.5 text-xs" style={{ color: "#66716B" }}>{c.country}</span>}
                  </span>
                </label>
              )
            })}
            {options.length === 0 && (
              <p className="text-sm px-1" style={{ color: "#66716B" }}>Aucune ville dans le référentiel pour l&apos;instant.</p>
            )}
          </div>

          {adding ? (
            <div className="p-3 rounded-xl border space-y-3" style={border}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pc-name" className={label} style={{ color: "#17211D" }}>Nom *</label>
                  <input id="pc-name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}
                    className={inputCls} style={border} placeholder="Jezzine" />
                </div>
                <div>
                  <label htmlFor="pc-country" className={label} style={{ color: "#17211D" }}>Pays *</label>
                  <input id="pc-country" value={draft.country} onChange={e => setDraft({ ...draft, country: e.target.value })}
                    className={inputCls} style={border} placeholder="Liban" />
                </div>
                <div>
                  <label htmlFor="pc-lat" className={label} style={{ color: "#17211D" }}>Latitude *</label>
                  <input id="pc-lat" type="number" step="any" min={-90} max={90} value={draft.lat}
                    onChange={e => setDraft({ ...draft, lat: e.target.value })}
                    className={inputCls} style={border} placeholder="33.545" />
                </div>
                <div>
                  <label htmlFor="pc-lng" className={label} style={{ color: "#17211D" }}>Longitude *</label>
                  <input id="pc-lng" type="number" step="any" min={-180} max={180} value={draft.lng}
                    onChange={e => setDraft({ ...draft, lng: e.target.value })}
                    className={inputCls} style={border} placeholder="35.585" />
                </div>
              </div>
              <p className="text-xs" style={{ color: "#66716B" }}>
                Coordonnées décimales, saisies à la main — elles placent le repère de la ville sur la carte.
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setAdding(false)}
                  className="px-3 py-1.5 rounded-xl border text-xs font-medium" style={{ ...border, color: "#66716B" }}>
                  Annuler
                </button>
                <button type="button" onClick={addCity} disabled={pending}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                  style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending ? 0.6 : 1 }}>
                  Créer la ville
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium"
              style={{ color: "var(--brand-accent,#0E6B5C)" }}>
              <Plus size={14} aria-hidden="true" /> Ajouter une ville au référentiel
            </button>
          )}

          <ErrorMessage>{error}</ErrorMessage>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ ...border, color: "#66716B" }}>
              Annuler
            </button>
            <button type="submit" disabled={pending}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending ? 0.6 : 1 }}>
              <Check size={15} /> {pending ? "…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
