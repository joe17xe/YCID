"use client"
import { useId, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import Modal, { ErrorMessage } from "@/components/ui/Modal"
import { fmtEur } from "@/lib/budget"
import { deleteBudgetLine, deletePhase, type DeleteOutcome } from "@/app/(app)/projets/[id]/actions"

// ============================================================
// Supprimer une ligne budgétaire / une phase — protocole en deux temps
// ============================================================
// Le Product Owner ne pouvait pas retirer ses lignes « TEST T11 — à
// supprimer » à 1 € : aucun bouton n'existait. La tentation était d'en
// poser un derrière une confirmation systématique — c'eût été ne rien
// régler, puisque nettoyer douze lignes d'essai aurait demandé douze
// dialogues et vingt-quatre clics.
//
// Le premier clic part donc NU. C'est l'action serveur qui MESURE ce que
// la suppression emporterait : rien à perdre, elle a lieu ; sinon elle
// refuse et renvoie, dans `error`, la phrase à afficher. Ce composant ne
// connaît aucun seuil, ne compte rien et ne reformule rien — il ignore
// jusqu'au fait qu'une ligne portant de l'engagé est intouchable. Toute
// règle recopiée ici divergerait le jour où l'action changerait d'avis,
// et l'écran promettrait alors ce que la base refuse.
//
// `needsConfirmation` est la SEULE chose que l'écran ait à interpréter,
// et elle sépare deux refus que rien d'autre ne distingue :
//   · présent → refus LEVABLE : on montre le message et on offre de
//     confirmer — recopie du nom pour une phase, simple accusé de
//     réception pour une ligne ;
//   · absent  → refus FERME (droit manquant, ligne engagée ou payée) :
//     on montre le message, et RIEN d'autre. Un bouton « forcer »
//     repartirait sur exactement le même refus : c'est la définition du
//     bouton mort que la PR 3 interdit.
//
// Les deux boutons partagent ce fichier parce qu'ils partagent ce
// protocole, pas par commodité. Séparés, il aurait existé deux lectures
// de `needsConfirmation` — et l'une des deux aurait fini par traiter un
// refus ferme comme un refus levable, ce qui est la panne la plus
// coûteuse ici : proposer de détruire ce que la base protège.

// Ce que le serveur a répondu, réduit à ce que l'écran en fait.
// `liftable` n'est pas un synonyme de « grave » : une phase de dix
// tâches est levable, une ligne à 1 € portant une facture payée ne l'est
// pas.
//
// `fundedTasks` est du même ordre que `taskCount` : une DONNÉE mesurée
// par le serveur, que l'écran affiche sans rien en déduire. Il la met en
// liste plutôt qu'en phrase parce qu'une suite de « titre (montant) »
// dans un paragraphe cesse d'être lue au troisième élément — et ce sont
// précisément les montants qu'il faut vérifier avant de confirmer.
// Formater n'est pas recalculer : `fmtEur` met des euros en français,
// il ne totalise rien.
type Refusal = {
  message: string
  liftable: boolean
  taskCount?: number
  fundedTasks?: { title: string; amount: number }[]
}

function useDeleteInTwoSteps(call: (confirmed: boolean) => Promise<DeleteOutcome>) {
  const router = useRouter()
  const [refusal, setRefusal] = useState<Refusal | null>(null)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  // `confirmed` dit de quel temps on est — premier appel nu, ou second
  // muni de la confirmation. On ne le déduit PAS de `refusal` : la
  // valeur capturée dans la transition est celle du rendu où le clic a
  // eu lieu, et s'en servir pour décider où écrire la réponse est
  // exactement le genre de raisonnement qui casse une fois sur dix.
  function run(confirmed: boolean) {
    setError("")
    startTransition(async () => {
      let res: DeleteOutcome
      try {
        res = await call(confirmed)
      } catch {
        // Une action serveur qui n'aboutit pas (réseau coupé, déploiement
        // en cours) rejette au lieu de répondre. Sans ce filet, le
        // premier clic — celui qui n'ouvre aucun dialogue quand il n'y a
        // rien à perdre — ne produirait strictement RIEN à l'écran :
        // le bouton mort qu'on vient de retirer, réinstallé autrement.
        res = { ok: false, error: "La suppression n'a pas abouti. Vérifiez votre connexion, puis réessayez." }
      }
      if (res.ok) { setRefusal(null); router.refresh(); return }
      // Second temps : le message part dans l'erreur, le dialogue reste
      // ouvert. Le refermer emporterait le motif du refus avec lui, et
      // l'utilisateur ne saurait pas pourquoi rien ne s'est passé.
      if (confirmed) setError(res.error ?? "Suppression impossible.")
      else setRefusal({
        message: res.error ?? "Suppression impossible.",
        liftable: !!res.needsConfirmation,
        taskCount: res.taskCount,
        fundedTasks: res.fundedTasks,
      })
    })
  }

  return { refusal, error, pending, run, close: () => { setRefusal(null); setError("") } }
}

// Le dialogue n'existe QUE parce que le serveur a refusé : il n'est
// jamais le passage obligé d'une suppression, seulement la suite d'un
// refus. D'où l'absence de premier écran « êtes-vous sûr ? ».
function RefusalDialog({ title, refusal, error, pending, confirmLabel, blocked, onConfirm, onClose, children }: {
  title: string
  refusal: Refusal
  error: string
  pending: boolean
  confirmLabel: string
  blocked?: boolean
  onConfirm: () => void
  onClose: () => void
  children?: React.ReactNode
}) {
  return (
    <Modal open onClose={() => !pending && onClose()} title={title} busy={pending} maxWidth="max-w-lg">
      <div className="space-y-3">
        {refusal.liftable ? (
          // Le message du serveur, TEL QUEL. Il nomme l'objet, compte les
          // tâches ou les pièces, et dit ce qui SURVIT — les lignes
          // budgétaires d'une phase supprimée repassent « hors phase »,
          // leur montant reste au projet. Le raccourcir ferait perdre
          // précisément ce qu'on veut faire lire, et le réécrire
          // fabriquerait une seconde vérité à maintenir.
          <p className="text-sm rounded-xl p-3 whitespace-pre-line" style={{ background: "#F7EDDD", color: "#8A6A1F" }}>
            {refusal.message}
          </p>
        ) : (
          // Refus ferme : le message vaut décision et porte déjà l'issue
          // (passer la ligne en « clôturée », retirer ses pièces d'abord).
          // Rien à confirmer ici, donc rien à confirmer à l'écran.
          <ErrorMessage>{refusal.message}</ErrorMessage>
        )}

        {refusal.liftable && children}
        <ErrorMessage>{error}</ErrorMessage>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={pending}
            className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
            {refusal.liftable ? "Annuler" : "Fermer"}
          </button>
          {refusal.liftable && (
            <button type="button" onClick={onConfirm} disabled={pending || blocked}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: "#A3342C" }}>
              {pending ? "Suppression…" : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ============ Ligne budgétaire ============ */
// Voisine du crayon « Modifier », dans la cellule Statut : c'est là qu'on
// va déjà quand on veut agir sur une ligne, et la suppression n'a pas à
// se cacher ailleurs pour être moins tentante — c'est le serveur qui
// décide de ce qu'elle coûte.
export function DeleteBudgetLineButton({ projectId, lineId, poste }: {
  projectId: string; lineId: string; poste: string
}) {
  const d = useDeleteInTwoSteps(confirmed => deleteBudgetLine({ projectId, lineId, confirm: confirmed }))
  // Les tâches que la ligne finance : elles perdent leur budget en
  // cascade, et ce budget pèse dans l'avancement de leur phase. Comme
  // pour les phases, le compte vient de la réponse et non d'un calcul
  // local — le bouton dit ce qu'il détruit au moment où l'on va le
  // presser.
  const funded = d.refusal?.fundedTasks ?? []
  return (
    <>
      <button type="button" onClick={() => d.run(false)} disabled={d.pending}
        className="p-1 rounded-full hover:bg-red-50"
        style={{ opacity: d.pending ? 0.5 : 1 }}
        aria-label={`Supprimer la ligne budgétaire ${poste}`} title="Supprimer la ligne">
        <Trash2 size={13} style={{ color: "#A3342C" }} aria-hidden="true" />
      </button>

      {d.refusal && (
        <RefusalDialog title="Supprimer la ligne budgétaire" refusal={d.refusal} error={d.error}
          pending={d.pending} onClose={d.close} onConfirm={() => d.run(true)}
          // Reprend les mots du message serveur, qui se termine soit par
          // « supprimer la ligne malgré tout », soit par « supprimer la
          // ligne et ses N affectations » : un libellé qui s'en écarte
          // laisse croire qu'on clique sur autre chose que ce qu'on vient
          // de lire.
          confirmLabel={funded.length
            ? `Supprimer la ligne et ses ${funded.length} affectation${funded.length > 1 ? "s" : ""}`
            : "Supprimer la ligne malgré tout"}>
          {funded.length > 0 && (
            /* Le message dit CE QUE ça change ; ce bloc dit SUR QUOI.
               Les deux sont nécessaires : la phrase se lit une fois, la
               liste se relit ligne à ligne, et c'est elle qui permet de
               noter les tâches à re-financer ailleurs avant de
               confirmer. */
            <div>
              {/* « Affectation » et non « financement » : sur une ligne de
                  valorisation, le montant affecté est une contribution en
                  nature qui ne compte pas dans le budget de la tâche. Le
                  message du serveur, lui, sait de quelle ligne il parle et
                  fait la différence. C'est aussi le mot du bouton et celui
                  du journal — trois endroits, un vocabulaire. */}
              <p className="text-sm font-medium mb-1" style={{ color: "#17211D" }}>
                {funded.length > 1
                  ? `${funded.length} tâches perdent leur affectation`
                  : "1 tâche perd son affectation"}
              </p>
              <ul className="rounded-xl border divide-y" style={{ borderColor: "#E3E6E2" }}>
                {funded.map((t, i) => (
                  <li key={`${t.title}-${i}`} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm"
                    style={{ borderColor: "#E3E6E2" }}>
                    <span className="min-w-0 break-words" style={{ color: "#17211D" }}>{t.title}</span>
                    <span className="shrink-0 tabular-nums font-medium" style={{ color: "#A3342C" }}>
                      − {fmtEur(t.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </RefusalDialog>
      )}
    </>
  )
}

/* ============ Phase ============ */
// Dans l'en-tête de la phase, à côté du crayon. La cascade est ici le
// vrai danger — supprimer une phase supprime SES TÂCHES — mais une phase
// vide n'emporte rien et part donc en un clic, comme une ligne nue.
export function DeletePhaseButton({ projectId, phaseId, phaseName }: {
  projectId: string; phaseId: string; phaseName: string
}) {
  const uid = useId()
  const [confirmation, setConfirmation] = useState("")
  const d = useDeleteInTwoSteps(confirmed =>
    deletePhase({ phaseId, projectId, confirmation: confirmed ? confirmation : undefined }))

  function close() { d.close(); setConfirmation("") }

  // Le compte vient de la réponse, pas d'un calcul local : le bouton dit
  // ce qu'il détruit au moment où l'on va le presser, et c'est la
  // dernière chose lue avant le clic.
  const n = d.refusal?.taskCount ?? 0

  return (
    <>
      <button type="button" onClick={() => d.run(false)} disabled={d.pending}
        className="p-1.5 rounded-full hover:bg-red-50"
        style={{ opacity: d.pending ? 0.5 : 1 }}
        aria-label={`Supprimer la phase ${phaseName}`} title="Supprimer la phase">
        <Trash2 size={14} style={{ color: "#A3342C" }} aria-hidden="true" />
      </button>

      {d.refusal && (
        <RefusalDialog title="Supprimer la phase" refusal={d.refusal} error={d.error}
          pending={d.pending} onClose={close} onConfirm={() => d.run(true)}
          confirmLabel={n > 0 ? `Supprimer la phase et ses ${n} tâche${n > 1 ? "s" : ""}` : "Supprimer la phase"}
          // Le bouton reste inerte tant que la recopie ne correspond pas
          // — même comparaison, sur `.trim()`, que l'action qui tranche
          // vraiment. Le but n'est pas de garder la porte (la RLS et
          // l'action s'en chargent) mais d'éviter un aller-retour qui
          // reviendrait avec le même message : on croirait alors ne pas
          // l'avoir lu, alors qu'on l'a mal recopié.
          blocked={confirmation.trim() !== phaseName.trim()}>
          {/* La recopie ne sert pas à faire réfléchir à la cascade — le
              message s'en charge — mais à désigner LAQUELLE : dans une
              liste de « Phase 2 », « Phase 3 », l'erreur qu'on redoute
              est de s'être trompé de carte. */}
          <div>
            <label htmlFor={`${uid}-confirm`} className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>
              Nom de la phase
            </label>
            <input id={`${uid}-confirm`} value={confirmation} onChange={e => setConfirmation(e.target.value)}
              autoComplete="off" autoCapitalize="off" spellCheck={false}
              className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              style={{ borderColor: "#E3E6E2" }} />
          </div>
        </RefusalDialog>
      )}
    </>
  )
}
