"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, AlertTriangle } from "lucide-react"
import { updateLegalSettings } from "@/app/(app)/admin/configuration/settings-actions"
import type { PlatformSettings } from "@/lib/settings"

// ============================================================
// PR 34 — Mentions légales administrables (RGPD)
// ============================================================
// Ces informations sont publiques par nature et alimentent les pages
// /mentions-legales et /confidentialite : elles ne doivent plus être
// figées dans le code ni laissées à « [à compléter] » en production.

const labelCls = "block text-xs font-semibold mb-1 tracking-wider"
const inputCls = "w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
const border = { borderColor: "#E3E6E2" }

export default function LegalForm({ settings }: { settings: PlatformSettings }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    legalEntity: settings.legalEntity,
    legalAddress: settings.legalAddress,
    legalPublisher: settings.legalPublisher,
    legalEmail: settings.legalEmail,
    legalRetention: settings.legalRetention,
  })

  const set = (k: keyof typeof form, v: string) => { setForm(f => ({ ...f, [k]: v })); setSaved(false) }
  const incomplete = !form.legalAddress || !form.legalPublisher || !form.legalEmail

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const res = await updateLegalSettings(form)
      if (res.ok) { setSaved(true); router.refresh() }
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {incomplete && (
        <p className="text-sm rounded-lg px-3 py-2 flex items-start gap-2" style={{ background: "#F7EDDD", color: "#B4690E" }}>
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>Champs incomplets : les pages publiques affichent un avertissement. Adresse, directeur de publication et email de contact sont des mentions obligatoires.</span>
        </p>
      )}

      <div className="bg-white rounded-2xl border p-6 space-y-5" style={border}>
        <div>
          <label className={labelCls} style={{ color: "#66716B" }}>ÉDITEUR</label>
          <input value={form.legalEntity} onChange={e => set("legalEntity", e.target.value)} required className={inputCls} style={border} />
        </div>
        <div>
          <label className={labelCls} style={{ color: "#66716B" }}>ADRESSE POSTALE</label>
          <input value={form.legalAddress} onChange={e => set("legalAddress", e.target.value)} className={inputCls} style={border}
            placeholder="2 place André Mignot, 78000 Versailles" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} style={{ color: "#66716B" }}>DIRECTEUR DE LA PUBLICATION</label>
            <input value={form.legalPublisher} onChange={e => set("legalPublisher", e.target.value)} className={inputCls} style={border} />
          </div>
          <div>
            <label className={labelCls} style={{ color: "#66716B" }}>EMAIL DE CONTACT</label>
            <input type="email" value={form.legalEmail} onChange={e => set("legalEmail", e.target.value)} className={inputCls} style={border}
              placeholder="contact@ycid.fr" />
            <p className="text-xs mt-1" style={{ color: "#66716B" }}>Sert aussi à l&apos;exercice des droits RGPD.</p>
          </div>
        </div>
        <div>
          <label className={labelCls} style={{ color: "#66716B" }}>DURÉE DE CONSERVATION DES DONNÉES PROJETS</label>
          <input value={form.legalRetention} onChange={e => set("legalRetention", e.target.value)} className={inputCls} style={border}
            placeholder="10 ans après la clôture du financement" />
        </div>
      </div>

      {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
      {saved && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }}>Enregistré — les pages publiques sont à jour.</p>}

      <button type="submit" disabled={pending}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold"
        style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending ? 0.7 : 1 }}>
        <Check size={16} /> {pending ? "…" : "Enregistrer"}
      </button>
    </form>
  )
}
