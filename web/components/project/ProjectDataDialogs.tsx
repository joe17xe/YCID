"use client"
import { useId, useState, useTransition } from "react"
import { Plus, Pencil, X, Undo2 } from "lucide-react"
import BaseModal, { ErrorMessage } from "@/components/ui/Modal"
import { ACCESS_ROLES, LINE_CATEGORIES, LINE_STATUS, IND_KINDS, MEETING_KINDS, DECISION_STATUS } from "@/lib/constants"
// La liste des rôles ne se recopie pas, elle se demande : c'est cette
// énumération-là qui a existé en cinq exemplaires divergents, et que
// `check:rbac` refuse de voir réapparaître hors de lib/rbac.ts.
import { rolesWith } from "@/lib/rbac"
import {
  saveBudgetLine, createTaskFromBudgetLine, createIndicator, addMeasure, createMeeting, updateMeeting, saveDecision,
  type BudgetLineInput, type IndicatorInput, type MeasureInput, type MeetingInput, type DecisionInput,
} from "@/app/(app)/projets/[id]/actions"

const inputCls = "w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
const border = { borderColor: "#E3E6E2" }

export interface Option { id: string; name: string }
// Une tâche porte sa phase : le sélecteur de tâche se restreint à la
// phase choisie, et choisir une tâche suffit à situer la ligne.
//
// `budget` = ce que la tâche reçoit AUJOURD'HUI, toutes lignes
// confondues et hors valorisation. Le dialogue en a besoin pour dire ce
// que devient ce budget si l'on réduit l'affectation qu'on est en train
// d'éditer : sans lui, on annoncerait « 0 € » à une tâche que trois
// autres lignes financent — le co-financement est la règle, pas
// l'exception.
export interface TaskOption extends Option { phase_id: string; budget: number }

// Dialogue accessible (RGAA) : le composant partagé gère role="dialog",
// le piège de focus, Échap et la restitution du focus. Ici on ne monte le
// dialogue que lorsqu'il est ouvert, d'où `open` toujours vrai.
function Modal({ title, onClose, busy, children }: { title: string; onClose: () => void; busy?: boolean; children: React.ReactNode }) {
  return <BaseModal open onClose={onClose} title={title} busy={busy} maxWidth="max-w-lg">{children}</BaseModal>
}

// Champ étiqueté : l'identifiant est généré pour que <label for> pointe
// bien sur le contrôle (RGAA 11.1), même si le dialogue est instancié
// plusieurs fois dans la page.
function Field({ label, className, children }: {
  label: React.ReactNode
  className?: string
  children: (id: string) => React.ReactNode
}) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>{label}</label>
      {children(id)}
    </div>
  )
}

function useDialog(action: () => Promise<{ ok: boolean; error?: string }>) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const res = await action()
      if (res.ok) setOpen(false)
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }
  return { open, setOpen, error, pending, submit }
}

// `pending` = traitement en cours (libellé « … »), `blocked` = saisie
// invalide. Confondre les deux affichait « … » sur un bouton bloqué par
// une répartition excédentaire : l'utilisateur croyait l'enregistrement
// en cours alors qu'il était refusé.
//
// `blockedReason` : un bouton éteint qui ne dit pas pourquoi est un
// bouton mort. Le motif l'accompagne donc — au survol comme au lecteur
// d'écran, via aria-disabled plutôt que `disabled` seul, qui sort le
// bouton de l'ordre de tabulation et emporte son intitulé avec lui.
function Actions({ pending, blocked = false, blockedReason, onClose, label }: {
  pending: boolean; blocked?: boolean; blockedReason?: string; onClose: () => void; label: string
}) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ ...border, color: "#66716B" }}>Annuler</button>
      <button type="submit" disabled={pending || blocked}
        aria-disabled={blocked || undefined}
        title={blocked ? blockedReason : undefined}
        className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending || blocked ? 0.5 : 1 }}>
        {pending ? "…" : label}
      </button>
    </div>
  )
}

// ------------------------------------------------------------
// Lecture et écriture des montants du dialogue
// ------------------------------------------------------------
// Même conversion que `saveBudgetLine` côté serveur — la virgule du
// clavier français, le champ vide qui vaut zéro. Ce n'est pas une règle
// de gestion dupliquée, c'est la lecture d'un champ de saisie ; la
// règle, elle (« la répartition ne dépasse pas la ligne »), reste
// tranchée par l'action et par le trigger.
const num = (v: string | number | null | undefined): number => {
  const n = Number(String(v ?? "").replace(",", ".") || "0")
  return Number.isFinite(n) ? n : 0
}
// Pas `fmtEur` de lib/constants : il ARRONDIT à l'euro. Sur un écart de
// répartition, un « reste 0 € » qui vaut en réalité −0,40 € laisserait
// l'enregistrement refusé sans que rien à l'écran ne l'explique — la
// tolérance du contrôle est au demi-centime, l'affichage doit la suivre.
const eur = (n: number): string => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`
// Valeur réinjectée dans un <input type="number"> : séparateur décimal
// anglais obligatoire, sinon le champ se vide en silence.
const amountValue = (n: number): string => String(Math.round(n * 100) / 100)

// Qui a la main sur une répartition. Lu dans la matrice, jamais recopié.
// Les administrateurs plateforme passent au-dessus des rôles projet
// (colonne `admin` de la matrice, et `canEditCompleted` côté page) :
// ils ne sont pas un rôle projet, d'où la mention à part.
const BUDGET_MANAGERS = rolesWith("budget.manage")
  .map(r => ACCESS_ROLES[r]?.label ?? r)
  .join(", ")

/* ============ Ligne budgétaire ============ */
export function BudgetLineDialog({ projectId, orgs, phases, tasks = [], line, preset, triggerLabel }: {
  projectId: string; orgs: Option[]; phases: Option[]; tasks?: TaskOption[]
  line?: Omit<BudgetLineInput, "projectId" | "lineId"> & { id: string }
  // Création croisée : depuis une tâche, on ouvre ce dialogue déjà
  // rattaché à elle — plutôt qu'une action dédiée, puisque tout le reste
  // de la ligne (poste, financeur, montant) reste à saisir.
  preset?: { phase_id: string; task_id: string }
  triggerLabel?: string
}) {
  const [form, setForm] = useState({
    poste: line?.poste ?? "", description: line?.description ?? "", category: line?.category ?? "autre",
    funder_org_id: line?.funder_org_id ?? "", owner_org_id: line?.owner_org_id ?? "",
    phase_id: line?.phase_id ?? preset?.phase_id ?? "",
    allocations: line?.allocations ?? (preset ? [{ task_id: preset.task_id, amount: "" }] : []),
    year: line?.year ?? "", planned_amount: line?.planned_amount ?? "", is_valorisation: line?.is_valorisation ?? false,
    status: line?.status ?? "prevue", comment: line?.comment ?? "",
  })
  const d = useDialog(() => saveBudgetLine({ projectId, lineId: line?.id, ...form }))

  // Tant qu'aucune phase n'est choisie, on propose toutes les tâches :
  // en sélectionner une renseigne la phase, plutôt que d'imposer deux
  // choix dans un ordre précis.
  const visibleTasks = form.phase_id ? tasks.filter(t => t.phase_id === form.phase_id) : tasks

  // Ce qu'on vient de retirer, et qui se rétablit d'un clic. Un X posé
  // par erreur sur une affectation de 7 100 € demandait sinon de
  // retrouver la tâche ET le montant de mémoire — or c'est justement le
  // montant qu'on ne connaît plus une fois la ligne effacée.
  const [undoRemoval, setUndoRemoval] = useState<{ index: number; task_id: string; amount: string; name: string } | null>(null)
  // Affectations écartées par un changement de phase. Elles ne se
  // rétablissent pas — la tâche n'est plus dans la phase de la ligne —
  // mais elles se NOMMENT : elles partaient jusqu'ici sans un mot.
  const [phaseDropped, setPhaseDropped] = useState<{ name: string; amount: number }[]>([])

  const taskName = (id: string) => tasks.find(t => t.id === id)?.name ?? "Affectation sans tâche"

  // Répartition : le total affecté ne peut pas dépasser le montant de la
  // ligne, qui reste la vérité de la convention. Le reste est affiché
  // plutôt que déduit de tête.
  const lineAmount = num(form.planned_amount)
  const allocated = form.allocations.reduce((s, a) => s + num(a.amount), 0)
  const rest = lineAmount - allocated
  const overAllocated = rest < -0.005
  const excess = -rest

  // ---- Ce que l'enregistrement va changer --------------------------
  // `saveBudgetLine` PURGE les affectations de la ligne puis réinsère
  // celles du formulaire : une affectation retirée ou réduite ici
  // disparaît définitivement. Et comme le budget d'une tâche est
  // TOUJOURS la somme des affectations qu'elle reçoit, la baisse ne
  // s'arrête pas au budget — ce budget sert de POIDS à l'avancement de
  // la phase (pondération à plancher, écran projet), donc le
  // pourcentage affiché bouge aussi.
  //
  // Scénario qui a motivé ce bloc (recette du Product Owner) : une
  // ligne passée de 7 100 € à 5 100 € refusait de s'enregistrer — « la
  // répartition dépasse le montant de la ligne », six mots. Il a retiré
  // l'affectation de 7 100 €, et rien ne lui a dit que la tâche
  // financée retombait à 0 €, ni que l'avancement de sa phase allait
  // changer. « Il faut bien étudier les impacts. »
  //
  // La comparaison porte sur `line.allocations`, l'état EN BASE — pas
  // sur un instantané du formulaire. Elle rattrape donc aussi ce que
  // `selectPhase` a écarté, et ce qui a été retiré puis remplacé.
  const savedByTask = new Map((line?.allocations ?? []).map(a => [a.task_id, num(a.amount)]))
  const formByTask = new Map<string, number>()
  for (const a of form.allocations) {
    // Une même tâche deux fois est refusée par l'action : on somme tout
    // de même, sinon l'impact annoncé ne serait pas celui du formulaire.
    if (a.task_id) formByTask.set(a.task_id, (formByTask.get(a.task_id) ?? 0) + num(a.amount))
  }
  // Ce que les AUTRES lignes apportent à la tâche. Une ligne valorisée
  // n'entre pas dans le budget d'une tâche (elle s'affiche « en
  // nature », à part) : ses affectations ne sont donc pas à retrancher.
  const fromOtherLines = (taskId: string) => {
    const total = tasks.find(t => t.id === taskId)?.budget ?? 0
    return Math.max(0, total - (form.is_valorisation ? 0 : savedByTask.get(taskId) ?? 0))
  }
  // À la création, rien n'est écrasé : la répartition qu'on lit est
  // celle qu'on écrit, et un bilan d'impact ne dirait que ce qui est
  // déjà à l'écran.
  const impacts = line
    ? [...new Set([...savedByTask.keys(), ...formByTask.keys()])]
      .map(taskId => ({
        taskId,
        name: taskName(taskId),
        before: savedByTask.get(taskId) ?? 0,
        after: formByTask.get(taskId) ?? 0,
        others: fromOtherLines(taskId),
      }))
      .filter(x => Math.abs(x.after - x.before) > 0.005)
      // La perte la plus lourde en tête : c'est elle qu'on ne voit pas
      // venir. Les gains ferment la liste.
      .sort((a, b) => (a.after - a.before) - (b.after - b.before))
    : []
  const lossCount = impacts.filter(x => x.after < x.before).length

  // Changer de phase invalide les affectations sorties de la phase —
  // sinon le trigger de cohérence rejetterait l'enregistrement. Ce
  // filtrage effaçait des montants sans un mot : il les nomme désormais.
  function selectPhase(phase_id: string) {
    const inPhase = (a: { task_id: string }) => tasks.some(t => t.id === a.task_id && t.phase_id === phase_id)
    // Le partage se calcule ici, pas dans la mise à jour d'état : un
    // `setPhaseDropped` niché dans le calculateur de `setForm` serait
    // rejoué au double rendu de développement, et le message
    // s'accumulerait.
    setPhaseDropped(form.allocations
      .filter(a => !inPhase(a) && (a.task_id || num(a.amount) > 0))
      .map(a => ({ name: taskName(a.task_id), amount: num(a.amount) })))
    setForm(f => ({ ...f, phase_id, allocations: f.allocations.filter(inPhase) }))
  }
  function addAllocation() {
    setForm(f => ({ ...f, allocations: [...f.allocations, { task_id: "", amount: "" }] }))
  }
  function removeAllocation(i: number) {
    const a = form.allocations[i]
    // Une ligne vierge ajoutée par erreur se retire sans cérémonie ; une
    // affectation qui porte une tâche ou un montant s'annonce.
    setUndoRemoval(a.task_id || num(a.amount) > 0
      ? { index: i, task_id: a.task_id, amount: a.amount, name: taskName(a.task_id) }
      : null)
    setForm(f => ({ ...f, allocations: f.allocations.filter((_, j) => j !== i) }))
  }
  // Intitulé du bouton de retrait, partagé entre `title` et
  // `aria-label` : la souris et le lecteur d'écran doivent lire la même
  // conséquence. `index` n'est fourni que pour l'aria-label, qui doit
  // rester distinct d'un bouton à l'autre même sans tâche choisie.
  function removalLabel(a: { task_id: string; amount: string }, index?: number): string {
    if (!a.task_id) return index == null ? "Retirer cette affectation" : `Retirer l'affectation ${index + 1}, sans tâche choisie`
    const montant = num(a.amount)
    return montant > 0
      ? `Retirer « ${taskName(a.task_id)} » de la répartition — ${eur(montant)} ne lui seront plus affectés à l'enregistrement`
      : `Retirer « ${taskName(a.task_id)} » de la répartition`
  }
  // Rétablir une tâche déjà revenue au formulaire créerait un doublon,
  // que l'action refuse (« une même tâche ne peut apparaître deux
  // fois »). Dans ce cas la donnée n'est plus perdue : l'encart n'a
  // plus lieu d'être.
  const canRestore = !!undoRemoval
    && !form.allocations.some(a => !!a.task_id && a.task_id === undoRemoval.task_id)

  function restoreRemoval() {
    if (!undoRemoval) return
    const { index, task_id, amount } = undoRemoval
    setForm(f => {
      const next = [...f.allocations]
      next.splice(Math.min(index, next.length), 0, { task_id, amount })
      return { ...f, allocations: next }
    })
    setUndoRemoval(null)
  }
  // ---- Ramener la répartition sous le montant de la ligne -----------
  // Bloquer en rouge sans issue oblige à recalculer à la main sur un
  // coin de table, puis à retaper chaque montant. Les deux gestes qui
  // corrigent VRAIMENT sont proposés : au prorata (on garde les
  // proportions du plan de financement) ou sur une seule affectation
  // (on sait laquelle a bougé).
  //
  // L'arrondi se fait au centime PAR DÉFAUT sur chaque part, le
  // reliquat allant à la plus grosse : arrondir chaque part au plus
  // près pouvait dépasser d'un centime, et l'enregistrement serait resté
  // bloqué après avoir cliqué sur le bouton censé le débloquer.
  function scaleToLine() {
    const rows = form.allocations.map(a => num(a.amount))
    const total = rows.reduce((s, v) => s + v, 0)
    if (total <= 0) return
    const scaled = rows.map(v => Math.floor((v * lineAmount / total) * 100) / 100)
    const residue = Math.round((lineAmount - scaled.reduce((s, v) => s + v, 0)) * 100) / 100
    if (residue > 0 && scaled.length) {
      const biggest = scaled.reduce((best, v, i) => (v > scaled[best] ? i : best), 0)
      scaled[biggest] = Math.round((scaled[biggest] + residue) * 100) / 100
    }
    setForm(f => ({ ...f, allocations: f.allocations.map((a, i) => ({ ...a, amount: amountValue(scaled[i]) })) }))
  }
  function absorbHere(i: number) {
    setAllocation(i, { amount: amountValue(Math.max(0, num(form.allocations[i].amount) - excess)) })
  }
  // Choisir une tâche alors qu'aucune phase n'est fixée renseigne la
  // phase : la ligne se situe d'elle-même.
  function setAllocation(i: number, patch: { task_id?: string; amount?: string }) {
    setForm(f => {
      const allocations = f.allocations.map((a, j) => (j === i ? { ...a, ...patch } : a))
      const t = patch.task_id ? tasks.find(x => x.id === patch.task_id) : undefined
      return { ...f, allocations, phase_id: !f.phase_id && t ? t.phase_id : f.phase_id }
    })
  }
  return (
    <>
      {line ? (
        <button onClick={() => d.setOpen(true)} className="p-1 rounded-full hover:bg-gray-100"
          aria-label={`Modifier la ligne budgétaire ${line.poste}`} title="Modifier la ligne">
          <Pencil size={13} style={{ color: "#66716B" }} aria-hidden="true" />
        </button>
      ) : triggerLabel ? (
        <button onClick={() => d.setOpen(true)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border bg-white text-xs font-medium"
          style={{ borderColor: "#E3E6E2", color: "var(--brand-accent,#0E6B5C)" }}
          title="Créer une ligne budgétaire rattachée à cette tâche">
          <Plus size={11} aria-hidden="true" /> {triggerLabel}
        </button>
      ) : (
        <button onClick={() => d.setOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: "var(--brand-accent,#0E6B5C)" }}>
          <Plus size={15} aria-hidden="true" /> Ligne budgétaire
        </button>
      )}
      {d.open && (
        <Modal title={line ? "Modifier la ligne" : "Nouvelle ligne budgétaire"} busy={d.pending} onClose={() => d.setOpen(false)}>
          <form onSubmit={d.submit} className="space-y-3">
            <Field label="Poste *">{id => (
              <input id={id} value={form.poste} onChange={e => setForm({ ...form, poste: e.target.value })} required className={inputCls} style={border} />
            )}</Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Catégorie">{id => (
                <select id={id} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inputCls} style={border}>
                  {Object.entries(LINE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              )}</Field>
              <Field label="Montant prévisionnel (€) *">{id => (
                <input id={id} type="number" min={0} step="0.01" value={form.planned_amount} onChange={e => setForm({ ...form, planned_amount: e.target.value })} required className={inputCls} style={border} />
              )}</Field>
              <Field label="Financeur">{id => (
                <select id={id} value={form.funder_org_id} onChange={e => setForm({ ...form, funder_org_id: e.target.value })} className={inputCls} style={border}>
                  <option value="">—</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              )}</Field>
              <Field label="Org. responsable">{id => (
                <select id={id} value={form.owner_org_id} onChange={e => setForm({ ...form, owner_org_id: e.target.value })} className={inputCls} style={border}>
                  <option value="">—</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              )}</Field>
              <Field label="Phase">{id => (
                <select id={id} value={form.phase_id} onChange={e => selectPhase(e.target.value)} className={inputCls} style={border}>
                  <option value="">—</option>
                  {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}</Field>
              <Field label="Année">{id => (
                <input id={id} type="number" min={2000} max={2100} value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} className={inputCls} style={border} />
              )}</Field>
              <Field label="Statut">{id => (
                <select id={id} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputCls} style={border}>
                  {Object.entries(LINE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              )}</Field>
              <label className="flex items-center gap-2 text-sm mt-6" style={{ color: "#17211D" }}>
                <input type="checkbox" checked={form.is_valorisation} onChange={e => setForm({ ...form, is_valorisation: e.target.checked })} />
                Valorisation (apport non financier)
              </label>
            </div>
            {/* Répartition sur les tâches : le montant de la ligne reste
                celui de la convention, la répartition vient par-dessus. */}
            <fieldset className="rounded-xl border p-3" style={border}>
              <legend className="px-1 text-sm font-medium" style={{ color: "#17211D" }}>Tâches financées</legend>
              {form.allocations.length === 0 && (
                <p className="text-xs" style={{ color: "#66716B" }}>
                  Aucune tâche affectée. Laissez ainsi pour les valorisations et les frais de structure.
                </p>
              )}
              <div className="space-y-2">
                {form.allocations.map((a, i) => {
                  // Ce que cette affectation peut absorber à elle seule. Le
                  // bouton n'apparaît que si le retrait tient dans son
                  // montant : proposer « retirer 2 000 € » à une affectation
                  // de 300 € donnerait un montant négatif, refusé plus loin.
                  const canAbsorb = overAllocated && num(a.amount) >= excess - 0.005
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <label className="block text-xs mb-1" style={{ color: "#66716B" }} htmlFor={`alloc-task-${i}`}>Tâche</label>
                          <select id={`alloc-task-${i}`} value={a.task_id} required
                            onChange={e => setAllocation(i, { task_id: e.target.value })} className={inputCls} style={border}>
                            <option value="">— choisir</option>
                            {visibleTasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </div>
                        <div className="w-32">
                          <label className="block text-xs mb-1" style={{ color: "#66716B" }} htmlFor={`alloc-amount-${i}`}>Montant (€)</label>
                          <input id={`alloc-amount-${i}`} type="number" min={0} step="0.01" value={a.amount}
                            onChange={e => setAllocation(i, { amount: e.target.value })} className={inputCls} style={border} />
                        </div>
                        {/* L'intitulé nomme ce qu'on retire et combien : « la
                            tâche 2 » ne disait ni laquelle ni ce qu'elle
                            emportait, alors que le retrait devient définitif
                            à l'enregistrement. Le montant n'entre dans la
                            phrase que s'il y en a un — « 0 € ne lui seront
                            plus affectés » se lit comme une alarme pour rien. */}
                        <button type="button" onClick={() => removeAllocation(i)}
                          className="p-2 rounded-lg hover:bg-gray-100"
                          title={removalLabel(a)} aria-label={removalLabel(a, i)}>
                          <X size={15} style={{ color: "#66716B" }} aria-hidden="true" />
                        </button>
                      </div>
                      {canAbsorb && (
                        <button type="button" onClick={() => absorbHere(i)}
                          className="text-xs px-2 py-1 rounded-lg border bg-white font-medium"
                          style={{ ...border, color: "#A3342C" }}>
                          Retirer {eur(excess)} ici → {eur(Math.max(0, num(a.amount) - excess))}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              {/* Un retrait se rattrape tant que le dialogue est ouvert.
                  Après l'enregistrement, plus rien : l'action purge la
                  répartition de la ligne avant de réécrire celle du
                  formulaire. */}
              {undoRemoval && canRestore && (
                <div role="status" aria-live="polite"
                  className="mt-2 rounded-xl p-2.5 text-xs flex flex-wrap items-center justify-between gap-2"
                  style={{ background: "#F5F6F4", color: "#66716B" }}>
                  <span>
                    <strong style={{ color: "#17211D" }}>{undoRemoval.name}</strong> retirée de la répartition
                    {num(undoRemoval.amount) > 0 && <> — {eur(num(undoRemoval.amount))} ne lui seront plus affectés</>}.
                    Le retrait devient définitif à l&apos;enregistrement.
                  </span>
                  <button type="button" onClick={restoreRemoval}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border bg-white font-medium flex-shrink-0"
                    style={{ ...border, color: "var(--brand-accent,#0E6B5C)" }}>
                    <Undo2 size={12} aria-hidden="true" /> Rétablir
                  </button>
                </div>
              )}
              {phaseDropped.length > 0 && (
                <div role="status" aria-live="polite" className="mt-2 rounded-xl p-2.5 text-xs"
                  style={{ background: "#F7EDDD", color: "#8A6A1F" }}>
                  Changement de phase :{" "}
                  {phaseDropped.map((x, i) => (
                    <span key={i}>{i > 0 && ", "}<strong>{x.name}</strong> ({eur(x.amount)})</span>
                  ))}{" "}
                  {phaseDropped.length > 1 ? "ont été retirées" : "a été retirée"} de la répartition :
                  une affectation ne peut viser qu&apos;une tâche de la phase de la ligne.
                </div>
              )}
              <div className="flex items-center justify-between gap-3 mt-2">
                <button type="button" onClick={addAllocation}
                  className="flex items-center gap-1 text-sm font-medium" style={{ color: "var(--brand-accent,#0E6B5C)" }}>
                  <Plus size={14} aria-hidden="true" /> Ajouter une tâche
                </button>
                {form.allocations.length > 0 && (
                  <span className="text-xs" style={{ color: overAllocated ? "#A3342C" : "#66716B" }}>
                    Réparti {eur(allocated)} · reste {eur(rest)}
                  </span>
                )}
              </div>
              {/* Le dépassement disait « la répartition dépasse le montant
                  de la ligne » et éteignait Enregistrer. Six mots pour une
                  impasse : il fallait recalculer de tête, puis retaper.
                  Le bouton reste éteint — le serveur applique la même
                  règle, et proposer une action qu'il refusera est un
                  défaut d'interface — mais l'écart est chiffré et les
                  gestes qui le referment sont à un clic. */}
              {overAllocated && (
                <div className="mt-2 rounded-xl p-3 text-xs" style={{ background: "#F6E7E5", color: "#A3342C" }}>
                  <p>
                    <strong>La répartition dépasse le montant de la ligne de {eur(excess)}.</strong>{" "}
                    {eur(lineAmount)} sont prévus sur la ligne, {eur(allocated)} sont répartis.
                    L&apos;enregistrement reste refusé tant que les deux ne se rejoignent pas.
                  </p>
                  {form.allocations.length > 1 && (
                    <button type="button" onClick={scaleToLine}
                      className="mt-2 px-2 py-1 rounded-lg border bg-white font-medium"
                      style={{ ...border, color: "#A3342C" }}
                      title="Réduit chaque affectation dans la même proportion — le plan de financement garde ses équilibres.">
                      Ramener la répartition à {eur(lineAmount)}, au prorata
                    </button>
                  )}
                  <p className="mt-2">
                    Ou remontez le montant prévisionnel : c&apos;est lui qui doit refléter la convention,
                    la répartition vient par-dessus.
                  </p>
                </div>
              )}
              {/* L'impact, en euros et par tâche. Le budget d'une tâche
                  EST la somme de ses affectations : le lire après coup
                  dans l'onglet Tâches, c'est le découvrir trop tard. */}
              {/* Volontairement SANS aria-live, à l'inverse des deux
                  encarts ci-dessus : ce bloc se réécrit à chaque frappe
                  dans un champ « Montant ». Annoncé en direct, il
                  couvrirait la saisie d'un flot de rectificatifs. Les
                  encarts de retrait, eux, apparaissent une fois par
                  geste — c'est exactement ce pour quoi une région vivante
                  existe. */}
              {impacts.length > 0 && (
                <div className="mt-2 rounded-xl p-3 text-xs"
                  style={lossCount
                    ? { background: "#F7EDDD", color: "#8A6A1F" }
                    : { background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }}>
                  <p className="font-semibold">Ce que l&apos;enregistrement va changer</p>
                  <ul className="mt-1 space-y-1">
                    {impacts.map(x => {
                      const delta = x.after - x.before
                      const budget = x.others + x.after
                      return (
                        <li key={x.taskId}>
                          <strong>{x.name}</strong> : {eur(x.before)} → {eur(x.after)}{" "}
                          ({delta > 0 ? "+" : "−"}{eur(Math.abs(delta))} sur cette ligne)
                          {form.is_valorisation
                            ? <> — apport en nature : il ne compte pas dans le budget de la tâche,
                                mais il disparaîtra de ce qu&apos;elle reçoit en nature.</>
                            : x.others > 0
                              ? <> — {eur(x.others)} lui viennent d&apos;autres lignes : son budget passera
                                  de {eur(x.others + x.before)} à {eur(budget)}.</>
                              : budget > 0.005
                                ? <> — aucune autre ligne ne la finance : son budget sera exactement ce montant.</>
                                : <> — aucune autre ligne ne la finance : son budget tombe à 0 €, et elle ne
                                    pèsera plus que le poids plancher dans l&apos;avancement pondéré de sa phase.</>}
                        </li>
                      )
                    })}
                  </ul>
                  {lossCount > 0 && (
                    <p className="mt-2">
                      Enregistrer remplace la répartition entière de cette ligne : ce qui n&apos;est plus
                      listé ci-dessus est effacé, et ne se retrouve nulle part ailleurs.
                    </p>
                  )}
                </div>
              )}
              <p className="text-xs mt-2" style={{ color: "#66716B" }}>
                Une ligne peut se répartir sur plusieurs tâches (40 000 € = 10 000 € + 30 000 €),
                et plusieurs lignes peuvent financer la même tâche (co-financement).
                Le budget d&apos;une tâche est la somme des affectations qu&apos;elle reçoit — c&apos;est
                aussi ce qui la pondère dans l&apos;avancement de sa phase.
              </p>
              {/* « Qui peut modifier une répartition ? » — la question du
                  Product Owner. La réponse se lit là où le geste se fait,
                  pas seulement dans l'écran Accès & rôles. */}
              <p className="text-xs mt-1" style={{ color: "#66716B" }}>
                Peuvent modifier cette répartition : {BUDGET_MANAGERS}, ainsi que les
                administrateurs de la plateforme. Chaque enregistrement remplace le précédent
                et s&apos;inscrit au journal d&apos;audit du projet.
              </p>
            </fieldset>
            <Field label="Commentaire">{id => (
              <input id={id} value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} className={inputCls} style={border} />
            )}</Field>
            <ErrorMessage>{d.error}</ErrorMessage>
            <Actions pending={d.pending} blocked={overAllocated}
              blockedReason={`La répartition dépasse le montant de la ligne de ${eur(excess)} : le serveur refuserait l'enregistrement. Ramenez-la à ${eur(lineAmount)}, ou remontez le montant prévisionnel.`}
              onClose={() => d.setOpen(false)} label={line ? "Enregistrer" : "Créer la ligne"} />
          </form>
        </Modal>
      )}
    </>
  )
}

/* ============ Créer la tâche depuis une ligne budgétaire ============ */
// Sens inverse de la création croisée. Pas de dialogue : tout ce qu'il
// faut est déjà sur la ligne (poste → titre, phase, montant restant).
export function CreateTaskFromLineButton({ projectId, lineId, poste }: {
  projectId: string; lineId: string; poste: string
}) {
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  function run() {
    setError("")
    startTransition(async () => {
      const res = await createTaskFromBudgetLine({ projectId, lineId })
      if (!res.ok) setError(res.error ?? "Une erreur est survenue.")
    })
  }
  return (
    <>
      <button type="button" onClick={run} disabled={pending}
        className="flex items-center gap-1 text-xs font-medium whitespace-nowrap"
        style={{ color: "var(--brand-accent,#0E6B5C)", opacity: pending ? 0.6 : 1 }}
        title={`Créer la tâche « ${poste} » dans la phase de cette ligne`}>
        <Plus size={12} aria-hidden="true" /> {pending ? "…" : "Créer la tâche"}
      </button>
      {error && <p className="text-xs mt-1" style={{ color: "#A3342C" }}>{error}</p>}
    </>
  )
}

/* ============ Indicateur ============ */
export function IndicatorDialog({ projectId, phases }: { projectId: string; phases: Option[] }) {
  const [form, setForm] = useState<Omit<IndicatorInput, "projectId">>({
    name: "", description: "", kind: "quantitatif", unit: "", target: "", baseline: "", phase_id: "",
  })
  const d = useDialog(() => createIndicator({ projectId, ...form }))
  return (
    <>
      <button onClick={() => d.setOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: "var(--brand-accent,#0E6B5C)" }}>
        <Plus size={15} aria-hidden="true" /> Indicateur
      </button>
      {d.open && (
        <Modal title="Nouvel indicateur" busy={d.pending} onClose={() => d.setOpen(false)}>
          <form onSubmit={d.submit} className="space-y-3">
            <Field label="Nom *">{id => (
              <input id={id} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className={inputCls} style={border} />
            )}</Field>
            <Field label="Description">{id => (
              <input id={id} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputCls} style={border} />
            )}</Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Type">{id => (
                <select id={id} value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })} className={inputCls} style={border}>
                  {Object.entries(IND_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              )}</Field>
              <Field label="Unité">{id => (
                <input id={id} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="jeunes, km…" className={inputCls} style={border} />
              )}</Field>
              <Field label="Cible *">{id => (
                <input id={id} type="number" step="0.01" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} required className={inputCls} style={border} />
              )}</Field>
              <Field label="Valeur initiale">{id => (
                <input id={id} type="number" step="0.01" value={form.baseline} onChange={e => setForm({ ...form, baseline: e.target.value })} className={inputCls} style={border} />
              )}</Field>
              <Field label="Phase (optionnel)" className="col-span-2">{id => (
                <select id={id} value={form.phase_id} onChange={e => setForm({ ...form, phase_id: e.target.value })} className={inputCls} style={border}>
                  <option value="">—</option>
                  {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}</Field>
            </div>
            <ErrorMessage>{d.error}</ErrorMessage>
            <Actions pending={d.pending} onClose={() => d.setOpen(false)} label="Créer l'indicateur" />
          </form>
        </Modal>
      )}
    </>
  )
}

/* ============ Mesure d'indicateur ============ */
export function MeasureDialog({ indicatorId, indicatorName, unit }: { indicatorId: string; indicatorName: string; unit?: string }) {
  const [form, setForm] = useState<Omit<MeasureInput, "indicatorId">>({ period: "", value: "", comment: "" })
  const d = useDialog(() => addMeasure({ indicatorId, ...form }))
  return (
    <>
      <button onClick={() => d.setOpen(true)} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium hover:bg-gray-50" style={{ ...border, color: "var(--brand-accent,#0E6B5C)" }}
        aria-label={`Ajouter une mesure pour ${indicatorName}`}>
        <Plus size={12} aria-hidden="true" /> Mesure
      </button>
      {d.open && (
        <Modal title={`Nouvelle mesure — ${indicatorName}`} busy={d.pending} onClose={() => d.setOpen(false)}>
          <form onSubmit={d.submit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Période *">{id => (
                <input id={id} value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} required placeholder="2026-T3" className={inputCls} style={border} />
              )}</Field>
              <Field label={`Valeur * ${unit ? `(${unit})` : ""}`}>{id => (
                <input id={id} type="number" step="0.01" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} required className={inputCls} style={border} />
              )}</Field>
            </div>
            <Field label="Commentaire">{id => (
              <input id={id} value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} className={inputCls} style={border} />
            )}</Field>
            <ErrorMessage>{d.error}</ErrorMessage>
            <Actions pending={d.pending} onClose={() => d.setOpen(false)} label="Enregistrer la mesure" />
          </form>
        </Modal>
      )}
    </>
  )
}

/* ============ Réunion ============ */
// Calendrier des réunions (0051) : heure, lieu et invités par compte.
// `participantsReady` dit si la migration est passée — sans elle, le
// dialogue reste celui d'avant (titre, type, date, compte rendu) et
// n'envoie aucun champ nouveau.
// En édition (`meeting` fourni), le déclencheur devient un crayon —
// même motif que DecisionDialog — et l'enregistrement passe par
// updateMeeting : ajouts invités, retraits sortis, et une date qui
// bouge remet les réponses « en attente ».
export function MeetingDialog({ projectId, members = [], participantsReady = false, orgGroups = [], meeting }: {
  projectId: string; members?: Option[]; participantsReady?: boolean
  // Invitations par organisation (0053) : « YCID veut voir LEY » —
  // une pastille par organisation du projet, qui coche ses comptes.
  orgGroups?: { name: string; memberIds: string[] }[]
  meeting?: {
    id: string; title: string; kind: string; date: string
    start_time: string; location: string; video_url: string; minutes: string
    participantIds: string[]
  }
}) {
  const [form, setForm] = useState<Omit<MeetingInput, "projectId" | "participantIds">>({
    title: meeting?.title ?? "", kind: meeting?.kind ?? "copil", date: meeting?.date ?? "",
    minutes: meeting?.minutes ?? "", start_time: meeting?.start_time ?? "",
    location: meeting?.location ?? "", video_url: meeting?.video_url ?? "",
  })
  const [invited, setInvited] = useState<Set<string>>(new Set(meeting?.participantIds ?? []))
  const d = useDialog(() => {
    const payload = {
      projectId, ...form,
      ...(participantsReady ? { participantIds: [...invited] } : {}),
    }
    return meeting ? updateMeeting({ ...payload, meetingId: meeting.id }) : createMeeting(payload)
  })

  function toggleInvite(id: string) {
    const next = new Set(invited)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setInvited(next)
  }

  // Cocher une organisation coche tous ses comptes ; recliquer les
  // décoche tous — l'ajustement fin se fait ensuite compte par compte.
  function toggleOrg(g: { memberIds: string[] }) {
    const next = new Set(invited)
    const all = g.memberIds.every(id => next.has(id))
    for (const id of g.memberIds) {
      if (all) next.delete(id)
      else next.add(id)
    }
    setInvited(next)
  }

  return (
    <>
      {meeting ? (
        <button onClick={() => d.setOpen(true)} className="p-1 rounded-full hover:bg-gray-100"
          aria-label={`Modifier la réunion ${meeting.title}`} title="Modifier la réunion">
          <Pencil size={13} style={{ color: "#66716B" }} aria-hidden="true" />
        </button>
      ) : (
        <button onClick={() => d.setOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: "var(--brand-accent,#0E6B5C)" }}>
          <Plus size={15} aria-hidden="true" /> Réunion
        </button>
      )}
      {d.open && (
        <Modal title={meeting ? "Modifier la réunion" : "Nouvelle réunion"} busy={d.pending} onClose={() => d.setOpen(false)}>
          <form onSubmit={d.submit} className="space-y-3">
            <Field label="Titre *">{id => (
              <input id={id} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required className={inputCls} style={border} />
            )}</Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Type">{id => (
                <select id={id} value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })} className={inputCls} style={border}>
                  {Object.entries(MEETING_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              )}</Field>
              <Field label="Date *">{id => (
                <input id={id} type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required className={inputCls} style={border} />
              )}</Field>
              {participantsReady && (
                <>
                  <Field label="Heure">{id => (
                    <input id={id} type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} className={inputCls} style={border} />
                  )}</Field>
                  <Field label="Lieu">{id => (
                    <input id={id} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className={inputCls} style={border} placeholder="Mairie de Villepreux…" />
                  )}</Field>
                </>
              )}
            </div>
            {participantsReady && (
              <Field label="Lien visio (Teams, Meet…)">{id => (
                <>
                  <input id={id} type="url" value={form.video_url} onChange={e => setForm({ ...form, video_url: e.target.value })}
                    className={inputCls} style={border} placeholder="https://meet.google.com/…" />
                  {/* Pas d'intégration native (OAuth par organisateur
                      pour gagner dix secondes) : meet.new crée une
                      réunion instantanée, on colle son lien ici. */}
                  <p className="text-xs mt-1" style={{ color: "#66716B" }}>
                    Besoin d&apos;un lien immédiat ? Ouvrez <span className="font-mono">meet.new</span> (Google) ou créez la réunion dans Teams, puis collez le lien — il partira dans l&apos;invitation.
                  </p>
                </>
              )}</Field>
            )}
            {participantsReady && (
              <div>
                <div className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Invités</div>
                {/* « YCID veut voir LEY » : une pastille par
                    organisation du projet coche ses comptes d'un coup ;
                    l'ajustement fin reste compte par compte. */}
                {orgGroups.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {orgGroups.map(g => {
                      const all = g.memberIds.every(id => invited.has(id))
                      return (
                        <button key={g.name} type="button" onClick={() => toggleOrg(g)} aria-pressed={all}
                          className="text-xs px-2.5 py-1 rounded-full border font-medium transition-colors"
                          style={all
                            ? { background: "var(--brand-accent,#0E6B5C)", borderColor: "var(--brand-accent,#0E6B5C)", color: "#fff" }
                            : { borderColor: "#E3E6E2", color: "#17211D" }}>
                          {g.name} ({g.memberIds.length})
                        </button>
                      )
                    })}
                  </div>
                )}
                {/* Les invités cochés reçoivent cloche + email et
                    répondent depuis l'onglet COPIL. L'organisateur qui
                    se coche naît « accepté » : il programme, il vient. */}
                <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                  {members.map(m => (
                    <label key={m.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer"
                      style={{ ...border, background: invited.has(m.id) ? "var(--brand-accent-soft,#E4F0EC)" : "#fff" }}>
                      <input type="checkbox" checked={invited.has(m.id)} onChange={() => toggleInvite(m.id)}
                        className="accent-emerald-700" />
                      <span className="text-sm" style={{ color: "#17211D" }}>{m.name}</span>
                    </label>
                  ))}
                  {members.length === 0 && (
                    <p className="text-xs" style={{ color: "#66716B" }}>Aucun membre dans ce projet.</p>
                  )}
                </div>
                <p className="text-xs mt-1" style={{ color: "#66716B" }}>
                  Chaque invité est prévenu (notification et email) et répond — accepte ou refuse — dans l&apos;application.
                </p>
              </div>
            )}
            <Field label="Compte rendu">{id => (
              <textarea id={id} value={form.minutes} onChange={e => setForm({ ...form, minutes: e.target.value })} rows={3} className={inputCls} style={border} />
            )}</Field>
            <ErrorMessage>{d.error}</ErrorMessage>
            {/* Une date qui bouge invalide les réponses : le dire AVANT
                d'enregistrer, pas après. */}
            {meeting && participantsReady && form.date !== meeting.date && (
              <p className="text-xs rounded-lg px-3 py-2" style={{ background: "#F7EDDD", color: "#8A6A1F" }}>
                Vous changez la date : les réponses déjà données repasseront « en attente »
                et les invités seront prévenus.
              </p>
            )}
            <Actions pending={d.pending} onClose={() => d.setOpen(false)} label={meeting ? "Enregistrer" : "Créer la réunion"} />
          </form>
        </Modal>
      )}
    </>
  )
}

/* ============ Décision ============ */
export function DecisionDialog({ projectId, meetingId, members, decision }: {
  projectId: string; meetingId: string; members: Option[]
  decision?: { id: string; text: string; owner_user_id: string; due_date: string; status: string }
}) {
  const [form, setForm] = useState({
    text: decision?.text ?? "", owner_user_id: decision?.owner_user_id ?? "",
    due_date: decision?.due_date ?? "", status: decision?.status ?? "a_faire",
  })
  const d = useDialog(() => saveDecision({ projectId, meetingId, decisionId: decision?.id, ...form } as DecisionInput))
  return (
    <>
      {decision ? (
        <button onClick={() => d.setOpen(true)} className="p-1 rounded-full hover:bg-gray-100"
          aria-label="Modifier la décision" title="Modifier la décision">
          <Pencil size={12} style={{ color: "#66716B" }} aria-hidden="true" />
        </button>
      ) : (
        <button onClick={() => d.setOpen(true)} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium hover:bg-gray-50" style={{ ...border, color: "var(--brand-accent,#0E6B5C)" }}>
          <Plus size={12} aria-hidden="true" /> Décision
        </button>
      )}
      {d.open && (
        <Modal title={decision ? "Modifier la décision" : "Nouvelle décision"} busy={d.pending} onClose={() => d.setOpen(false)}>
          <form onSubmit={d.submit} className="space-y-3">
            <Field label="Décision *">{id => (
              <textarea id={id} value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} rows={2} required className={inputCls} style={border} />
            )}</Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Responsable">{id => (
                <select id={id} value={form.owner_user_id} onChange={e => setForm({ ...form, owner_user_id: e.target.value })} className={inputCls} style={border}>
                  <option value="">—</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              )}</Field>
              <Field label="Échéance">{id => (
                <input id={id} type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className={inputCls} style={border} />
              )}</Field>
              <Field label="Statut">{id => (
                <select id={id} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputCls} style={border}>
                  {Object.entries(DECISION_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              )}</Field>
            </div>
            <ErrorMessage>{d.error}</ErrorMessage>
            <Actions pending={d.pending} onClose={() => d.setOpen(false)} label={decision ? "Enregistrer" : "Ajouter la décision"} />
          </form>
        </Modal>
      )}
    </>
  )
}
