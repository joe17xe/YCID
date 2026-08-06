"use client"
import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Download, Trash2, Archive, FilterX } from "lucide-react"
import Modal, { ErrorMessage } from "@/components/ui/Modal"
import { DOC_TYPE_LABELS, DOC_MOMENT_LABELS, type DocType, type DocMoment } from "@/lib/documents"
import {
  getDocumentUrl, getDocumentUrls, deleteDocument, getDocumentPurgeState,
} from "@/app/(app)/projets/[id]/document-actions"

// ============================================================
// PR 38d — Zone documentaire centralisée
// ============================================================
// Demande explicite : accéder à l'ensemble des pièces du projet en un
// seul endroit. Jusqu'ici elles n'étaient consultables que là où elles
// avaient été déposées — sur une tâche, sur une ligne, sur une phase —
// ce qui rendait impossible la question « qu'est-ce qu'on a comme
// justificatifs sur ce projet ? ».

export interface ProjectDoc {
  id: string
  filename: string
  type: DocType
  moment: DocMoment | null
  amount: number | null
  paid: boolean
  uploadedAt: string
  uploaderName: string | null
  phaseName: string | null
  taskTitle: string | null
  lineposte: string | null
}

// Date locale au format AAAA-MM-JJ. Indispensable pour que l'AFFICHAGE
// et le FILTRE reposent sur la même base : le filtre découpait
// auparavant la chaîne ISO (donc en UTC) tandis que l'affichage
// convertissait en heure locale. Passé 22 h à Paris, les deux
// divergeaient d'un jour — une pièce affichée au 26/07 restait
// introuvable avec « depuis le 26/07 ».
function localDay(d: string): string {
  const dt = new Date(d)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}
const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR")
const fmtEur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`

export default function DocumentsPanel({ projectId, projectName, docs, canManage }: {
  projectId: string; projectName: string; docs: ProjectDoc[]; canManage: boolean
}) {
  const router = useRouter()
  const [type, setType] = useState("")
  const [phase, setPhase] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [progress, setProgress] = useState("")
  const [pending, startTransition] = useTransition()

  // ------------------------------------------------------------
  // Ce que cette vue ne sait pas d'elle-même
  // ------------------------------------------------------------
  // `ProjectDoc` porte le nom, la nature, le montant — pas les
  // validations : la vue centralisée liste des pièces, elle n'affiche pas
  // de circuit. Elle ne peut donc pas deviner qu'un devis a été refusé,
  // ni qu'à ce titre il n'est plus supprimable (0051). Sans cette
  // réponse, la corbeille serait proposée sur des pièces que la base
  // garde — un bouton mort par ligne, sur la vue qui en compte le plus.
  //
  // Un seul aller-retour, à l'affichage du panneau, qui rapporte aussi
  // qui a le droit de purger : les deux réponses ne servent qu'à une
  // seule décision d'affichage.
  const [purgeState, setPurgeState] = useState<{ canPurge: boolean; decidedIds: string[] } | null>(null)
  // La pièce dont la purge a été demandée, et la phrase que le SERVEUR a
  // renvoyée pour la décrire — jamais une phrase reconstituée ici.
  const [purging, setPurging] = useState<{ doc: ProjectDoc; message: string } | null>(null)
  const [purgeError, setPurgeError] = useState("")

  useEffect(() => {
    let alive = true
    getDocumentPurgeState(projectId)
      .then(s => { if (alive) setPurgeState(s) })
      // En cas d'échec on reste sur `null`, c'est-à-dire sur le
      // comportement d'avant : la corbeille s'affiche et c'est le serveur
      // qui tranche. Mieux vaut un refus expliqué qu'une action escamotée
      // par un incident réseau.
      .catch(() => { /* état inconnu : on n'escamote rien */ })
    return () => { alive = false }
  }, [projectId])

  const isDecided = (d: ProjectDoc) => !!purgeState?.decidedIds.includes(d.id)

  const phases = useMemo(
    () => Array.from(new Set(docs.map(d => d.phaseName).filter(Boolean))).sort() as string[],
    [docs])
  const types = useMemo(
    () => Array.from(new Set(docs.map(d => d.type))).sort(),
    [docs])

  const filtered = useMemo(() => docs.filter(d => {
    if (type && d.type !== type) return false
    if (phase && d.phaseName !== phase) return false
    if (from && localDay(d.uploadedAt) < from) return false
    if (to && localDay(d.uploadedAt) > to) return false
    if (query) {
      // Une seule zone de recherche sur nom, tâche et poste : trois
      // champs séparés obligeraient à savoir OÙ la pièce a été déposée,
      // ce qui est précisément l'information qui manque.
      const hay = `${d.filename} ${d.taskTitle ?? ""} ${d.lineposte ?? ""}`.toLowerCase()
      if (!hay.includes(query.toLowerCase())) return false
    }
    return true
  }), [docs, type, phase, from, to, query])

  const hasFilter = !!(type || phase || from || to || query)
  function reset() { setType(""); setPhase(""); setFrom(""); setTo(""); setQuery("") }

  async function download(id: string) {
    const res = await getDocumentUrl(id)
    if (res.ok && res.url) window.open(res.url, "_blank", "noopener")
    else setError(res.error ?? "Lien indisponible.")
  }

  // L'archive est assemblée DANS le navigateur : les fichiers ne
  // transitent pas par le serveur Next, qui n'a de toute façon pas à
  // recopier des pièces déjà accessibles à l'utilisateur.
  async function downloadZip() {
    setError(""); setBusy(true); setProgress("Préparation…")
    try {
      const res = await getDocumentUrls({ projectId, documentIds: filtered.map(d => d.id) })
      if (!res.ok || !res.files) { setError(res.error ?? "Échec."); setBusy(false); setProgress(""); return }

      const JSZip = (await import("jszip")).default
      const zip = new JSZip()
      const used = new Set<string>()
      let done = 0
      for (const f of res.files) {
        setProgress(`Téléchargement ${++done}/${res.files.length}…`)
        const r = await fetch(f.url)
        if (!r.ok) continue
        // Deux pièces peuvent porter le même nom : sans dédoublonnage,
        // la seconde écraserait la première dans l'archive en silence.
        let name = f.filename
        for (let i = 2; used.has(name); i++) {
          const dot = f.filename.lastIndexOf(".")
          name = dot > 0 ? `${f.filename.slice(0, dot)} (${i})${f.filename.slice(dot)}` : `${f.filename} (${i})`
        }
        used.add(name)
        zip.file(name, await r.blob())
      }
      setProgress("Compression…")
      const blob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${projectName.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "projet"} — pièces.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(`Archive impossible : ${e instanceof Error ? e.message : String(e)}`)
    }
    setBusy(false); setProgress("")
  }

  // Pièce non décidée : le geste d'avant, inchangé.
  function remove(d: ProjectDoc) {
    if (!window.confirm(`Supprimer définitivement « ${d.filename} » ?`)) return
    setError("")
    startTransition(async () => {
      const res = await deleteDocument(d.id)
      if (res.ok) { router.refresh(); return }
      // Le serveur peut savoir mieux que cet écran : la pièce a pu être
      // décidée depuis le chargement, ou l'état n'a jamais été obtenu.
      if (res.needsPurge) { setPurgeError(""); setPurging({ doc: d, message: res.error ?? "" }) }
      else setError(res.error ?? "Suppression impossible.")
    })
  }

  // Pièce décidée, administrateur : deux temps. Le premier appel part nu
  // et c'est le SERVEUR qui mesure ce que la purge emporterait — nombre
  // de validations, organisations, montant. Rien n'est compté ici : une
  // règle recopiée dans l'écran divergerait le jour où l'action changera
  // d'avis.
  function askPurge(d: ProjectDoc) {
    setError("")
    startTransition(async () => {
      const res = await deleteDocument(d.id)
      if (res.ok) { router.refresh(); return }
      if (res.needsPurge) { setPurgeError(""); setPurging({ doc: d, message: res.error ?? "" }) }
      else setError(res.error ?? "Suppression impossible.")
    })
  }

  function confirmPurge() {
    const target = purging?.doc
    if (!target) return
    setPurgeError("")
    startTransition(async () => {
      const res = await deleteDocument(target.id, { purge: true })
      // L'échec s'affiche DANS le dialogue, pas dans le bandeau du haut :
      // celui-ci est derrière la fenêtre, et le message serait annoncé à
      // un écran que personne ne regarde. Le dialogue reste ouvert — le
      // refermer emporterait le motif, et l'on ne saurait pas pourquoi
      // rien ne s'est passé.
      if (!res.ok) setPurgeError(res.error ?? "Purge impossible.")
      else { setPurging(null); router.refresh() }
    })
  }

  const selectCls = "px-3 py-2 rounded-xl border text-sm"
  const border = { borderColor: "#E3E6E2" }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border p-4 space-y-3" style={border}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label htmlFor="doc-f-q" className="block text-xs mb-1" style={{ color: "#66716B" }}>Rechercher</label>
            <input id="doc-f-q" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="nom, tâche, poste…" className={`${selectCls} w-full`} style={border} />
          </div>
          <div>
            <label htmlFor="doc-f-type" className="block text-xs mb-1" style={{ color: "#66716B" }}>Nature</label>
            <select id="doc-f-type" value={type} onChange={e => setType(e.target.value)} className={`${selectCls} w-full`} style={border}>
              <option value="">Toutes</option>
              {types.map(t => <option key={t} value={t}>{DOC_TYPE_LABELS[t] ?? t}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="doc-f-phase" className="block text-xs mb-1" style={{ color: "#66716B" }}>Phase</label>
            <select id="doc-f-phase" value={phase} onChange={e => setPhase(e.target.value)} className={`${selectCls} w-full`} style={border}>
              <option value="">Toutes</option>
              {phases.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="doc-f-from" className="block text-xs mb-1" style={{ color: "#66716B" }}>Déposé depuis</label>
            <input id="doc-f-from" type="date" value={from} onChange={e => setFrom(e.target.value)} className={`${selectCls} w-full`} style={border} />
          </div>
          <div>
            <label htmlFor="doc-f-to" className="block text-xs mb-1" style={{ color: "#66716B" }}>Jusqu&apos;au</label>
            <input id="doc-f-to" type="date" value={to} onChange={e => setTo(e.target.value)} className={`${selectCls} w-full`} style={border} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm" style={{ color: "#66716B" }}>
            {filtered.length} pièce{filtered.length > 1 ? "s" : ""}
            {hasFilter && <> sur {docs.length}</>}
          </span>
          <div className="flex items-center gap-2">
            {hasFilter && (
              <button type="button" onClick={reset} className="flex items-center gap-1 text-sm" style={{ color: "#66716B" }}>
                <FilterX size={14} aria-hidden="true" /> Réinitialiser
              </button>
            )}
            <button type="button" onClick={downloadZip} disabled={busy || filtered.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
              style={{ background: "var(--brand-accent,#0E6B5C)", opacity: busy || !filtered.length ? 0.5 : 1 }}>
              <Archive size={14} aria-hidden="true" />
              {busy ? (progress || "…") : `Télécharger (${filtered.length})`}
            </button>
          </div>
        </div>
        {/* Le ZIP reprend la SÉLECTION FILTRÉE, pas tout le projet :
            l'écrire évite de télécharger 200 pièces en croyant en tirer 12. */}
        <p className="text-xs" style={{ color: "#66716B" }}>
          L&apos;archive reprend exactement les pièces affichées ci-dessous, filtres compris.
        </p>
        {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden" style={border}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-cards tc-640">
            <thead>
              <tr style={{ background: "#F5F6F4", borderBottom: "1px solid #E3E6E2" }}>
                {["Pièce", "Nature", "Rattachement", "Montant", "Déposé", "Par", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: "#66716B" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => (
                <tr key={d.id} style={{ borderBottom: "1px solid #E3E6E2", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                  <td data-primary="" className="px-4 py-3">
                    <button type="button" onClick={() => download(d.id)}
                      className="inline-flex items-center gap-1 underline decoration-dotted text-left"
                      style={{ color: "#17211D" }}>
                      <Download size={12} aria-hidden="true" /> {d.filename}
                    </button>
                  </td>
                  <td data-label="Nature" className="px-4 py-3 text-xs" style={{ color: "#66716B" }}>
                    {DOC_TYPE_LABELS[d.type] ?? d.type}
                    {d.moment && <span> · {DOC_MOMENT_LABELS[d.moment]}</span>}
                  </td>
                  <td data-label="Rattachement" className="px-4 py-3 text-xs" style={{ color: "#66716B" }}>
                    {d.taskTitle ? <>Tâche : {d.taskTitle}</>
                      : d.lineposte ? <>Ligne : {d.lineposte}</>
                      : d.phaseName ? <>Phase : {d.phaseName}</>
                      : <span style={{ color: "#9AA39D" }}>Projet</span>}
                    {d.phaseName && (d.taskTitle || d.lineposte) && <div style={{ color: "#9AA39D" }}>{d.phaseName}</div>}
                  </td>
                  <td data-label="Montant" className="px-4 py-3 text-xs" style={{ color: "#17211D" }}>
                    {d.amount != null ? fmtEur(d.amount) : "—"}
                    {d.paid && <span className="ml-1" style={{ color: "var(--brand-accent,#0E6B5C)" }}>payé</span>}
                  </td>
                  <td data-label="Déposé" className="px-4 py-3 text-xs" style={{ color: "#66716B" }}>{fmtDate(d.uploadedAt)}</td>
                  <td data-label="Par" className="px-4 py-3 text-xs" style={{ color: "#66716B" }}>{d.uploaderName ?? "—"}</td>
                  <td data-label="Action" className="px-4 py-3">
                    {/* Pièce décidée : la corbeille ordinaire s'efface —
                        la base la refuserait (0051) et un bouton qui ne
                        peut que refuser est un bouton mort. Reste la
                        purge, nommée, et pour le seul administrateur.
                        Tant que l'état n'est pas revenu du serveur, on
                        garde l'affichage d'avant : escamoter par défaut
                        ferait disparaître la corbeille de toutes les
                        pièces à chaque incident réseau. */}
                    {canManage && (isDecided(d) ? purgeState?.canPurge && (
                      <button type="button" onClick={() => askPurge(d)} disabled={pending}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border font-medium"
                        style={{ borderColor: "#E3E6E2", color: "#A3342C" }}
                        title={`Purger « ${d.filename} », ses validations et son fichier — pour retirer des données de test`}>
                        <Trash2 size={12} aria-hidden="true" /> Purger
                      </button>
                    ) : (
                      <button type="button" onClick={() => remove(d)} disabled={pending}
                        className="p-1 rounded hover:bg-gray-100" aria-label={`Supprimer ${d.filename}`}>
                        <Trash2 size={13} style={{ color: "#A3342C" }} aria-hidden="true" />
                      </button>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm" style={{ color: "#66716B" }}>
            {docs.length === 0
              ? "Aucune pièce déposée sur ce projet."
              : "Aucune pièce ne correspond aux filtres."}
          </div>
        )}
      </div>

      {/* Le second temps de la purge. En DIALOGUE ici, alors que le
          panneau d'une ligne budgétaire le fait en place : ce tableau se
          replie en cartes sous 640 px, et une confirmation glissée dans
          une cellule y serait poussée hors de vue par la carte suivante.
          Le dialogue n'est jamais le passage obligé d'une suppression —
          il n'existe QUE parce que le serveur a refusé et proposé la
          purge. */}
      {purging && (
        <Modal open onClose={() => !pending && setPurging(null)} busy={pending} maxWidth="max-w-lg"
          title={`Purger « ${purging.doc.filename} »`}>
          <div className="space-y-3">
            {/* Le message du serveur TEL QUEL : il nomme le fichier,
                compte les validations et dit le montant qui disparaîtra.
                Le raccourcir ferait perdre précisément ce qu'on veut
                faire lire ; le réécrire fabriquerait une seconde vérité à
                tenir juste. */}
            <p className="text-sm rounded-xl p-3" style={{ background: "#FBEAEA", color: "#A02020" }}>
              {purging.message}
            </p>
            <ErrorMessage>{purgeError}</ErrorMessage>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setPurging(null)} disabled={pending}
                className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
                Annuler
              </button>
              <button type="button" onClick={confirmPurge} disabled={pending}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: "#A3342C" }}>
                {pending ? "Purge…" : "Purger définitivement"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
