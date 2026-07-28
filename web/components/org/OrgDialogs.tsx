"use client"
import { useId, useState, useTransition } from "react"
import { Plus, Pencil, Trash2, UserPlus, Copy, Check, Upload } from "lucide-react"
import Modal, { ErrorMessage } from "@/components/ui/Modal"
import { ORG_TYPES } from "@/lib/constants"
import { createClient } from "@/lib/supabase/client"
import { saveOrganization, deleteOrganization, createUserAccount } from "@/app/(app)/organisations/actions"

const inputCls = "w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
const border = { borderColor: "#E3E6E2" }

export interface OrgData {
  id: string; name: string; type: string; country: string; email: string | null; status: string
  logo_url?: string | null
}

// `logosReady` (0057) : tant que la migration n'est pas passée, ni
// champ logo ni envoi de la colonne — le dialogue reste celui d'avant.
export function OrgDialog({ org, logosReady = false }: { org?: OrgData; logosReady?: boolean }) {
  const uid = useId()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: org?.name ?? "", type: org?.type ?? "association", country: org?.country ?? "France",
    email: org?.email ?? "", status: org?.status ?? "active",
    logo_url: org?.logo_url ?? "",
  })

  // Le logo est FOURNI par l'organisation (décision du 28/07 : rien à
  // créer) — même bucket public que la marque, chemin org-logos/.
  async function uploadLogo(file: File) {
    setError("")
    if (!org) return
    if (!file.type.startsWith("image/")) { setError("Choisissez un fichier image (PNG, JPG ou SVG)."); return }
    if (file.size > 1024 * 1024) { setError("Fichier trop lourd (1 Mo maximum)."); return }
    setUploading(true)
    const ext = file.name.split(".").pop()?.toLowerCase() || "png"
    const path = `org-logos/${org.id}.${ext}`
    const { error: upErr } = await supabase.storage.from("branding").upload(path, file, { upsert: true })
    if (upErr) { setError(`Échec de l'envoi : ${upErr.message}`); setUploading(false); return }
    const { data } = supabase.storage.from("branding").getPublicUrl(path)
    setForm(f => ({ ...f, logo_url: `${data.publicUrl}?v=${Date.now()}` }))
    setUploading(false)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const { logo_url, ...rest } = form
      const res = await saveOrganization({
        orgId: org?.id, ...rest,
        ...(logosReady ? { logo_url } : {}),
      })
      if (res.ok) setOpen(false)
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  return (
    <>
      {org ? (
        <button onClick={() => setOpen(true)} className="p-1.5 rounded-full hover:bg-gray-100"
          aria-label={`Modifier l'organisation ${org.name}`} title="Modifier">
          <Pencil size={14} style={{ color: "#66716B" }} aria-hidden="true" />
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: "var(--brand-accent,#0E6B5C)" }}>
          <Plus size={16} aria-hidden="true" /> Nouvelle organisation
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} busy={pending} maxWidth="max-w-md"
        title={org ? "Modifier l'organisation" : "Nouvelle organisation"}>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor={`${uid}-name`} className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Nom *</label>
            <input id={`${uid}-name`} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className={inputCls} style={border} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${uid}-type`} className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Type</label>
              <select id={`${uid}-type`} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={inputCls} style={border}>
                {Object.entries(ORG_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`${uid}-country`} className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Pays</label>
              <input id={`${uid}-country`} value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className={inputCls} style={border} />
            </div>
          </div>
          <div>
            <label htmlFor={`${uid}-email`} className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Email</label>
            <input id={`${uid}-email`} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} style={border} />
          </div>
          <div>
            <label htmlFor={`${uid}-status`} className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Statut</label>
            <select id={`${uid}-status`} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputCls} style={border}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          {/* Logo (0057) : fourni par l'organisation, affiché partout
              où elle apparaît. Seulement en modification — le chemin
              de stockage porte l'identifiant de l'organisation. */}
          {org && logosReady && (
            <div>
              <div className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Logo</div>
              <div className="flex items-center gap-3">
                {form.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logo_url} alt={`Logo ${form.name}`} className="w-10 h-10 rounded-lg object-contain border" style={border} />
                ) : (
                  <div className="w-10 h-10 rounded-lg border grid place-items-center text-[10px]" style={{ ...border, color: "#9AA39D" }}>—</div>
                )}
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium cursor-pointer"
                  style={{ ...border, color: "#17211D" }}>
                  <Upload size={14} aria-hidden="true" /> {uploading ? "…" : "Choisir un logo"}
                  <input type="file" accept="image/*" className="sr-only" disabled={uploading}
                    onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
                </label>
              </div>
              <p className="text-xs mt-1" style={{ color: "#66716B" }}>
                Fourni par l&apos;organisation (PNG, JPG ou SVG, 1 Mo max) — enregistrez pour l&apos;appliquer.
              </p>
            </div>
          )}
          <ErrorMessage>{error}</ErrorMessage>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ ...border, color: "#66716B" }}>Annuler</button>
            <button type="submit" disabled={pending} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending ? 0.7 : 1 }}>
              {pending ? "…" : org ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}

export function DeleteOrgButton({ org }: { org: OrgData }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  return (
    <>
      <button onClick={() => setOpen(true)} className="p-1.5 rounded-full hover:bg-red-50"
        aria-label={`Supprimer l'organisation ${org.name}`} title="Supprimer">
        <Trash2 size={14} style={{ color: "#A3342C" }} aria-hidden="true" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} busy={pending} maxWidth="max-w-md" title="Supprimer l'organisation">
        <>
          <p className="text-sm mb-4" style={{ color: "#17211D" }}>
            Supprimer <span className="font-semibold">« {org.name} »</span> ? Cette action est définitive.
          </p>
          {error && <div className="mb-3"><ErrorMessage>{error}</ErrorMessage></div>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ ...border, color: "#66716B" }}>Annuler</button>
            <button
              onClick={() => startTransition(async () => { const r = await deleteOrganization(org.id); if (r.ok) setOpen(false); else setError(r.error ?? "Erreur") })}
              disabled={pending}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "#A3342C", opacity: pending ? 0.7 : 1 }}>
              {pending ? "…" : "Supprimer définitivement"}
            </button>
          </div>
        </>
      </Modal>
    </>
  )
}

// Crée un compte utilisateur à partir de l'email de l'organisation
export function CreateUserButton({ email, orgName }: { email: string; orgName: string }) {
  const uid = useId()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [password, setPassword] = useState("")
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()
  const [fullName, setFullName] = useState(orgName)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const res = await createUserAccount({ email, fullName })
      if (res.ok && res.password) setPassword(res.password)
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  function close() { setOpen(false); setPassword(""); setError(""); setCopied(false); setFullName(orgName) }

  return (
    <>
      <button onClick={() => setOpen(true)} className="p-1.5 rounded-full hover:bg-gray-100"
        aria-label={`Créer un compte pour ${email}`} title={`Créer un compte pour ${email}`}>
        <UserPlus size={14} style={{ color: "var(--brand-accent,#0E6B5C)" }} aria-hidden="true" />
      </button>
      <Modal open={open} onClose={close} busy={pending} maxWidth="max-w-md" title="Créer un compte utilisateur">
        {password ? (
          <div>
            <p className="text-sm mb-3" role="status" aria-live="polite" style={{ color: "#17211D" }}>
              Compte créé pour <span className="font-mono">{email}</span>. Communiquez ce mot de passe temporaire à la personne — elle pourra le changer dans ses Préférences.
            </p>
            <div className="flex items-center gap-2 rounded-xl p-3 mb-4" style={{ background: "#F5F6F4" }}>
              <span className="font-mono text-sm flex-1" style={{ color: "#17211D" }}>{password}</span>
              <button onClick={() => { navigator.clipboard.writeText(password); setCopied(true) }} className="p-1.5 rounded hover:bg-gray-200"
                aria-label="Copier le mot de passe temporaire" title="Copier">
                {copied ? <Check size={15} style={{ color: "var(--brand-accent,#0E6B5C)" }} aria-hidden="true" /> : <Copy size={15} style={{ color: "#66716B" }} aria-hidden="true" />}
              </button>
            </div>
            <div className="flex justify-end">
              <button onClick={close} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "var(--brand-accent,#0E6B5C)" }}>Terminé</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <p className="text-xs" style={{ color: "#66716B" }}>
              Crée un accès directement (sans email d&apos;invitation). Un mot de passe temporaire vous sera affiché à transmettre.
            </p>
            <div>
              <label htmlFor={`${uid}-email`} className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Email</label>
              <input id={`${uid}-email`} value={email} readOnly className={inputCls} style={{ ...border, background: "#F5F6F4" }} />
            </div>
            <div>
              <label htmlFor={`${uid}-name`} className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Nom de la personne *</label>
              <input id={`${uid}-name`} value={fullName} onChange={e => setFullName(e.target.value)} required className={inputCls} style={border} />
            </div>
            <ErrorMessage>{error}</ErrorMessage>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={close} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ ...border, color: "#66716B" }}>Annuler</button>
              <button type="submit" disabled={pending} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending ? 0.7 : 1 }}>
                {pending ? "…" : "Créer le compte"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  )
}
