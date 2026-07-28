"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, X, Crown } from "lucide-react"
import { createProgramme, addProgrammeDirector, removeProgrammeDirector } from "@/app/(app)/admin/programmes/actions"

// ============================================================
// Écran Admin ▸ Programmes (0055)
// ============================================================
// Créer un programme, nommer et retirer ses directeurs. La nomination
// MATÉRIALISE l'appartenance : le directeur devient membre (chef de
// projet) de tous les projets du programme, présents et futurs — posé
// par les déclencheurs de la 0055, retiré avec lui. Le rattachement
// d'un projet à un programme se fait sur SA fiche (Modifier).

const inputCls = "w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
const border = { borderColor: "#E3E6E2" }

export interface ProgrammeRow {
  id: string
  name: string
  description: string | null
  directors: { id: string; name: string }[]
  projects: string[]
}

export default function ProgrammesClient({ programmes, profiles }: {
  programmes: ProgrammeRow[]
  profiles: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [picks, setPicks] = useState<Record<string, string>>({})

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError("")
    startTransition(async () => {
      const res = await action()
      if (!res.ok) setError(res.error ?? "Une erreur est survenue.")
      else router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {/* Création */}
      <form
        onSubmit={e => { e.preventDefault(); run(async () => { const r = await createProgramme({ name, description }); if (r.ok) { setName(""); setDescription("") } return r }) }}
        className="bg-white rounded-2xl border p-6 space-y-3" style={border}>
        <h2 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Nouveau programme</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="pg-name" className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Nom *</label>
            <input id="pg-name" value={name} onChange={e => setName(e.target.value)} required
              className={inputCls} style={border} placeholder="CEM — Triades 2027" />
          </div>
          <div>
            <label htmlFor="pg-desc" className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Description</label>
            <input id="pg-desc" value={description} onChange={e => setDescription(e.target.value)}
              className={inputCls} style={border} placeholder="Villes, période, objet…" />
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={pending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending ? 0.6 : 1 }}>
            <Plus size={15} aria-hidden="true" /> Créer le programme
          </button>
        </div>
      </form>

      {error && <p className="text-sm rounded-xl px-4 py-3" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}

      {/* Programmes */}
      {programmes.map(pr => (
        <div key={pr.id} className="bg-white rounded-2xl border p-6 space-y-4" style={border}>
          <div>
            <h2 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{pr.name}</h2>
            {pr.description && <p className="text-sm mt-0.5" style={{ color: "#66716B" }}>{pr.description}</p>}
          </div>

          <div>
            <div className="text-xs font-semibold tracking-wider mb-2" style={{ color: "#66716B" }}>
              DIRECTEUR{pr.directors.length > 1 ? "S" : ""} DU PROGRAMME
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {pr.directors.map(d => (
                <span key={d.id} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full"
                  style={{ background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }}>
                  <Crown size={13} aria-hidden="true" /> {d.name}
                  <button type="button" disabled={pending}
                    onClick={() => run(() => removeProgrammeDirector({ programmeId: pr.id, userId: d.id }))}
                    aria-label={`Retirer ${d.name} de la direction`} className="ml-0.5">
                    <X size={13} aria-hidden="true" />
                  </button>
                </span>
              ))}
              {pr.directors.length === 0 && (
                <span className="text-sm" style={{ color: "#9AA39D" }}>Aucun directeur nommé.</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <label htmlFor={`pg-dir-${pr.id}`} className="sr-only">Nommer un directeur</label>
              <select id={`pg-dir-${pr.id}`} value={picks[pr.id] ?? ""}
                onChange={e => setPicks({ ...picks, [pr.id]: e.target.value })}
                className={inputCls + " max-w-xs"} style={border}>
                <option value="">Nommer un directeur…</option>
                {profiles.filter(p => !pr.directors.some(d => d.id === p.id)).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button type="button" disabled={pending || !(picks[pr.id] ?? "")}
                onClick={() => run(async () => { const r = await addProgrammeDirector({ programmeId: pr.id, userId: picks[pr.id] ?? "" }); if (r.ok) setPicks({ ...picks, [pr.id]: "" }); return r })}
                className="px-3 py-2 rounded-xl border text-sm font-medium"
                style={{ ...border, color: "#17211D", opacity: pending ? 0.6 : 1 }}>
                Nommer
              </button>
            </div>
            <p className="text-xs mt-1" style={{ color: "#66716B" }}>
              La nomination rend le directeur membre (chef de projet) de tous les projets du programme, présents et futurs. Son retrait retire ces appartenances — jamais celles posées à la main.
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold tracking-wider mb-2" style={{ color: "#66716B" }}>
              PROJETS ({pr.projects.length})
            </div>
            {pr.projects.length === 0 ? (
              <p className="text-sm" style={{ color: "#9AA39D" }}>
                Aucun projet rattaché — le rattachement se fait sur la fiche du projet, bouton « Modifier ».
              </p>
            ) : (
              <ul className="text-sm space-y-1" style={{ color: "#17211D" }}>
                {pr.projects.map(name => <li key={name}>· {name}</li>)}
              </ul>
            )}
          </div>
        </div>
      ))}
      {programmes.length === 0 && (
        <p className="text-sm text-center py-6" style={{ color: "#66716B" }}>Aucun programme pour l&apos;instant.</p>
      )}
    </div>
  )
}
