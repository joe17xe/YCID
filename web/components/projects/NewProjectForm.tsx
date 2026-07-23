"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PROJECT_STATUS } from "@/lib/constants"
import type { ProjectStatus } from "@/lib/types"
import { createProject } from "@/app/(app)/projets/nouveau/actions"

const inputCls = "w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"

export default function NewProjectForm({ orgs }: { orgs: { id: string; name: string }[] }) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: "",
    description: "",
    country: "",
    zone: "",
    start_date: "",
    end_date: "",
    status: "en_preparation" as ProjectStatus,
    budget: "",
    lead_org_id: "",
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const res = await createProject(form)
      if (res.ok && res.projectId) router.push(`/projets/${res.projectId}`)
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border p-6 space-y-4" style={{ borderColor: "#E3E6E2" }}>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Nom du projet *</label>
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
          className={inputCls} style={{ borderColor: "#E3E6E2" }} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Description</label>
        <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3}
          className={inputCls} style={{ borderColor: "#E3E6E2" }} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Organisation porteuse *</label>
          <select value={form.lead_org_id} onChange={e => setForm({ ...form, lead_org_id: e.target.value })} required
            className={inputCls} style={{ borderColor: "#E3E6E2" }}>
            <option value="">Choisir…</option>
            {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Statut</label>
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as ProjectStatus })}
            className={inputCls} style={{ borderColor: "#E3E6E2" }}>
            {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Pays</label>
          <input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}
            className={inputCls} style={{ borderColor: "#E3E6E2" }} placeholder="Liban" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Zone</label>
          <input value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })}
            className={inputCls} style={{ borderColor: "#E3E6E2" }} placeholder="Azour (Jezzine)" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Date de début</label>
          <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
            className={inputCls} style={{ borderColor: "#E3E6E2" }} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Date de fin</label>
          <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
            className={inputCls} style={{ borderColor: "#E3E6E2" }} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Budget (€)</label>
          <input type="number" min={0} step="0.01" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })}
            className={inputCls} style={{ borderColor: "#E3E6E2" }} placeholder="48650" />
        </div>
      </div>
      {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={() => router.push("/projets")}
          className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
          Annuler
        </button>
        <button type="submit" disabled={pending}
          className="px-5 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "#0E6B5C", opacity: pending ? 0.7 : 1 }}>
          {pending ? "Création…" : "Créer le projet"}
        </button>
      </div>
    </form>
  )
}
