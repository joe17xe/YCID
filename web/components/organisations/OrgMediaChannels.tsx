"use client"
import { useState, useTransition } from "react"
import { Megaphone, Plus, Pencil, Trash2, X } from "lucide-react"
import { MEDIA_CHANNEL_KINDS, MEDIA_CHANNEL_LANGUAGES } from "@/lib/constants"
import type { MediaChannelKind, MediaChannelLanguage, OrgMediaChannel } from "@/lib/types"
import { createMediaChannel, updateMediaChannel, deleteMediaChannel, type MediaChannelInput } from "@/app/(app)/organisations/actions"

interface OrgRow {
  id: string
  name: string
}

const EMPTY_FORM: MediaChannelInput = {
  kind: "facebook",
  name: "",
  url: "",
  language: "fr",
  tone: "",
  audience: "",
  signature: "",
  active: true,
}

function ChannelForm({ initial, pending, onSubmit, onCancel }: {
  initial: MediaChannelInput
  pending: boolean
  onSubmit: (input: MediaChannelInput) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<MediaChannelInput>(initial)
  const set = (patch: Partial<MediaChannelInput>) => setForm(f => ({ ...f, ...patch }))
  const input = "w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
  const label = "block text-xs font-medium mb-1"

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit(form) }}
      className="rounded-xl border p-4 mt-3"
      style={{ borderColor: "#E3E6E2", background: "#F5F6F4" }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={label} style={{ color: "#17211D" }}>Type</label>
          <select value={form.kind} onChange={e => set({ kind: e.target.value as MediaChannelKind })}
            className={input} style={{ borderColor: "#E3E6E2", background: "#fff" }}>
            {Object.entries(MEDIA_CHANNEL_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className={label} style={{ color: "#17211D" }}>Nom du canal</label>
          <input value={form.name} onChange={e => set({ name: e.target.value })} required
            placeholder="ex. Page Facebook LEY" className={input} style={{ borderColor: "#E3E6E2" }} />
        </div>
        <div>
          <label className={label} style={{ color: "#17211D" }}>URL (optionnel)</label>
          <input value={form.url ?? ""} onChange={e => set({ url: e.target.value })}
            placeholder="https://…" className={input} style={{ borderColor: "#E3E6E2" }} />
        </div>
        <div>
          <label className={label} style={{ color: "#17211D" }}>Langue</label>
          <select value={form.language} onChange={e => set({ language: e.target.value as MediaChannelLanguage })}
            className={input} style={{ borderColor: "#E3E6E2", background: "#fff" }}>
            {Object.entries(MEDIA_CHANNEL_LANGUAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className={label} style={{ color: "#17211D" }}>Ton</label>
          <input value={form.tone ?? ""} onChange={e => set({ tone: e.target.value })}
            placeholder="ex. chaleureux, grand public" className={input} style={{ borderColor: "#E3E6E2" }} />
        </div>
        <div>
          <label className={label} style={{ color: "#17211D" }}>Audience</label>
          <input value={form.audience ?? ""} onChange={e => set({ audience: e.target.value })}
            placeholder="ex. habitants des Yvelines" className={input} style={{ borderColor: "#E3E6E2" }} />
        </div>
        <div>
          <label className={label} style={{ color: "#17211D" }}>Signature</label>
          <input value={form.signature ?? ""} onChange={e => set({ signature: e.target.value })}
            placeholder="mention de fin de contenu" className={input} style={{ borderColor: "#E3E6E2" }} />
        </div>
        <div className="flex items-end gap-2 pb-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "#17211D" }}>
            <input type="checkbox" checked={form.active ?? true} onChange={e => set({ active: e.target.checked })}
              className="accent-emerald-700" />
            Canal actif
          </label>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button type="submit" disabled={pending}
          className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
          style={{ background: "#0E6B5C", opacity: pending ? 0.7 : 1 }}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm font-medium border"
          style={{ borderColor: "#E3E6E2", color: "#66716B", background: "#fff" }}>
          Annuler
        </button>
      </div>
    </form>
  )
}

export default function OrgMediaChannels({ orgs, channels, manageableOrgIds }: {
  orgs: OrgRow[]
  channels: OrgMediaChannel[]
  manageableOrgIds: string[]
}) {
  const [openForm, setOpenForm] = useState<{ orgId: string; channel?: OrgMediaChannel } | null>(null)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const manageable = new Set(manageableOrgIds)
  const byOrg = new Map<string, OrgMediaChannel[]>()
  for (const ch of channels) {
    const list = byOrg.get(ch.org_id) ?? []
    list.push(ch)
    byOrg.set(ch.org_id, list)
  }
  // N'afficher que les organisations qui ont des canaux ou que l'on administre
  const visibleOrgs = orgs.filter(o => (byOrg.get(o.id)?.length ?? 0) > 0 || manageable.has(o.id))

  function submit(orgId: string, channel: OrgMediaChannel | undefined, input: MediaChannelInput) {
    setError("")
    startTransition(async () => {
      const res = channel ? await updateMediaChannel(channel.id, input) : await createMediaChannel(orgId, input)
      if (res.ok) setOpenForm(null)
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  function remove(channel: OrgMediaChannel) {
    if (!confirm(`Supprimer le canal « ${channel.name} » ?`)) return
    setError("")
    startTransition(async () => {
      const res = await deleteMediaChannel(channel.id)
      if (!res.ok) setError(res.error ?? "Une erreur est survenue.")
    })
  }

  return (
    <div className="bg-white rounded-2xl border p-6 mt-6" style={{ borderColor: "#E3E6E2" }}>
      <div className="flex items-center gap-2 mb-1">
        <Megaphone size={17} color="#0E6B5C" />
        <h2 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
          Canaux de communication
        </h2>
      </div>
      <p className="text-sm mb-4" style={{ color: "#66716B" }}>
        Chaque organisation paramètre ses supports de diffusion (page Facebook, newsletter, site web…).
        Ils serviront à proposer des contenus adaptés à chaque canal pour les réalisations du programme.
      </p>

      {error && <p className="mb-3 text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}

      <div className="space-y-3">
        {visibleOrgs.map(org => {
          const orgChannels = byOrg.get(org.id) ?? []
          const canManage = manageable.has(org.id)
          const isAdding = openForm?.orgId === org.id && !openForm.channel
          return (
            <div key={org.id} className="rounded-xl border p-4" style={{ borderColor: "#E3E6E2" }}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-sm font-medium" style={{ color: "#17211D" }}>{org.name}</span>
                {canManage && (
                  <button
                    onClick={() => { setError(""); setOpenForm(isAdding ? null : { orgId: org.id }) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: isAdding ? "#EEF0EE" : "#E4F0EC", color: isAdding ? "#66716B" : "#0E6B5C" }}
                  >
                    {isAdding ? <><X size={13} /> Fermer</> : <><Plus size={13} /> Ajouter un canal</>}
                  </button>
                )}
              </div>

              {orgChannels.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-3">
                  {orgChannels.map(ch => {
                    const kind = MEDIA_CHANNEL_KINDS[ch.kind] ?? { label: ch.kind, fg: "#66716B", bg: "#EEF0EE" }
                    const isEditing = openForm?.channel?.id === ch.id
                    return (
                      <span key={ch.id}
                        className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs"
                        style={{ background: kind.bg, color: kind.fg, opacity: ch.active ? 1 : 0.5 }}
                        title={[MEDIA_CHANNEL_LANGUAGES[ch.language], ch.tone, ch.audience].filter(Boolean).join(" · ")}
                      >
                        <span className="font-semibold">{kind.label}</span>
                        <span>· {ch.name}</span>
                        <span className="uppercase font-medium opacity-70">{ch.language}</span>
                        {!ch.active && <span className="italic">(inactif)</span>}
                        {canManage && (
                          <span className="inline-flex items-center gap-0.5 ml-1">
                            <button onClick={() => { setError(""); setOpenForm(isEditing ? null : { orgId: org.id, channel: ch }) }}
                              className="p-0.5 rounded hover:bg-white/60" title="Modifier" aria-label={`Modifier ${ch.name}`}>
                              <Pencil size={11} />
                            </button>
                            <button onClick={() => remove(ch)} disabled={pending}
                              className="p-0.5 rounded hover:bg-white/60" title="Supprimer" aria-label={`Supprimer ${ch.name}`}>
                              <Trash2 size={11} />
                            </button>
                          </span>
                        )}
                      </span>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs mt-2" style={{ color: "#66716B" }}>Aucun canal paramétré</p>
              )}

              {openForm?.orgId === org.id && (
                <ChannelForm
                  key={openForm.channel?.id ?? "new"}
                  initial={openForm.channel ? {
                    kind: openForm.channel.kind,
                    name: openForm.channel.name,
                    url: openForm.channel.url ?? "",
                    language: openForm.channel.language,
                    tone: openForm.channel.tone,
                    audience: openForm.channel.audience,
                    signature: openForm.channel.signature,
                    active: openForm.channel.active,
                  } : EMPTY_FORM}
                  pending={pending}
                  onSubmit={input => submit(org.id, openForm.channel, input)}
                  onCancel={() => setOpenForm(null)}
                />
              )}
            </div>
          )
        })}
        {!visibleOrgs.length && (
          <p className="text-sm" style={{ color: "#66716B" }}>Aucun canal de communication paramétré pour le moment.</p>
        )}
      </div>
    </div>
  )
}
