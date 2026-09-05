"use client"
import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Paperclip, Upload, Trash2, Check, X as XIcon } from "lucide-react"
import Modal, { ErrorMessage } from "@/components/ui/Modal"
import { createClient } from "@/lib/supabase/client"
import { BUDGET_DOC_TYPES, DOC_TYPE_LABELS, MAX_DOC_SIZE, buildStoragePath, type DocType } from "@/lib/documents"
import { isEngagedDoc, pendingOrgCount } from "@/lib/budget"
import {
  saveDocument, deleteDocument, getDocumentUrl, decideValidation, setDocumentPaid, getDocumentPurgeState,
} from "@/app/(app)/projets/[id]/document-actions"

// ============================================================
// PR 38b — Devis, factures et circuit de validation
// ============================================================
// devis déposé → validé (ou refusé) → facture → payé.
// « engagé » = Σ des devis validés, « payé » = Σ des pièces marquées
// payées. Ce sont les deux sources du réalisé que la PR 39 agrégera par
// phase et par projet.

export interface LineValidation {
  id: string
  decision: "en_attente" | "valide" | "refuse"
  comment: string | null
  orgName: string | null
  deciderName: string | null
  // Calculé côté serveur, par validation : membre de l'organisation
  // sollicitée, ou administrateur plateforme. Un droit global serait faux
  // — on peut décider pour une organisation et pas pour la suivante.
  canDecide: boolean
  // Membre de l'organisation sollicitée. Faux = décision par
  // procuration, qui exige confirmation explicite et motif.
  isMember: boolean
  // Rang dans la chaîne (0041) : 1 le porteur, 2 le coordinateur.
  step: number
  // Un échelon antérieur n'a pas encore signé. La base le refuse aussi
  // (policy « Decide validation ») ; l'écran ne doit donc pas proposer
  // une action qui sera rejetée.
  blocked: boolean
}

export interface LineDoc {
  id: string
  filename: string
  type: DocType
  amount: number | null
  paid: boolean
  paid_at: string | null
  validations: LineValidation[]
}

const fmtEur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`

// La règle vit dans lib/budget.ts, qui alimente aussi les colonnes du
// tableau et le rapport IA. Elle était recopiée ici — la divergence même
// que ce module devait empêcher, relevée en relecture le 25/07.
export const isEngaged = (d: LineDoc) => isEngagedDoc(d)

export default function BudgetLineDocuments({ projectId, phaseId, lineId, poste, docs, canManage, autoOpen }: {
  projectId: string; phaseId: string | null; lineId: string; poste: string
  docs: LineDoc[]; canManage: boolean
  // Arrivée depuis une notification ou la file « À valider » : le panneau
  // de la ligne concernée s'ouvre seul. Sans cela, on dépose l'utilisateur
  // devant vingt lignes en le laissant chercher laquelle l'attend.
  autoOpen?: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const anchor = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(!!autoOpen)
  const [file, setFile] = useState<File | null>(null)
  const [type, setType] = useState<DocType>("devis")
  const [amount, setAmount] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [payingDoc, setPayingDoc] = useState<LineDoc | null>(null)
  const [payDate, setPayDate] = useState("")
  const [refusing, setRefusing] = useState<string | null>(null)
  const [refusalReason, setRefusalReason] = useState("")
  // Décision par procuration : deuxième temps imposé, avec motif.
  const [proxy, setProxy] = useState<{ id: string; decision: "valide" | "refuse"; orgName: string } | null>(null)
  const [proxyReason, setProxyReason] = useState("")
  // Purge d'une pièce décidée : le message vient du SERVEUR, qui seul a
  // compté ce qu'elle emporte (0059). L'écran ne le reformule pas.
  const [purging, setPurging] = useState<{ id: string; message: string } | null>(null)
  // Qui peut purger est un rôle PLATEFORME : rien dans les données de la
  // ligne ne le dit. On le demande, sinon il n'y aurait que deux issues,
  // toutes deux mauvaises — proposer à tous une action que la base
  // refusera à presque tous, ou la cacher à qui elle est destinée.
  const [canPurge, setCanPurge] = useState(false)
  const [pending, startTransition] = useTransition()

  const engaged = docs.filter(isEngaged).reduce((s, d) => s + (d.amount ?? 0), 0)
  // Même règle que lib/budget.ts, qui alimente les colonnes du tableau :
  // un devis n'est jamais un paiement. Sans l'exclusion, l'en-tête du
  // panneau et la colonne « Payé » de la même ligne pouvaient afficher
  // deux chiffres différents.
  const paid = docs.filter(d => d.paid && d.type !== "devis").reduce((s, d) => s + (d.amount ?? 0), 0)

  // ------------------------------------------------------------
  // Ce qui attend une décision, VISIBLE depuis le tableau
  // ------------------------------------------------------------
  // « Rien ne montre qu'il y a un devis à valider, je dois cliquer sur
  // toutes les lignes avec pièce » (27/07). Le bouton disait combien de
  // pièces existaient — jamais qu'une décision était attendue, ni de
  // qui. Sur un budget de vingt lignes, cela revient à ouvrir vingt
  // panneaux pour en trouver un.
  //
  // Deux signaux distincts, parce que ce ne sont pas deux informations
  // de même nature : ce que J'AI à décider est une action ; ce qu'un
  // AUTRE doit décider est un état d'avancement.
  const mineToDecide = docs.reduce((n, d) =>
    n + (d.validations ?? []).filter(v => v.decision === "en_attente" && v.canDecide && !v.blocked).length, 0)
  const othersPending = docs.reduce((n, d) =>
    n + (d.validations ?? []).filter(v => v.decision === "en_attente" && !(v.canDecide && !v.blocked)).length, 0)

  // ------------------------------------------------------------
  // Un refus porte sur une PIÈCE, jamais sur la ligne budgétaire
  // ------------------------------------------------------------
  // Le badge disait « Refusé », seul, en rouge, collé au montant
  // prévisionnel. Le Product Owner l'a lu « le budget est refusé, je ne
  // peux plus éditer » et a signalé ne pas arriver à modifier ses
  // montants. Le verrou n'existe pas : saveBudgetLine ne contrôle que
  // canManageBudget, et aucun refus de devis n'y intervient. Un mot qui
  // fabrique un blocage imaginaire coûte aussi cher qu'un blocage réel —
  // il fait renoncer à une action permise, sans erreur à lire.
  //
  // On lit donc les validations directement plutôt que de passer par un
  // prédicat de lib/budget.ts : ce module n'expose qu'isEngagedDoc, qui
  // range « refusé » et « encore en attente » dans la même case (non
  // engagé), alors que l'écran doit précisément les opposer. Aucun
  // montant ne dépend de ce qui suit — la règle « un seul refus rejette »
  // reste chez elle.
  const refusalOf = (d: LineDoc) => (d.validations ?? []).find(v => v.decision === "refuse")
  const refusedDocs = docs.filter(d => !!refusalOf(d))

  // ------------------------------------------------------------
  // Ce qui a été JUGÉ ne s'efface plus
  // ------------------------------------------------------------
  // Même ligne de partage que la policy « Delete documents » (0059) et
  // que `deleteDocument` : une pièce sur laquelle une organisation s'est
  // prononcée — validée OU refusée — ne se retire plus d'un clic, parce
  // que la décision est ce qui justifie la dépense devant le financeur.
  // Lue ici sur les validations DÉJÀ chargées et affichées deux lignes
  // plus bas : l'écran ne peut pas afficher « refusé » et proposer dans
  // le même bloc une corbeille ordinaire.
  const isDecided = (d: LineDoc) => (d.validations ?? []).some(v => v.decision !== "en_attente")
  // Le motif et l'organisation sont DÉJÀ chargés par la page
  // (validations.comment / .orgName) : les taire obligerait à rouvrir le
  // panneau pour apprendre pourquoi, alors que c'est le seul
  // renseignement qui permette de redéposer un devis recevable.
  const refusalTitle = refusedDocs
    .map(d => {
      const v = refusalOf(d)
      const by = v?.orgName ?? "l'organisation sollicitée"
      return `« ${d.filename} » refusé par ${by}${v?.comment ? ` — ${v.comment}` : " — aucun motif indiqué"}`
    })
    // Voix passive assumée : le badge est visible de tous, y compris de
    // qui n'a pas le droit budget.manage. Dire « vous pouvez modifier »
    // à quelqu'un qui ne le peut pas remplacerait un faux verrou par une
    // fausse permission.
    .concat("Un refus ne verrouille ni la ligne budgétaire ni ses montants : ils restent modifiables, et un nouveau devis peut être déposé.")
    .join("\n")

  async function upload(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!file) { setError("Choisissez un fichier."); return }
    if (file.size > MAX_DOC_SIZE) { setError("Fichier trop lourd (10 Mo maximum)."); return }
    // Le montant d'un devis n'est pas facultatif : c'est lui, et lui
    // seul, qui deviendra l'engagé une fois la validation obtenue.
    if (type === "devis" && !amount.trim()) {
      setError("Indiquez le montant du devis : c'est ce montant qui sera engagé une fois le devis validé.")
      return
    }
    setBusy(true)
    const path = buildStoragePath(projectId, phaseId, file.name)
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file)
    if (upErr) { setError(`Échec de l'envoi : ${upErr.message}`); setBusy(false); return }

    const res = await saveDocument({
      projectId, phaseId, budgetLineId: lineId, type,
      filename: file.name, storagePath: path, amount: amount || null,
    })
    if (!res.ok) {
      await supabase.storage.from("documents").remove([path])
      setError(res.error ?? "Une erreur est survenue."); setBusy(false); return
    }
    // Dépôt réussi mais circuit non amorcé : la pièce reste en place, et
    // on le dit. Se taire ici laisserait croire que le devis est en
    // attente de décision alors qu'il n'attend personne.
    setError(res.warning ?? "")
    setBusy(false); setFile(null); setAmount("")
    router.refresh()
  }

  // Purger le message AVANT chaque action : sans cela une erreur
  // ancienne restait affichée sous une action qui venait de réussir —
  // on lisait « payé le 20/07 » juste au-dessus de l'échec précédent.
  function runDecision(validationId: string, decision: "valide" | "refuse", comment: string, onBehalf = false) {
    setError("")
    startTransition(async () => {
      const res = await decideValidation({ validationId, projectId, decision, comment, onBehalf })
      if (!res.ok) setError(res.error ?? "Décision impossible.")
      else { setRefusing(null); setRefusalReason(""); setProxy(null); setProxyReason(""); router.refresh() }
    })
  }

  // Le motif de refus passait lui aussi par window.prompt() : même
  // défaut que la date de paiement — boîte système qui bloque le rendu,
  // non stylée, pénible sur mobile. Saisie en place, dans le flux.
  function startRefusal(validationId: string) {
    setError("")
    setRefusalReason("")
    setRefusing(validationId)
  }

  // Marquer payé passait par window.prompt() : boîte système non
  // stylée, qui BLOQUE le rendu de la page tant qu'elle est ouverte, et
  // n'impose aucun format — une date saisie « 20/07/2026 », ce que fait
  // naturellement un francophone, remontait l'erreur Postgres brute.
  // D'où un champ date natif, qui contraint le format par construction.
  function confirmPaid(d: LineDoc) {
    setError("")
    const today = new Date()
    const p = (n: number) => String(n).padStart(2, "0")
    setPayDate(`${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`)
    setPayingDoc(d)
  }

  function submitPaid(e: React.FormEvent) {
    e.preventDefault()
    if (!payingDoc) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payDate)) { setError("Date invalide."); return }
    const doc = payingDoc
    setError("")
    startTransition(async () => {
      const res = await setDocumentPaid({ documentId: doc.id, projectId, paid: true, paidAt: payDate })
      if (!res.ok) setError(res.error ?? "Échec.")
      else { setPayingDoc(null); router.refresh() }
    })
  }

  function cancelPaid(d: LineDoc) {
    setError("")
    startTransition(async () => {
      const res = await setDocumentPaid({ documentId: d.id, projectId, paid: false, paidAt: null })
      if (!res.ok) setError(res.error ?? "Échec.")
      else router.refresh()
    })
  }

  // Pièce NON décidée : rien n'a été jugé, rien à conserver — le geste
  // reste celui d'avant. C'est le cas des devis d'essai jamais soumis,
  // et les retirer ne doit pas coûter plus qu'une confirmation.
  function remove(d: LineDoc) {
    if (!window.confirm(`Supprimer définitivement « ${d.filename} » ?`)) return
    setError("")
    startTransition(async () => {
      const res = await deleteDocument(d.id)
      if (res.ok) { router.refresh(); return }
      // Course possible : une organisation a pu trancher entre l'affichage
      // et le clic. Le serveur le sait, l'écran ne le savait pas — on suit
      // sa réponse au lieu d'afficher un refus qu'on ne saurait pas lever.
      if (res.needsPurge) setPurging({ id: d.id, message: res.error ?? "" })
      else setError(res.error ?? "Suppression impossible.")
    })
  }

  // Pièce DÉCIDÉE, administrateur : deux temps. Le premier appel part nu
  // — c'est le SERVEUR qui mesure ce que la purge emporterait et renvoie
  // la phrase à lire. Ce composant ne compte rien et ne reformule rien :
  // toute règle recopiée ici divergerait le jour où l'action changerait
  // d'avis, et l'écran promettrait alors ce que la base refuse.
  function askPurge(d: LineDoc) {
    setError("")
    startTransition(async () => {
      const res = await deleteDocument(d.id)
      if (res.ok) { router.refresh(); return }
      if (res.needsPurge) setPurging({ id: d.id, message: res.error ?? "" })
      else setError(res.error ?? "Suppression impossible.")
    })
  }

  function confirmPurge(d: LineDoc) {
    setError("")
    startTransition(async () => {
      const res = await deleteDocument(d.id, { purge: true })
      // Le message part dans l'erreur et le bloc reste ouvert : le refermer
      // emporterait le motif du refus, et l'on ne saurait pas pourquoi rien
      // ne s'est passé.
      if (!res.ok) setError(res.error ?? "Purge impossible.")
      else { setPurging(null); router.refresh() }
    })
  }

  async function download(id: string) {
    setError("")
    const res = await getDocumentUrl(id)
    if (res.ok && res.url) window.open(res.url, "_blank", "noopener")
    else setError(res.error ?? "Lien indisponible.")
  }

  // Ouvrir le panneau ne suffit pas si la ligne est la douzième d'un
  // tableau : on amène aussi l'écran dessus.
  useEffect(() => {
    if (autoOpen) anchor.current?.scrollIntoView({ block: "center" })
  }, [autoOpen])

  // À L'OUVERTURE du panneau, jamais au rendu du tableau : un budget de
  // vingt lignes ferait vingt aller-retours pour un bouton que personne
  // n'a encore demandé. En cas d'échec on reste sur `false` — l'absence
  // de bouton de purge est la valeur sûre, l'erreur qu'on préfère.
  useEffect(() => {
    if (!open) return
    let alive = true
    getDocumentPurgeState(projectId)
      .then(s => { if (alive) setCanPurge(s.canPurge) })
      .catch(() => { /* purge indisponible : on n'en propose pas */ })
    return () => { alive = false }
  }, [open, projectId])

  return (
    <div ref={anchor}>
      {/* Un trombone gris de 11 pixels, sans libellé, pour l'action la
          plus structurante du module financier : personne ne le trouvait,
          pas même l'auteur du projet. C'est ICI que se déposent devis et
          factures — le dire coûte deux mots. */}
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs whitespace-nowrap px-2 py-1 rounded-lg border"
        style={{
          borderColor: "#E3E6E2",
          color: docs.length ? "var(--brand-accent,#0E6B5C)" : "#66716B",
          background: docs.length ? "var(--brand-accent-soft,#E4F0EC)" : "#FFFFFF",
        }}
        title={`Devis, factures et justificatifs de « ${poste} »`}>
        <Paperclip size={12} aria-hidden="true" />
        <span className="font-medium">Pièces{docs.length > 0 ? ` (${docs.length})` : ""}</span>
        {engaged > 0 && <span style={{ color: "#3B5488" }}> · eng. {fmtEur(engaged)}</span>}
        {paid > 0 && <span style={{ color: "var(--brand-accent,#0E6B5C)" }}> · payé {fmtEur(paid)}</span>}
      </button>

      {/* Pastilles d'état, hors du bouton : elles doivent se lire sans
          cliquer, et se distinguer du décompte de pièces. */}
      {mineToDecide > 0 && (
        <button type="button" onClick={() => setOpen(true)}
          className="ml-1 inline-flex items-center gap-1 text-xs whitespace-nowrap px-2 py-1 rounded-lg font-semibold text-white"
          style={{ background: "#B4690E" }}
          title="Une décision vous est demandée sur cette ligne">
          <Check size={12} aria-hidden="true" />
          {mineToDecide > 1 ? `${mineToDecide} à valider` : "À valider"}
        </button>
      )}
      {mineToDecide === 0 && othersPending > 0 && (
        <span className="ml-1 inline-flex items-center text-xs whitespace-nowrap px-2 py-1 rounded-lg"
          style={{ background: "#F7EDDD", color: "#8A6A1F" }}
          title="Une décision est attendue, mais elle ne vous revient pas">
          En attente
        </span>
      )}
      {/* « Devis refusé » et non « Refusé » : le badge nomme son objet,
          sinon le lecteur lui donne le plus gros disponible — la ligne,
          voire le budget. Cliquable comme « À valider », parce qu'ici
          quelque chose se fait : lire le motif, puis redéposer. Le
          bouton « Pièces » y mène déjà, mais faire retraverser un
          panneau de vingt pièces pour retrouver LE devis refusé, c'est
          le travail que ces pastilles existent pour épargner. */}
      {refusedDocs.length > 0 && (
        <button type="button" onClick={() => setOpen(true)}
          className="ml-1 inline-flex items-center text-xs whitespace-nowrap px-2 py-1 rounded-lg"
          style={{ background: "#FBEAEA", color: "#A02020" }}
          title={refusalTitle}>
          {refusedDocs.length > 1 ? `${refusedDocs.length} devis refusés` : "Devis refusé"}
        </button>
      )}

      {open && (
        <Modal open onClose={() => !busy && setOpen(false)} title={`Pièces — ${poste}`} busy={busy} maxWidth="max-w-2xl">
          <div className="space-y-4">
            <div className="flex gap-4 text-sm">
              <span style={{ color: "#3B5488" }}>Engagé (devis validés) : <strong>{fmtEur(engaged)}</strong></span>
              <span style={{ color: "var(--brand-accent,#0E6B5C)" }}>Payé : <strong>{fmtEur(paid)}</strong></span>
            </div>

            {docs.length === 0 ? (
              <p className="text-sm" style={{ color: "#66716B" }}>Aucune pièce déposée sur cette ligne.</p>
            ) : (
              <ul className="space-y-2">
                {docs.map(d => (
                  <li key={d.id} className="rounded-xl border p-3" style={{ borderColor: "#E3E6E2" }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium mr-2"
                          style={{ background: "#EEF0EE", color: "#66716B" }}>
                          {DOC_TYPE_LABELS[d.type] ?? d.type}
                        </span>
                        <button type="button" onClick={() => download(d.id)}
                          className="text-sm underline decoration-dotted" style={{ color: "#17211D" }}>
                          {d.filename}
                        </button>
                        {d.amount != null && (
                          <span className="ml-2 text-sm font-semibold" style={{ color: "#17211D" }}>{fmtEur(d.amount)}</span>
                        )}
                        {d.paid && (
                          <span className="ml-2 text-xs" style={{ color: "var(--brand-accent,#0E6B5C)" }}>
                            payé{d.paid_at ? ` le ${new Date(d.paid_at).toLocaleDateString("fr-FR")}` : ""}
                          </span>
                        )}
                      </div>
                      {/* Trois cas, trois affichages — et surtout : rien
                          d'inerte. La corbeille ordinaire disparaît dès
                          qu'une décision existe ; à sa place, la purge
                          seulement pour qui peut la mener à bien. Un
                          bouton qui ne peut que refuser serait le bouton
                          mort que le dépôt s'interdit. */}
                      {canManage && (isDecided(d) ? canPurge && (
                        <button type="button" onClick={() => askPurge(d)} disabled={pending}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border flex-shrink-0 font-medium"
                          style={{ borderColor: "#E3E6E2", color: "#A3342C" }}
                          title="Retirer cette pièce décidée, ses validations et son fichier — pour nettoyer des données de test">
                          <Trash2 size={12} aria-hidden="true" /> Purger
                        </button>
                      ) : (
                        <button type="button" onClick={() => remove(d)} disabled={pending}
                          className="p-1 rounded hover:bg-gray-100 flex-shrink-0" aria-label={`Supprimer ${d.filename}`}>
                          <Trash2 size={13} style={{ color: "#A3342C" }} aria-hidden="true" />
                        </button>
                      ))}
                    </div>

                    {/* Le second temps de la purge, EN PLACE : ce panneau
                        est déjà un dialogue, en ouvrir un second par-dessus
                        ferait se disputer deux pièges à focus. Même parti
                        pris que le motif de refus et la date de paiement,
                        saisis dans le flux. */}
                    {purging?.id === d.id && (
                      <div className="mt-2 rounded-xl border p-2 space-y-2" style={{ borderColor: "#A3342C", background: "#FBEAEA" }}>
                        {/* Le message du serveur TEL QUEL : il nomme le
                            fichier, compte les validations et dit le montant
                            qui disparaîtra. Le réécrire ici fabriquerait une
                            seconde vérité, qui divergerait au premier
                            changement de règle. */}
                        <p className="text-xs" style={{ color: "#A02020" }}>{purging.message}</p>
                        <div className="flex gap-2 flex-wrap">
                          <button type="button" onClick={() => confirmPurge(d)} disabled={pending}
                            className="px-2 py-1 rounded-lg text-xs font-semibold text-white"
                            style={{ background: "#A3342C", opacity: pending ? 0.6 : 1 }}>
                            {pending ? "Purge…" : "Purger définitivement"}
                          </button>
                          <button type="button" onClick={() => setPurging(null)} disabled={pending}
                            className="px-2 py-1 rounded-lg border text-xs font-medium" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Un devis sans montant est validable, et n'engagera
                        pourtant rien : le circuit se déroule normalement
                        pendant que le chiffre reste à zéro. Le dire ici
                        évite de chercher l'erreur ailleurs. */}
                    {d.type === "devis" && d.amount == null && (
                      <p className="mt-2 text-xs px-2 py-1 rounded" style={{ background: "#F7EDDD", color: "#8A6A1F" }}>
                        Montant non renseigné : même validé, ce devis n&apos;alimentera pas
                        l&apos;engagé.{" "}
                        {/* « Retirez-le » n'est plus vrai une fois qu'une
                            organisation s'est prononcée : la pièce est
                            conservée (0059). Indiquer un geste devenu
                            impossible ferait chercher un bouton qui n'existe
                            plus, et le remède est de toute façon le même
                            qu'ailleurs — un nouveau devis. */}
                        {isDecided(d)
                          ? "Déposez un nouveau devis avec son montant : cette pièce, elle, est décidée et reste au dossier."
                          : "Retirez-le et redéposez-le avec son montant."}
                      </p>
                    )}

                    {/* Devis jamais soumis : l'absence de validation ne
                        doit pas se lire comme une pièce jointe ordinaire.
                        Le cas survient si la ligne n'a ni financeur ni
                        organisation porteuse à qui adresser la demande. */}
                    {d.type === "devis" && d.validations.length === 0 && (
                      <p className="mt-2 text-xs px-2 py-1 rounded" style={{ background: "#F6E7E5", color: "#A3342C" }}>
                        Hors circuit : ce devis n&apos;a été soumis à aucune organisation.
                        Renseignez le financeur de la ligne, puis redéposez-le.
                      </p>
                    )}

                    {/* Devis : état du circuit, une ligne par organisation sollicitée */}
                    {d.type === "devis" && d.validations.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {d.validations.map(v => (
                          <li key={v.id} className="flex items-center gap-2 text-xs">
                            <span style={{ color: "#66716B" }}>
                              {d.validations.length > 1 && (
                                <span className="mr-1 px-1.5 py-0.5 rounded" style={{ background: "#EEF0EE", color: "#66716B" }}>
                                  {v.step}
                                </span>
                              )}
                              {v.orgName ?? "Organisation"}
                            </span>
                            {v.decision === "en_attente" && v.blocked ? (
                              // Le rang existe pour être respecté : le
                              // coordinateur entérine ce que le porteur a
                              // engagé, il ne le précède pas.
                              //
                              // Après un refus en amont, cette ligne annonçait
                              // pourtant « son tour viendra » : il ne viendra
                              // jamais. La policy 0041 exige que chaque échelon
                              // antérieur soit `valide`, pas seulement tranché —
                              // l'échelon suivant ne sera donc plus jamais
                              // sollicité. Faire guetter une décision qui ne
                              // sera pas demandée est la panne muette type :
                              // rien n'échoue, on attend, c'est tout.
                              <span style={{ color: "#9AA39D" }}>
                                {(d.validations ?? []).some(o => o.step < v.step && o.decision === "refuse")
                                  ? "sans suite — le devis a été refusé à une étape précédente"
                                  : `en attente — son tour viendra après l'étape ${v.step - 1}`}
                              </span>
                            ) : v.decision === "en_attente" ? (
                              <>
                                <span style={{ color: "#B4690E" }}>en attente</span>
                                {/* Procuration : deuxième temps imposé, motif
                                    obligatoire. Décider pour une organisation
                                    dont on n'est pas membre ne doit pas se
                                    confondre avec une décision légitime. */}
                                {v.canDecide && !v.isMember && proxy?.id === v.id ? (
                                  <span className="flex items-center gap-1 flex-wrap">
                                    <input value={proxyReason} onChange={e => setProxyReason(e.target.value)}
                                      placeholder={`Motif — vous n'êtes pas membre de ${v.orgName ?? "cette organisation"}`}
                                      aria-label="Motif de la décision par procuration"
                                      className="px-2 py-1 rounded-lg border text-xs" style={{ borderColor: "#B4690E", minWidth: 240 }} />
                                    <button type="button" disabled={pending || !proxyReason.trim()}
                                      onClick={() => runDecision(v.id, proxy.decision, proxyReason, true)}
                                      className="px-2 py-1 rounded-lg font-medium"
                                      style={{ background: "#F7EDDD", color: "#8A6A1F", opacity: proxyReason.trim() ? 1 : 0.5 }}>
                                      Confirmer au nom de {v.orgName ?? "cette organisation"}
                                    </button>
                                    <button type="button" onClick={() => { setProxy(null); setProxyReason("") }}
                                      className="px-2 py-1 rounded-lg border font-medium" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
                                      Annuler
                                    </button>
                                  </span>
                                ) : v.canDecide && !v.isMember ? (
                                  <span className="flex gap-1 items-center flex-wrap">
                                    <span className="px-1.5 py-0.5 rounded" style={{ background: "#F7EDDD", color: "#8A6A1F" }}>
                                      vous n&apos;êtes pas membre
                                    </span>
                                    <button type="button" disabled={pending}
                                      onClick={() => { setError(""); setProxyReason(""); setProxy({ id: v.id, decision: "valide", orgName: v.orgName ?? "" }) }}
                                      className="px-2 py-0.5 rounded-lg border font-medium" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
                                      Valider à sa place…
                                    </button>
                                    <button type="button" disabled={pending}
                                      onClick={() => { setError(""); setProxyReason(""); setProxy({ id: v.id, decision: "refuse", orgName: v.orgName ?? "" }) }}
                                      className="px-2 py-0.5 rounded-lg border font-medium" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
                                      Refuser à sa place…
                                    </button>
                                  </span>
                                ) : v.canDecide && (refusing === v.id ? (
                                  <span className="flex items-center gap-1 flex-wrap">
                                    <input value={refusalReason} onChange={e => setRefusalReason(e.target.value)}
                                      placeholder="Motif du refus (facultatif)"
                                      aria-label="Motif du refus"
                                      className="px-2 py-1 rounded-lg border text-xs" style={{ borderColor: "#E3E6E2", minWidth: 180 }} />
                                    <button type="button" onClick={() => runDecision(v.id, "refuse", refusalReason)} disabled={pending}
                                      className="px-2 py-1 rounded-lg font-medium"
                                      style={{ background: "#F6E7E5", color: "#A3342C" }}>
                                      Confirmer le refus
                                    </button>
                                    <button type="button" onClick={() => setRefusing(null)}
                                      className="px-2 py-1 rounded-lg border font-medium" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
                                      Annuler
                                    </button>
                                  </span>
                                ) : (
                                  <span className="flex gap-1">
                                    <button type="button" onClick={() => runDecision(v.id, "valide", "")} disabled={pending}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-medium"
                                      style={{ background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }}>
                                      <Check size={11} aria-hidden="true" /> Valider
                                    </button>
                                    <button type="button" onClick={() => startRefusal(v.id)} disabled={pending}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-medium"
                                      style={{ background: "#F6E7E5", color: "#A3342C" }}>
                                      <XIcon size={11} aria-hidden="true" /> Refuser
                                    </button>
                                  </span>
                                ))}
                              </>
                            ) : (
                              <span style={{ color: v.decision === "valide" ? "var(--brand-accent,#0E6B5C)" : "#A3342C" }}>
                                {v.decision === "valide" ? "validé" : "refusé"}
                                {/* Nommer le décideur : une décision prise au nom
                                    d'une organisation par quelqu'un d'extérieur ne
                                    doit pas se lire comme la décision de cette
                                    organisation. */}
                                {v.deciderName ? ` par ${v.deciderName}` : ""}
                                {v.comment ? ` — ${v.comment}` : ""}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* La règle du circuit, DITE AVANT le clic
                        ------------------------------------------------
                        « Une fois le devis refusé, on devrait pas le ré
                        accepter » — c'est déjà le cas, `decideValidation`
                        rejette toute décision rejouée. Mais cela ne
                        s'apprenait qu'en s'y cognant : le message n'arrive
                        qu'APRÈS, quand le mal est fait et qu'il n'y a plus
                        rien à en faire. Une règle irréversible qui ne se lit
                        qu'en aval n'est pas une règle, c'est un piège.
                        Affichée à qui a effectivement la main — les deux
                        boutons sont juste au-dessus — et pour les DEUX sens :
                        une validation ne se reprend pas davantage qu'un
                        refus, et on l'oublie plus facilement. */}
                    {d.type === "devis" && d.validations.some(v => v.decision === "en_attente" && v.canDecide && !v.blocked) && (
                      <p className="mt-1.5 text-xs" style={{ color: "#8A6A1F" }}>
                        Validation ou refus, la décision est définitive : elle ne se rejoue pas.
                        Reprendre ce devis demandera d&apos;en déposer un nouveau.
                      </p>
                    )}

                    {/* L'unanimité doit se LIRE. « Pas engagé » n'explique
                        rien ; « en attente de 2 organisations sur 3 » dit
                        ce qui manque et à qui le demander.
                        Sauf après un refus : les échelons restants restent
                        `en_attente` en base, mais ne seront plus jamais
                        sollicités. Promettre alors « le montant sera engagé
                        lorsque toutes auront validé », c'est annoncer un
                        engagement devenu impossible et envoyer relancer une
                        organisation à qui on ne demande plus rien. */}
                    {d.type === "devis" && !refusalOf(d) && pendingOrgCount(d) > 0 && d.validations.length > 1 && (
                      <p className="mt-1.5 text-xs" style={{ color: "#B4690E" }}>
                        En attente de {pendingOrgCount(d)} organisation{pendingOrgCount(d) > 1 ? "s" : ""} sur {d.validations.length} :
                        le montant ne sera engagé que lorsque toutes auront validé.
                      </p>
                    )}

                    {/* Contrepartie du badge du tableau : le refus est dit
                        une fois pour la pièce, avec sa conséquence exacte.
                        Symétrique de la ligne « montant engagé » ci-dessous —
                        un devis tranché ne doit pas laisser le lecteur
                        déduire lui-même ce qui change. La suite dépend du
                        droit : indiquer « déposez un nouveau devis » à qui
                        n'a pas le formulaire sous les yeux ne ferait que
                        déplacer l'impasse. */}
                    {d.type === "devis" && refusalOf(d) && (
                      <p className="mt-1.5 text-xs" style={{ color: "#A3342C" }}>
                        Devis refusé : son montant ne sera pas engagé et le circuit s&apos;arrête là.
                        La ligne budgétaire, elle, n&apos;est pas verrouillée —{" "}
                        {canManage
                          ? "ajustez le prévisionnel si besoin, puis déposez un nouveau devis ci-dessous."
                          : "le dépôt d’un nouveau devis revient au gestionnaire du budget."}
                      </p>
                    )}

                    {/* Où est passée la corbeille. La question se pose au
                        moment où l'on cherche le bouton — donc ici, sous la
                        décision qui l'a fait disparaître, et pas dans un
                        message d'erreur qu'il faudrait provoquer pour le
                        lire. Rien pour l'administrateur : le bouton
                        « Purger » est sous ses yeux, et il dit ce qu'il
                        fait. */}
                    {canManage && isDecided(d) && !canPurge && (
                      <p className="mt-1.5 text-xs" style={{ color: "#66716B" }}>
                        Décision prise : cette pièce ne se retire plus — la trace du circuit reste au dossier.
                      </p>
                    )}

                    {d.type === "devis" && isEngagedDoc(d) && (
                      <p className="mt-1.5 text-xs" style={{ color: "var(--brand-accent,#0E6B5C)" }}>
                        Validé par {d.validations.length === 1 ? "l’organisation sollicitée" : `les ${d.validations.length} organisations sollicitées`} — montant engagé.
                      </p>
                    )}

                    {/* Facture, reçu, justificatif : marquer payé */}
                    {canManage && d.type !== "devis" && (
                      payingDoc?.id === d.id ? (
                        <form onSubmit={submitPaid} className="mt-2 flex items-end gap-2 flex-wrap">
                          <div>
                            <label htmlFor={`paid-at-${d.id}`} className="block text-xs mb-1" style={{ color: "#66716B" }}>
                              Date de paiement
                            </label>
                            <input id={`paid-at-${d.id}`} type="date" required value={payDate}
                              onChange={e => setPayDate(e.target.value)}
                              className="px-3 py-1.5 rounded-lg border text-sm" style={{ borderColor: "#E3E6E2" }} />
                          </div>
                          <button type="submit" disabled={pending}
                            className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold"
                            style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending ? 0.6 : 1 }}>
                            {pending ? "…" : "Confirmer"}
                          </button>
                          <button type="button" onClick={() => setPayingDoc(null)}
                            className="px-3 py-1.5 rounded-lg border text-xs font-medium" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
                            Annuler
                          </button>
                        </form>
                      ) : (
                        <button type="button" onClick={() => d.paid ? cancelPaid(d) : confirmPaid(d)} disabled={pending}
                          className="mt-2 text-xs font-medium"
                          style={{ color: d.paid ? "#66716B" : "var(--brand-accent,#0E6B5C)" }}>
                          {d.paid ? "Annuler le paiement" : "Marquer payée"}
                        </button>
                      )
                    )}
                  </li>
                ))}
              </ul>
            )}

            {canManage && (
              <form onSubmit={upload} className="rounded-xl border p-3 space-y-3" style={{ borderColor: "#E3E6E2" }}>
                <p className="text-sm font-medium" style={{ color: "#17211D" }}>Déposer une pièce</p>
                <label htmlFor={`bl-file-${lineId}`} className="block text-xs mb-1" style={{ color: "#66716B" }}>
                  Fichier *
                </label>
                <input id={`bl-file-${lineId}`} type="file" required
                  onChange={e => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={`bl-type-${lineId}`} className="block text-xs mb-1" style={{ color: "#66716B" }}>Nature</label>
                    <select id={`bl-type-${lineId}`} value={type} onChange={e => setType(e.target.value as DocType)}
                      className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "#E3E6E2" }}>
                      {BUDGET_DOC_TYPES.map(t => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`bl-amount-${lineId}`} className="block text-xs mb-1" style={{ color: "#66716B" }}>Montant (€)</label>
                    <input id={`bl-amount-${lineId}`} type="number" min={0} step="0.01" value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "#E3E6E2" }} />
                  </div>
                </div>
                {/* Message conditionnel : il ne concerne que le devis, et
                    s'affichait à tort sur Facture ou Reçu. */}
                {type === "devis" ? (
                  <p className="text-xs" style={{ color: "#66716B" }}>
                    {/* Texte hérité de la 0031, faux depuis la 0041 : le
                        financeur ne route plus rien. Décrire un circuit
                        que la base n'applique plus, c'est apprendre au
                        déposant à attendre une décision de la mauvaise
                        organisation. */}
                    Un devis part automatiquement en validation : d&apos;abord l&apos;organisation
                    porteuse du projet, puis l&apos;organisation coordinatrice. Le montant n&apos;est
                    engagé que lorsque les deux ont validé.
                  </p>
                ) : (
                  <p className="text-xs" style={{ color: "#66716B" }}>
                    Renseignez le montant pour que cette pièce alimente le « payé » une fois marquée réglée.
                  </p>
                )}
                <div className="flex justify-end">
                  <button type="submit" disabled={busy}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                    style={{ background: "var(--brand-accent,#0E6B5C)", opacity: busy ? 0.7 : 1 }}>
                    <Upload size={14} aria-hidden="true" /> {busy ? "Envoi…" : "Déposer"}
                  </button>
                </div>
              </form>
            )}

            <ErrorMessage>{error}</ErrorMessage>
          </div>
        </Modal>
      )}
    </div>
  )
}
