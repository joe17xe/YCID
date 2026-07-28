"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Check } from "lucide-react"
import Modal, { ErrorMessage } from "@/components/ui/Modal"
import { PROJECT_STATUS } from "@/lib/constants"
import { updateProject } from "@/app/(app)/projets/[id]/actions"

// ============================================================
// Édition de la fiche projet (J4)
// ============================================================
// Rien ne permettait de corriger un projet après sa création. Le plus
// gênant était le MONTANT VOTÉ : depuis la PR 39 c'est la référence à
// laquelle tout le pilotage financier se compare, et une faute de frappe
// à la création était définitive.

const inputCls = "w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
const border = { borderColor: "#E3E6E2" }
const label = "block text-sm font-medium mb-1"

export interface ProjectEditable {
  id: string
  name: string
  description: string | null
  country: string | null
  zone: string | null
  programme: string | null
  start_date: string | null
  end_date: string | null
  status: string
  budget: number | null
  lead_org_id: string | null
  lat: number | null
  lng: number | null
}

export default function ProjectEditDialog({ project, organizations, programmes, programmeId }: {
  project: ProjectEditable
  organizations: { id: string; name: string }[]
  // Programmes (0055) — absent tant que la migration n'est pas passée :
  // le sélecteur ne s'affiche pas et rien n'est envoyé.
  programmes?: { id: string; name: string }[]
  programmeId?: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: project.name ?? "",
    description: project.description ?? "",
    country: project.country ?? "",
    zone: project.zone ?? "",
    programme: project.programme ?? "",
    start_date: project.start_date ?? "",
    end_date: project.end_date ?? "",
    status: project.status ?? "en_preparation",
    budget: project.budget != null ? String(project.budget) : "",
    lead_org_id: project.lead_org_id ?? "",
    lat: project.lat != null ? String(project.lat) : "",
    lng: project.lng != null ? String(project.lng) : "",
    ...(programmes ? { programme_id: programmeId ?? "" } : {}),
  })

  const leadChanged = form.lead_org_id !== (project.lead_org_id ?? "")

  const budgetChanged = (form.budget.trim() === "" ? null : Number(form.budget)) !== (project.budget ?? null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const res = await updateProject({ projectId: project.id, ...form })
      if (res.ok) { setOpen(false); router.refresh() }
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium"
        style={{ ...border, color: "#17211D" }} title="Modifier la fiche du projet">
        <Pencil size={14} aria-hidden="true" />
        <span className="hidden sm:inline">Modifier</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} busy={pending} maxWidth="max-w-lg"
        title="Modifier la fiche du projet">
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label htmlFor="pe-name" className={label} style={{ color: "#17211D" }}>Nom du projet *</label>
              <input id="pe-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className={inputCls} style={border} />
            </div>
            <div>
              <label htmlFor="pe-desc" className={label} style={{ color: "#17211D" }}>Description</label>
              <textarea id="pe-desc" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                className={inputCls} style={border} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pe-country" className={label} style={{ color: "#17211D" }}>Pays</label>
                <input id="pe-country" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}
                  className={inputCls} style={border} />
              </div>
              <div>
                <label htmlFor="pe-zone" className={label} style={{ color: "#17211D" }}>Zone</label>
                <input id="pe-zone" value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })}
                  className={inputCls} style={border} />
              </div>
              {programmes ? (
                // Le programme est devenu un NIVEAU (0055) : on rattache
                // à une entité, on ne tape plus une étiquette. Le
                // rattachement déclenche les appartenances des
                // directeurs du programme (via_programme).
                <div>
                  <label htmlFor="pe-prog-id" className={label} style={{ color: "#17211D" }}>Programme</label>
                  <select id="pe-prog-id" value={(form as { programme_id?: string }).programme_id ?? ""}
                    onChange={e => setForm({ ...form, programme_id: e.target.value })}
                    className={inputCls} style={border}>
                    <option value="">— Aucun —</option>
                    {programmes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label htmlFor="pe-prog" className={label} style={{ color: "#17211D" }}>Programme</label>
                  <input id="pe-prog" value={form.programme} onChange={e => setForm({ ...form, programme: e.target.value })}
                    className={inputCls} style={border} placeholder="CEM" />
                </div>
              )}
              <div>
                <label htmlFor="pe-status" className={label} style={{ color: "#17211D" }}>Statut</label>
                <select id="pe-status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                  className={inputCls} style={border}>
                  {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="pe-start" className={label} style={{ color: "#17211D" }}>Date de début</label>
                <input id="pe-start" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                  className={inputCls} style={border} />
              </div>
              <div>
                <label htmlFor="pe-end" className={label} style={{ color: "#17211D" }}>Date de fin</label>
                <input id="pe-end" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                  className={inputCls} style={border} />
              </div>
              {/* Position sur la carte du tableau de bord (V1, Lot 3).
                  Saisie MANUELLE : pas de géocodage, qui appellerait un
                  service externe pour trois communes connues. */}
              <div>
                <label htmlFor="pe-lat" className={label} style={{ color: "#17211D" }}>Latitude</label>
                <input id="pe-lat" type="number" step="any" min={-90} max={90} value={form.lat}
                  onChange={e => setForm({ ...form, lat: e.target.value })}
                  className={inputCls} style={border} placeholder="48.831" />
              </div>
              <div>
                <label htmlFor="pe-lng" className={label} style={{ color: "#17211D" }}>Longitude</label>
                <input id="pe-lng" type="number" step="any" min={-180} max={180} value={form.lng}
                  onChange={e => setForm({ ...form, lng: e.target.value })}
                  className={inputCls} style={border} placeholder="2.001" />
                <p className="text-xs mt-1" style={{ color: "#66716B" }}>
                  Coordonnées décimales — placent le repère du projet sur la carte du tableau de bord.
                </p>
              </div>
            </div>

            {/* L'organisation porteuse décide du PREMIER échelon de
                validation. Elle se figeait à la création : le jour où le
                portage change — un contact de mairie enfin désigné — rien
                ne permettait de le corriger. */}
            <div className="pt-2 border-t" style={border}>
              <label htmlFor="pe-lead" className={label} style={{ color: "#17211D" }}>Organisation porteuse *</label>
              <select id="pe-lead" required value={form.lead_org_id}
                onChange={e => setForm({ ...form, lead_org_id: e.target.value })}
                className={inputCls} style={border}>
                <option value="">Choisir…</option>
                {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <p className="text-xs mt-1" style={{ color: "#66716B" }}>
                Première étape du circuit de validation : c&apos;est elle qui approuve les devis
                avant l&apos;organisation coordinatrice.
              </p>
              {leadChanged && (
                <p className="text-xs mt-2 rounded-lg px-3 py-2" style={{ background: "#F7EDDD", color: "#8A6A1F" }}>
                  Vous changez l&apos;organisation porteuse : les prochains devis partiront
                  vers elle. L&apos;ancienne reste rattachée au projet comme partenaire, et le
                  changement est inscrit au Journal.
                </p>
              )}
            </div>

            <div className="pt-2 border-t" style={border}>
              <label htmlFor="pe-budget" className={label} style={{ color: "#17211D" }}>Montant voté (€)</label>
              <input id="pe-budget" type="number" min={0} step="0.01" value={form.budget}
                onChange={e => setForm({ ...form, budget: e.target.value })} className={inputCls} style={border} />
              <p className="text-xs mt-1" style={{ color: "#66716B" }}>
                L&apos;enveloppe votée par le financeur, référence de tout le suivi budgétaire.
              </p>
              {/* Un avertissement, pas un blocage : corriger une faute de
                  frappe est légitime. Mais ce chiffre est contractuel, et
                  sa modification se lira nommément au Journal — mieux vaut
                  le savoir avant d'enregistrer qu'après. */}
              {budgetChanged && (
                <p className="text-xs mt-2 rounded-lg px-3 py-2" style={{ background: "#F7EDDD", color: "#8A6A1F" }}>
                  Vous modifiez le montant voté. L&apos;ancienne et la nouvelle valeur seront
                  inscrites au Journal d&apos;audit, consultable par le financeur.
                </p>
              )}
            </div>

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
