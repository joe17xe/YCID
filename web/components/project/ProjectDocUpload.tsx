"use client"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, Paperclip } from "lucide-react"
import Modal, { ErrorMessage } from "@/components/ui/Modal"
import { createClient } from "@/lib/supabase/client"
import {
  DOC_TYPE_LABELS, MAX_DOC_SIZE, PROJECT_DOC_TYPES, buildStoragePath, isMoneyDoc, type DocType,
} from "@/lib/documents"
import { saveDocument } from "@/app/(app)/projets/[id]/document-actions"

// ============================================================
// Dépôt d'une pièce depuis l'onglet Documents (J4, élargi en 0070)
// ============================================================
// La 38a avait élargi le rattachement d'un document — `project_id` et
// `phase_id` en plus de la tâche et de la ligne budgétaire — mais
// l'interface n'offrait le dépôt que sur une tâche, une ligne ou une
// photo de phase.
//
// Conséquence : la CONVENTION DE FINANCEMENT, pièce fondatrice du
// projet, n'avait nulle part où aller. Ni sur une tâche, à laquelle elle
// ne se rattache pas, ni sur une ligne budgétaire, puisqu'elle les
// couvre toutes. Elle finissait donc hors de l'outil — c'est-à-dire
// nulle part le jour d'un contrôle.
//
// 0070 — LA SECONDE PORTE. Devis, facture et reçu étaient exclus d'ici,
// et l'aide disait « un devis se dépose sur sa ligne budgétaire » :
// deux affirmations vraies, mais que rien à l'écran ne réconciliait.
// « Pourquoi je ne peux pas mettre mon devis là où je mets mes
// pièces ? » — la question est juste, et la réponse n'était pas de
// fermer la porte mais de la rendre exacte.
//
// La règle du modèle n'a jamais été « on dépose depuis l'onglet
// Budget » : c'est qu'une pièce d'argent VIT SUR UNE LIGNE. Le point de
// dépôt est une commodité ; la ligne est l'invariant. On part donc ici
// du fichier et l'on désigne la ligne, au lieu de partir de la ligne —
// et la nature choisie commande le formulaire : la ligne et le montant
// deviennent obligatoires, la phase se déduit de la ligne au lieu
// d'être demandée deux fois.
export interface UploadLine {
  id: string
  poste: string
  phaseId: string | null
  phaseName: string | null
  funderName: string | null
  year: number | null
  planned: number | null
  isValorisation: boolean
}

const fmtEur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`

export default function ProjectDocUpload({ projectId, phases, lines }: {
  projectId: string
  phases: { id: string; name: string }[]
  lines: UploadLine[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [type, setType] = useState<DocType>("convention")
  const [phaseId, setPhaseId] = useState("")
  const [lineId, setLineId] = useState("")
  const [amount, setAmount] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const money = isMoneyDoc(type)

  // Les lignes de VALORISATION ne reçoivent pas d'argent : un apport en
  // nature n'a ni devis ni facture, il a une attestation. Les proposer
  // ici inviterait à y accrocher une dépense, et le contrôle
  // `check:valorisation` existe précisément parce que ce mélange s'est
  // déjà produit dans les agrégats.
  const eligible = useMemo(
    () => lines.filter(l => !money || !l.isValorisation),
    [lines, money],
  )

  // Groupées par phase, dans l'ordre où le budget les présente : sur
  // vingt lignes aux intitulés longs, une liste à plat ne se lit pas.
  const grouped = useMemo(() => {
    const map = new Map<string, UploadLine[]>()
    for (const l of eligible) {
      const key = l.phaseName ?? "Hors phase"
      map.set(key, [...(map.get(key) ?? []), l])
    }
    return [...map.entries()]
  }, [eligible])

  const selected = eligible.find(l => l.id === lineId) ?? null

  function reset() {
    setFile(null); setPhaseId(""); setLineId(""); setAmount(""); setError("")
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!file) { setError("Choisissez un fichier."); return }
    if (file.size > MAX_DOC_SIZE) { setError("Fichier trop lourd (10 Mo maximum)."); return }
    // Les deux exigences de l'invariant, dites ici pour qu'elles se
    // lisent avant l'envoi. `saveDocument` les repose côté serveur, et
    // la 0070 en base : trois endroits, une seule règle, parce que
    // celui-ci seul serait contournable et que les deux autres ne
    // savent pas parler à l'utilisateur au bon moment.
    if (money && !lineId) {
      setError(`Choisissez la ligne budgétaire : c'est là que le montant se compare au prévu, et là que la validation s'affiche.`)
      return
    }
    if (money && !amount.trim()) {
      setError(type === "devis"
        ? "Indiquez le montant du devis : c'est ce montant qui sera engagé une fois le devis validé."
        : "Indiquez le montant : c'est lui qui alimentera le « payé » une fois la pièce marquée réglée.")
      return
    }
    setBusy(true)

    // Pour une pièce d'argent, la phase est celle de la ligne : la
    // demander à part ouvrirait la porte à une pièce rangée dans une
    // phase et imputée à une autre.
    const effectivePhase = money ? (selected?.phaseId ?? null) : (phaseId || null)
    const path = buildStoragePath(projectId, effectivePhase, file.name)
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file)
    if (upErr) { setError(`Échec de l'envoi : ${upErr.message}`); setBusy(false); return }

    const res = await saveDocument({
      projectId, phaseId: effectivePhase, budgetLineId: money ? lineId : null, type,
      filename: file.name, storagePath: path, amount: money ? amount : null,
    })
    if (!res.ok) {
      // Le fichier envoyé mais non enregistré deviendrait un orphelin
      // dans le Storage : on le retire.
      await supabase.storage.from("documents").remove([path])
      setError(res.error ?? "Une erreur est survenue."); setBusy(false); return
    }
    setBusy(false)
    // Dépôt réussi mais circuit non amorcé : la pièce reste en place, et
    // on le dit — se taire laisserait croire qu'un devis attend une
    // décision alors qu'il n'attend personne. Le dialogue reste ouvert
    // pour que le message soit lu.
    if (res.warning) { setError(res.warning); setFile(null); router.refresh(); return }
    reset(); setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-sm font-semibold"
        style={{ background: "var(--brand-accent,#0E6B5C)" }}>
        <Paperclip size={14} aria-hidden="true" /> Déposer une pièce
      </button>

      <Modal open={open} onClose={() => { setOpen(false); setError("") }} busy={busy} maxWidth="max-w-md"
        title="Déposer une pièce du projet">
        <form onSubmit={submit} className="space-y-3">
          <p className="text-xs" style={{ color: "#66716B" }}>
            Une pièce qui porte sur le projet entier — convention de financement, rapport, étude —
            ou un devis, une facture, un reçu : ceux-là se rattachent à leur ligne budgétaire,
            ici comme depuis l&apos;onglet Budget.
          </p>
          <input type="file" required onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm" />
          <div>
            <label htmlFor="pdu-type" className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Nature *</label>
            <select id="pdu-type" value={type} onChange={e => setType(e.target.value as DocType)}
              className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "#E3E6E2" }}>
              {PROJECT_DOC_TYPES.map(t => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
            </select>
          </div>

          {money ? (
            <>
              <div>
                <label htmlFor="pdu-line" className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>
                  Ligne budgétaire *
                </label>
                {eligible.length === 0 ? (
                  <p className="text-sm rounded-xl px-3 py-2" style={{ background: "#F7EDDD", color: "#8A6A1F" }}>
                    Ce projet n&apos;a aucune ligne budgétaire (hors valorisation) : créez-la dans l&apos;onglet
                    Budget, puis revenez déposer la pièce.
                  </p>
                ) : (
                  <select id="pdu-line" value={lineId} onChange={e => setLineId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "#E3E6E2" }}>
                    <option value="">— Choisir la ligne —</option>
                    {grouped.map(([phaseName, ls]) => (
                      <optgroup key={phaseName} label={phaseName}>
                        {ls.map(l => (
                          <option key={l.id} value={l.id}>
                            {l.poste}
                            {l.funderName ? ` — ${l.funderName}` : ""}
                            {l.year ? ` (${l.year})` : ""}
                            {l.planned != null ? ` · prévu ${fmtEur(l.planned)}` : ""}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                )}
                {selected && (
                  <p className="text-xs mt-1" style={{ color: "#66716B" }}>
                    Phase : {selected.phaseName ?? "hors phase"} — la pièce y sera rangée automatiquement.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="pdu-amount" className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>
                  Montant (€) *
                </label>
                <input id="pdu-amount" type="number" min={0} step="0.01" value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "#E3E6E2" }} />
                <p className="text-xs mt-1" style={{ color: "#66716B" }}>
                  {type === "devis"
                    ? "Un devis part en validation dès son dépôt : l'organisation porteuse, puis la coordinatrice. Ce montant sera l'engagé une fois validé."
                    : "Ce montant alimentera le « payé » une fois la pièce marquée réglée, depuis l'onglet Budget."}
                </p>
              </div>
            </>
          ) : (
            <div>
              <label htmlFor="pdu-phase" className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Phase concernée</label>
              <select id="pdu-phase" value={phaseId} onChange={e => setPhaseId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "#E3E6E2" }}>
                <option value="">Tout le projet</option>
                {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <p className="text-xs mt-1" style={{ color: "#66716B" }}>
                Facultatif. « Tout le projet » convient à une convention.
              </p>
            </div>
          )}

          <ErrorMessage>{error}</ErrorMessage>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => { setOpen(false); setError("") }}
              className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
              Annuler
            </button>
            <button type="submit" disabled={busy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "var(--brand-accent,#0E6B5C)", opacity: busy ? 0.7 : 1 }}>
              <Upload size={14} /> {busy ? "Envoi…" : "Déposer"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
