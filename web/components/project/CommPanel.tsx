"use client"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Megaphone, Sparkles, Plus, Copy, Check, X, Trash2 } from "lucide-react"
import {
  generateCommPlan, generateCampaignContents, updateCampaign,
  setCampaignStatus, createCampaign, deleteCampaign,
} from "@/app/(app)/projets/[id]/comm-actions"

// ============================================================
// PR 26 — Onglet Communication : timeline + campagnes + éditeur
// ============================================================

export interface CampaignBrief {
  channels: string[]
  audience: string
  objective: string
  tone: string
  keyMessage: string
}

export interface Campaign {
  id: string
  phase_id: string | null
  trigger_kind: string
  title: string
  scheduled_date: string | null
  responsible_id: string | null
  responsible_name?: string | null
  status: string
  languages: string[]
  contents: Record<string, Record<string, string>> | null
  checklist: Record<string, boolean>
  brief: CampaignBrief | null
  published_at: string | null
}

const STATUS_UI: Record<string, { label: string; fg: string; bg: string }> = {
  proposee: { label: "Proposée", fg: "#66716B", bg: "#EEF0EE" },
  brouillon: { label: "Brouillon", fg: "#B4690E", bg: "#F7EDDD" },
  validee: { label: "Validée", fg: "#3B5488", bg: "#E8ECF5" },
  publiee: { label: "Publiée", fg: "var(--brand-accent,#0E6B5C)", bg: "var(--brand-accent-soft,#E4F0EC)" },
  annulee: { label: "Annulée", fg: "#A3342C", bg: "#F6E7E5" },
}
const TRIGGER_LABEL: Record<string, string> = {
  kickoff: "🚀 Lancement", phase: "✅ Réalisation", objectif: "🎯 Objectif", cloture: "🏁 Bilan", manuelle: "✍️ Manuelle",
}
const CHANNELS: Array<{ key: string; label: string }> = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "facebook", label: "Facebook" },
  { key: "communique", label: "Communiqué de presse" },
  { key: "newsletter", label: "Newsletter" },
  { key: "affiche", label: "Affiche / visuel" },
  { key: "bulletin", label: "Bulletin municipal" },
]
const AUDIENCES = ["Élus du Département", "Financeur (MEAE, YCID)", "Grand public yvelinois", "Presse locale", "Diaspora libanaise", "Bénévoles et adhérents"]
const OBJECTIVES = ["Informer de l'avancement", "Valoriser un résultat", "Remercier les partenaires", "Mobiliser / recruter", "Annoncer un événement"]
const TONES = ["Institutionnel", "Chaleureux", "Factuel", "Inspirant"]
// Pré-réglages selon le moment du projet : le brief est pré-rempli,
// l'utilisateur ajuste au lieu de partir d'une page blanche.
const BRIEF_PRESETS: Record<string, Partial<CampaignBrief>> = {
  kickoff: { channels: ["linkedin", "facebook", "communique"], audience: "Élus du Département", objective: "Annoncer un événement", tone: "Institutionnel" },
  phase: { channels: ["linkedin", "facebook"], audience: "Grand public yvelinois", objective: "Valoriser un résultat", tone: "Chaleureux" },
  cloture: { channels: ["linkedin", "communique"], audience: "Financeur (MEAE, YCID)", objective: "Valoriser un résultat", tone: "Institutionnel" },
  objectif: { channels: ["linkedin", "facebook"], audience: "Grand public yvelinois", objective: "Valoriser un résultat", tone: "Inspirant" },
  manuelle: { channels: ["linkedin", "facebook", "communique"], audience: "", objective: "", tone: "Factuel" },
}
const LANG_LABEL: Record<string, string> = { fr: "Français", en: "English", ar: "العربية" }
const CHECKLIST_ITEMS: Array<{ key: string; label: string }> = [
  { key: "chiffres_ok", label: "Les chiffres et faits cités sont vérifiés" },
  { key: "mentions_ok", label: "Mentions du financeur (CEM / YCID) présentes" },
  { key: "images_ok", label: "Droits à l'image et dignité des personnes respectés" },
]

function fmtD(d: string | null): string {
  if (!d) return "—"
  return new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

// Frise horizontale (desktop) : ● publiée · ○ planifiée · rouge = en
// retard. Les libellés alternent sur deux niveaux et la largeur s'adapte
// au nombre de campagnes, pour rester lisibles quand les dates sont
// proches (elles se chevauchaient auparavant).
function HorizontalTimeline({ campaigns }: { campaigns: Campaign[] }) {
  const today = new Date().toISOString().slice(0, 10)
  const dated = campaigns
    .filter(c => c.scheduled_date && c.status !== "annulee")
    .sort((a, b) => a.scheduled_date!.localeCompare(b.scheduled_date!))
  if (dated.length === 0) return null
  const dates = [...dated.map(c => c.scheduled_date!), today].sort()
  const min = new Date(dates[0]).getTime(), max = new Date(dates[dates.length - 1]).getTime()
  const span = Math.max(max - min, 1)
  const pos = (d: string) => 4 + ((new Date(d).getTime() - min) / span) * 92 // 4-96 %
  // ~150 px par campagne : garantit la place des libellés (défilement sinon)
  const width = Math.max(600, dated.length * 150)

  return (
    <div className="bg-white rounded-2xl border p-5 mb-4 overflow-x-auto" style={{ borderColor: "#E3E6E2" }}>
      <div className="relative h-28" style={{ minWidth: width }}>
        <div className="absolute left-0 right-0 top-5 h-0.5" style={{ background: "#E3E6E2" }} />
        {/* Marqueur aujourd'hui */}
        <div className="absolute top-1.5 bottom-2 w-px" style={{ left: `${pos(today)}%`, background: "#17211D" }}>
          <span className="absolute -top-1 left-1 text-[10px] whitespace-nowrap" style={{ color: "#17211D" }}>auj.</span>
        </div>
        {dated.map((c, i) => {
          const late = c.scheduled_date! < today && c.status !== "publiee"
          const filled = c.status === "publiee"
          const color = late ? "#A3342C" : "var(--brand-accent,#0E6B5C)"
          // Alternance haut/bas des libellés : évite tout chevauchement
          const offset = i % 2 === 0 ? 30 : 68
          return (
            <div key={c.id} className="absolute" style={{ left: `${pos(c.scheduled_date!)}%`, top: 0 }} title={`${c.title} — ${fmtD(c.scheduled_date)}`}>
              <div className="w-3.5 h-3.5 rounded-full border-2 -translate-x-1/2 mt-[13px]"
                style={{ borderColor: color, background: filled ? color : "#fff" }} />
              {/* Trait de rappel jusqu'au libellé décalé */}
              <div className="absolute w-px -translate-x-1/2 left-0" style={{ top: 27, height: offset - 27, background: "#E3E6E2" }} />
              <div className="absolute -translate-x-1/2 w-32 text-center leading-tight" style={{ top: offset }}>
                <div className="text-[10px] truncate" style={{ color: late ? "#A3342C" : "#17211D" }}>{c.title}</div>
                <div className="text-[10px]" style={{ color: "#66716B" }}>{fmtD(c.scheduled_date)}</div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-4 text-[11px] mt-1" style={{ color: "#66716B" }}>
        <span>● publiée</span><span>○ planifiée</span><span style={{ color: "#A3342C" }}>○ en retard</span>
      </div>
    </div>
  )
}

// Frise VERTICALE (mobile) : une frise horizontale qui défile est
// inutilisable au pouce. Même sémantique, lecture de haut en bas.
// Repère « aujourd'hui » de la frise verticale (hors composant parent :
// un composant déclaré pendant le rendu perdrait son état à chaque passe)
function TodayMarker() {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-3.5 flex justify-center flex-shrink-0">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#17211D" }} />
      </div>
      <span className="text-xs font-semibold" style={{ color: "#17211D" }}>aujourd&apos;hui</span>
    </div>
  )
}

function VerticalTimeline({ campaigns }: { campaigns: Campaign[] }) {
  const today = new Date().toISOString().slice(0, 10)
  const dated = campaigns
    .filter(c => c.scheduled_date && c.status !== "annulee")
    .sort((a, b) => a.scheduled_date!.localeCompare(b.scheduled_date!))
  if (dated.length === 0) return null
  // Position du repère « aujourd'hui » dans la suite chronologique
  const todayIndex = dated.findIndex(c => c.scheduled_date! > today)

  return (
    <div className="bg-white rounded-2xl border p-5 mb-4" style={{ borderColor: "#E3E6E2" }}>
      <div className="relative">
        {/* Ligne de temps verticale */}
        <div className="absolute top-1 bottom-1 w-px" style={{ left: 7, background: "#E3E6E2" }} />
        <div className="relative space-y-3">
          {dated.map((c, i) => {
            const late = c.scheduled_date! < today && c.status !== "publiee"
            const filled = c.status === "publiee"
            const color = late ? "#A3342C" : "var(--brand-accent,#0E6B5C)"
            const st = STATUS_UI[c.status] ?? STATUS_UI.proposee
            return (
              <div key={c.id}>
                {i === todayIndex && <TodayMarker />}
                <div className="flex items-start gap-3">
                  <div className="w-3.5 flex justify-center flex-shrink-0 mt-1">
                    <div className="w-3.5 h-3.5 rounded-full border-2"
                      style={{ borderColor: color, background: filled ? color : "#fff" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-snug" style={{ color: late ? "#A3342C" : "#17211D" }}>{c.title}</div>
                    <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: "#66716B" }}>
                      {fmtD(c.scheduled_date)}
                      <span className="px-2 py-0.5 rounded-full font-medium" style={{ color: st.fg, background: st.bg }}>{st.label}</span>
                      {late && <span style={{ color: "#A3342C" }}>en retard</span>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {/* Toutes les campagnes sont passées : le repère ferme la frise */}
          {todayIndex === -1 && <TodayMarker />}
        </div>
      </div>
    </div>
  )
}

// Verticale sur mobile, horizontale à partir de md
function Timeline({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <>
      <div className="md:hidden"><VerticalTimeline campaigns={campaigns} /></div>
      <div className="hidden md:block"><HorizontalTimeline campaigns={campaigns} /></div>
    </>
  )
}

export default function CommPanel({ projectId, campaigns, members, canManage, userId }: {
  projectId: string
  campaigns: Campaign[]
  members: Array<{ id: string; name: string }>
  canManage: boolean
  userId: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newDate, setNewDate] = useState("")

  const sorted = useMemo(() =>
    [...campaigns].sort((a, b) => (a.scheduled_date ?? "9999").localeCompare(b.scheduled_date ?? "9999")), [campaigns])
  const open = sorted.find(c => c.id === openId) ?? null

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(key); setError("")
    const res = await fn()
    if (!res.ok) setError(res.error ?? "Une erreur est survenue.")
    setBusy(""); router.refresh()
  }

  return (
    <div>
      {/* Actions d'en-tête */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {canManage && (
          <button onClick={() => run("plan", () => generateCommPlan(projectId))} disabled={!!busy}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
            style={{ background: "var(--brand-accent,#0E6B5C)", opacity: busy === "plan" ? 0.7 : 1 }}>
            <Sparkles size={15} /> {busy === "plan" ? "…" : "Générer le plan de communication"}
          </button>
        )}
        {canManage && (
          <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: "#E3E6E2", color: "#17211D" }}>
            <Plus size={15} /> Nouvelle campagne
          </button>
        )}
      </div>
      {error && !open && <p className="text-sm rounded-lg px-3 py-2 mb-3" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}

      <Timeline campaigns={sorted} />

      {/* Liste */}
      {sorted.length === 0 ? (
        <div className="bg-white rounded-2xl border p-8 text-center" style={{ borderColor: "#E3E6E2" }}>
          <Megaphone size={28} className="mx-auto mb-3" style={{ color: "#66716B" }} />
          <p className="text-sm" style={{ color: "#66716B" }}>
            Aucune campagne. {canManage ? "Générez le plan de communication : lancement, fins de phase et bilan seront proposés automatiquement." : "Le chef de projet peut générer le plan de communication."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border divide-y" style={{ borderColor: "#E3E6E2" }}>
          {sorted.map(c => {
            const st = STATUS_UI[c.status] ?? STATUS_UI.proposee
            return (
              <button key={c.id} onClick={() => { setOpenId(c.id); setError("") }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
                <span className="text-xs w-24 flex-shrink-0" style={{ color: "#66716B" }}>{fmtD(c.scheduled_date)}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate" style={{ color: "#17211D" }}>{c.title}</span>
                  <span className="block text-xs" style={{ color: "#66716B" }}>
                    {TRIGGER_LABEL[c.trigger_kind] ?? c.trigger_kind} · {c.responsible_name ?? "sans responsable"}
                  </span>
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0" style={{ color: st.fg, background: st.bg }}>{st.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Dialogue création manuelle */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCreating(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold mb-4" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Nouvelle campagne</h3>
            <label className="block text-xs font-semibold mb-1 tracking-wider" style={{ color: "#66716B" }}>TITRE</label>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border text-sm mb-3" style={{ borderColor: "#E3E6E2" }} />
            <label className="block text-xs font-semibold mb-1 tracking-wider" style={{ color: "#66716B" }}>DATE PRÉVUE</label>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border text-sm mb-4" style={{ borderColor: "#E3E6E2" }} />
            <div className="flex gap-2">
              <button onClick={() => run("create", async () => { const r = await createCampaign(projectId, { title: newTitle, scheduled_date: newDate }); if (r.ok) { setCreating(false); setNewTitle(""); setNewDate("") } return r })}
                disabled={!!busy} className="px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: "var(--brand-accent,#0E6B5C)" }}>
                Créer
              </button>
              <button onClick={() => setCreating(false)} className="text-sm underline" style={{ color: "#66716B" }}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Éditeur de campagne */}
      {open && (
        <CampaignEditor key={open.id} campaign={open} members={members} canManage={canManage} userId={userId}
          busy={busy} error={error} run={run} onClose={() => { setOpenId(null); setError("") }} />
      )}
    </div>
  )
}

function CampaignEditor({ campaign, members, canManage, userId, busy, error, run, onClose }: {
  campaign: Campaign
  members: Array<{ id: string; name: string }>
  canManage: boolean
  userId: string
  busy: string
  error: string
  run: (key: string, fn: () => Promise<{ ok: boolean; error?: string }>) => Promise<void>
  onClose: () => void
}) {
  const canEdit = canManage || campaign.responsible_id === userId
  const [title, setTitle] = useState(campaign.title)
  const [date, setDate] = useState(campaign.scheduled_date ?? "")
  const [responsible, setResponsible] = useState(campaign.responsible_id ?? "")
  const [langs, setLangs] = useState<string[]>(campaign.languages ?? ["fr"])
  const [contents, setContents] = useState(campaign.contents)
  const [checklist, setChecklist] = useState<Record<string, boolean>>(campaign.checklist ?? {})
  const preset = BRIEF_PRESETS[campaign.trigger_kind] ?? BRIEF_PRESETS.manuelle
  const [brief, setBrief] = useState<CampaignBrief>({
    channels: campaign.brief?.channels ?? preset.channels ?? ["linkedin", "facebook", "communique"],
    audience: campaign.brief?.audience ?? preset.audience ?? "",
    objective: campaign.brief?.objective ?? preset.objective ?? "",
    tone: campaign.brief?.tone ?? preset.tone ?? "Institutionnel",
    keyMessage: campaign.brief?.keyMessage ?? "",
  })
  const [activeLang, setActiveLang] = useState((campaign.languages ?? ["fr"])[0] ?? "fr")
  const [copied, setCopied] = useState("")
  const st = STATUS_UI[campaign.status] ?? STATUS_UI.proposee
  const checklistOk = CHECKLIST_ITEMS.every(i => checklist[i.key])

  async function copy(key: string, text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(key); setTimeout(() => setCopied(""), 1500)
  }
  const save = () => run("save", () => updateCampaign(campaign.id, {
    title, scheduled_date: date || null, responsible_id: responsible || null,
    languages: langs, contents, checklist, brief,
  }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#E3E6E2" }}>
          <div className="flex items-center gap-2 min-w-0">
            <Megaphone size={18} style={{ color: "var(--brand-accent,#0E6B5C)" }} />
            <span className="font-bold truncate" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{campaign.title}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0" style={{ color: st.fg, background: st.bg }}>{st.label}</span>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-1.5 rounded-lg hover:bg-gray-50" style={{ color: "#66716B" }}><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Métadonnées */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold mb-1 tracking-wider" style={{ color: "#66716B" }}>TITRE</label>
              <input value={title} onChange={e => setTitle(e.target.value)} disabled={!canEdit} className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "#E3E6E2" }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 tracking-wider" style={{ color: "#66716B" }}>DATE PRÉVUE</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={!canEdit} className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "#E3E6E2" }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 tracking-wider" style={{ color: "#66716B" }}>RESPONSABLE</label>
              <select value={responsible} onChange={e => setResponsible(e.target.value)} disabled={!canManage} className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "#E3E6E2" }}>
                <option value="">—</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 tracking-wider" style={{ color: "#66716B" }}>LANGUES</label>
              <div className="flex gap-1.5 pt-1.5">
                {Object.entries(LANG_LABEL).map(([code]) => (
                  <button key={code} type="button" disabled={!canEdit}
                    onClick={() => setLangs(l => l.includes(code) ? l.filter(x => x !== code) : [...l, code])}
                    className="px-2.5 py-1 rounded-lg border text-xs font-semibold uppercase"
                    style={{
                      background: langs.includes(code) ? "var(--brand-accent-soft,#E4F0EC)" : "#fff",
                      borderColor: langs.includes(code) ? "var(--brand-accent,#0E6B5C)" : "#E3E6E2",
                      color: langs.includes(code) ? "var(--brand-accent,#0E6B5C)" : "#66716B",
                    }}>{code}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Brief : sans lui, l'IA ne peut produire qu'un texte générique */}
          <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "#E3E6E2" }}>
            <div className="text-xs font-semibold tracking-wider" style={{ color: "#66716B" }}>BRIEF DE COMMUNICATION</div>
            <div>
              <span className="block text-xs mb-1.5" style={{ color: "#66716B" }}>Canaux à produire</span>
              <div className="flex flex-wrap gap-1.5">
                {CHANNELS.map(ch => {
                  const on = brief.channels.includes(ch.key)
                  return (
                    <button key={ch.key} type="button" disabled={!canEdit} aria-pressed={on}
                      onClick={() => setBrief(b => ({ ...b, channels: on ? b.channels.filter(c => c !== ch.key) : [...b.channels, ch.key] }))}
                      className="px-2.5 py-1 rounded-lg border text-xs font-medium"
                      style={{
                        background: on ? "var(--brand-accent,#0E6B5C)" : "#fff",
                        borderColor: on ? "var(--brand-accent,#0E6B5C)" : "#E3E6E2",
                        color: on ? "#fff" : "#66716B",
                      }}>{ch.label}</button>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: "#66716B" }}>Audience</label>
                <input list="comm-audiences" value={brief.audience} disabled={!canEdit}
                  onChange={e => setBrief(b => ({ ...b, audience: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "#E3E6E2" }} />
                <datalist id="comm-audiences">{AUDIENCES.map(a => <option key={a} value={a} />)}</datalist>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "#66716B" }}>Objectif</label>
                <input list="comm-objectives" value={brief.objective} disabled={!canEdit}
                  onChange={e => setBrief(b => ({ ...b, objective: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "#E3E6E2" }} />
                <datalist id="comm-objectives">{OBJECTIVES.map(o => <option key={o} value={o} />)}</datalist>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "#66716B" }}>Ton</label>
                <select value={brief.tone} disabled={!canEdit}
                  onChange={e => setBrief(b => ({ ...b, tone: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "#E3E6E2" }}>
                  {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "#66716B" }}>Message clé / appel à l&apos;action</label>
              <textarea rows={2} value={brief.keyMessage} disabled={!canEdit}
                onChange={e => setBrief(b => ({ ...b, keyMessage: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "#E3E6E2" }}
                placeholder="Ex. : remercier la municipalité de Jeïta et inviter à la visite du 12 septembre." />
            </div>
            <p className="text-xs" style={{ color: "#66716B" }}>
              Enregistrez le brief avant de générer : il oriente le style, la longueur et l&apos;angle de chaque contenu.
            </p>
          </div>

          {/* Génération + contenus */}
          {canEdit && (
            <button onClick={() => run("gen", () => generateCampaignContents(campaign.id))} disabled={!!busy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
              style={{ background: "var(--brand-accent,#0E6B5C)", opacity: busy === "gen" ? 0.7 : 1 }}>
              <Sparkles size={15} /> {busy === "gen" ? "Génération en cours…" : contents ? "Régénérer les contenus IA" : "Générer les contenus IA"}
            </button>
          )}

          {contents && (
            <div>
              <div className="flex gap-1 mb-2">
                {langs.filter(l => contents[l]).map(l => (
                  <button key={l} onClick={() => setActiveLang(l)} className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{
                      background: activeLang === l ? "var(--brand-accent-soft,#E4F0EC)" : "#EEF0EE",
                      color: activeLang === l ? "var(--brand-accent,#0E6B5C)" : "#66716B",
                    }}>{LANG_LABEL[l] ?? l}</button>
                ))}
              </div>
              <div className="space-y-3">
                {CHANNELS.filter(ch => contents[activeLang]?.[ch.key] !== undefined || brief.channels.includes(ch.key)).map(ch => (
                  <div key={ch.key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold tracking-wider" style={{ color: "#66716B" }}>{ch.label.toUpperCase()}</label>
                      <button onClick={() => copy(`${activeLang}-${ch.key}`, contents[activeLang]?.[ch.key] ?? "")}
                        className="flex items-center gap-1 text-xs underline" style={{ color: "var(--brand-accent,#0E6B5C)" }}>
                        {copied === `${activeLang}-${ch.key}` ? <><Check size={12} /> Copié</> : <><Copy size={12} /> Copier</>}
                      </button>
                    </div>
                    <textarea rows={4} dir={activeLang === "ar" ? "rtl" : "ltr"} disabled={!canEdit}
                      value={contents[activeLang]?.[ch.key] ?? ""}
                      onChange={e => setContents(c => ({ ...(c ?? {}), [activeLang]: { ...(c?.[activeLang] ?? {}), [ch.key]: e.target.value } }))}
                      className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "#E3E6E2" }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Check-list éthique */}
          <div className="rounded-xl border p-4" style={{ borderColor: "#E3E6E2", background: "#FAFBFA" }}>
            <div className="text-xs font-semibold tracking-wider mb-2" style={{ color: "#66716B" }}>CHECK-LIST AVANT VALIDATION</div>
            {CHECKLIST_ITEMS.map(item => (
              <label key={item.key} className="flex items-start gap-2 py-1 cursor-pointer">
                <input type="checkbox" checked={!!checklist[item.key]} disabled={!canEdit}
                  onChange={e => setChecklist(c => ({ ...c, [item.key]: e.target.checked }))} className="mt-0.5" />
                <span className="text-sm" style={{ color: "#17211D" }}>{item.label}</span>
              </label>
            ))}
          </div>

          {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-6 py-4 border-t flex-wrap" style={{ borderColor: "#E3E6E2" }}>
          {canEdit && (
            <button onClick={save} disabled={!!busy} className="px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: "var(--brand-accent,#0E6B5C)" }}>
              {busy === "save" ? "…" : "Enregistrer"}
            </button>
          )}
          {canEdit && campaign.status !== "publiee" && campaign.status !== "validee" && (
            <button onClick={() => run("st", () => setCampaignStatus(campaign.id, "validee"))} disabled={!!busy || !checklistOk || !contents}
              title={!checklistOk ? "Complétez la check-list éthique" : undefined}
              className="px-4 py-2 rounded-xl border text-sm font-semibold" style={{ borderColor: "#3B5488", color: "#3B5488", opacity: (!checklistOk || !contents) ? 0.5 : 1 }}>
              Valider
            </button>
          )}
          {canEdit && campaign.status === "validee" && (
            <button onClick={() => run("st", () => setCampaignStatus(campaign.id, "publiee"))} disabled={!!busy}
              className="px-4 py-2 rounded-xl border text-sm font-semibold" style={{ borderColor: "var(--brand-accent,#0E6B5C)", color: "var(--brand-accent,#0E6B5C)" }}>
              Marquer publiée
            </button>
          )}
          <span className="ml-auto" />
          {canEdit && campaign.status !== "annulee" && (
            <button onClick={() => run("st", () => setCampaignStatus(campaign.id, "annulee"))} disabled={!!busy} className="text-xs underline" style={{ color: "#66716B" }}>
              Annuler la campagne
            </button>
          )}
          {canManage && (
            <button onClick={() => run("del", async () => { const r = await deleteCampaign(campaign.id); if (r.ok) onClose(); return r })}
              disabled={!!busy} className="flex items-center gap-1 text-xs underline" style={{ color: "#A3342C" }}>
              <Trash2 size={12} /> Supprimer
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
