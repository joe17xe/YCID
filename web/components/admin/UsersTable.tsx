"use client"
import { useState, useMemo, useTransition } from "react"
import Link from "next/link"
import { AlertTriangle, EyeOff, Search, Settings, Trash2 } from "lucide-react"
import { PLATFORM_ROLES } from "@/lib/constants"
import { isUsableEmail } from "@/lib/email"
import Modal, { ErrorMessage } from "@/components/ui/Modal"
import { anonymizeUser, deleteUser, loadAnonymizationPreview } from "@/app/(app)/admin/utilisateurs/user-actions"
import { describeTraces, anonymizationConfirmed, type TraceCount } from "@/app/(app)/admin/utilisateurs/anonymisation"

export interface AdminUserRow {
  id: string
  full_name: string
  email: string
  platform_role: string
  active: boolean
  isSelf: boolean
  canDelete: boolean
  canEdit: boolean
  organizations: string[]
  canManageRoadmap: boolean
  canManageUsers: boolean
  // Effacement RGPD par anonymisation (migration 0063)
  anonymizedAt: string | null
  confirmationTarget: string
  canAnonymize: boolean
}

function DeleteButton({ user }: { user: AdminUserRow }) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium hover:bg-red-50"
        style={{ borderColor: "#E3E6E2", color: "#A3342C" }}>
        <Trash2 size={13} /> Supprimer
      </button>
    )
  }
  return (
    <span className="flex items-center gap-1.5">
      {error && <span className="text-xs" style={{ color: "#A3342C" }}>{error}</span>}
      <button onClick={() => startTransition(async () => { const r = await deleteUser(user.id); if (!r.ok) { setError(r.error ?? "Erreur"); setConfirming(false) } })}
        disabled={pending} className="text-xs px-2 py-1 rounded-lg font-semibold text-white" style={{ background: "#A3342C", opacity: pending ? 0.7 : 1 }}>
        {pending ? "…" : "Confirmer"}
      </button>
      <button onClick={() => setConfirming(false)} className="text-xs" style={{ color: "#66716B" }}>Annuler</button>
    </span>
  )
}

// ============================================================
// Effacement RGPD par anonymisation (migration 0063)
// ============================================================
// Deux temps, comme la suppression de projet : d'abord CE QUE ÇA FAIT,
// ensuite la recopie. Ce qui change ici, et qui compte : le premier
// écran ne se contente pas d'avertir, il INVENTORIE. « 40 traces au
// journal, 3 validations décidées, 7 pièces déposées » — c'est ce que
// l'administrateur devra répondre à la personne qui a écrit, et c'est ce
// qui distingue une anonymisation d'une suppression aux yeux de qui
// clique.
function AnonymizeButton({ user }: { user: AdminUserRow }) {
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState("")
  const [traces, setTraces] = useState<TraceCount | null>(null)
  const [inventoryError, setInventoryError] = useState("")
  const [pending, startTransition] = useTransition()

  function open() {
    setStep(1); setConfirmation(""); setError(""); setTraces(null); setInventoryError("")
    // L'inventaire est demandé au serveur à l'ouverture, pas au
    // chargement de la page : il coûte une requête par table qui
    // référence `profiles`, et personne n'ouvre cette fenêtre par
    // curiosité.
    startTransition(async () => {
      const res = await loadAnonymizationPreview(user.id)
      if (res.ok && res.traces) setTraces(res.traces)
      else setInventoryError(res.error ?? "Inventaire indisponible.")
    })
  }
  function close() { setStep(0); setConfirmation(""); setError("") }

  function submit() {
    setError("")
    startTransition(async () => {
      const res = await anonymizeUser(user.id, confirmation)
      if (res.ok) close()
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  // Le verrou du bouton passe par la MÊME fonction que le serveur
  // (anonymisation.ts). Elle refuse catégoriquement une cible vide : sans
  // cela, un compte sans nom NI adresse rendrait `'' === ''` vrai et
  // déverrouillerait tout seul le geste le plus irréversible de
  // l'application — le défaut déjà trouvé deux fois sur les phases et
  // les projets.
  const ready = anonymizationConfirmed(user.confirmationTarget, confirmation)
  const lines = traces ? describeTraces(traces.detail) : []

  return (
    <>
      <button onClick={open}
        title="Anonymiser ce compte (effacement RGPD)"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium hover:bg-amber-50"
        style={{ borderColor: "#E3E6E2", color: "#B4690E" }}>
        <EyeOff size={13} aria-hidden="true" /> Anonymiser
      </button>

      <Modal open={step > 0} onClose={close} busy={pending} maxWidth="max-w-lg" title="Anonymiser ce compte">
        <>
          {step === 1 && (
            <div>
              <div className="flex gap-3 rounded-xl p-4 mb-4" style={{ background: "#FBF0DF" }}>
                <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" style={{ color: "#B4690E" }} aria-hidden="true" />
                <div className="text-sm" style={{ color: "#17211D" }}>
                  <p className="font-medium mb-1">Effacement définitif et irréversible de l&apos;identité.</p>
                  <p style={{ color: "#66716B" }}>
                    Le nom, l&apos;adresse et la photo de ce compte sont remplacés par une mention neutre
                    (« Utilisateur supprimé #… »). La personne ne peut plus se connecter. Aucune
                    restauration n&apos;est possible, y compris par un administrateur.
                  </p>
                </div>
              </div>

              <p className="text-sm font-medium mb-2" style={{ color: "#17211D" }}>Ce qui est CONSERVÉ</p>
              {pending && !traces && !inventoryError && (
                <p className="text-sm mb-3" style={{ color: "#66716B" }}>Inventaire en cours…</p>
              )}
              {inventoryError && (
                <p className="text-sm mb-3" style={{ color: "#A3342C" }}>{inventoryError}</p>
              )}
              {traces && (
                traces.total === 0 ? (
                  <p className="text-sm mb-3" style={{ color: "#66716B" }}>
                    Ce compte n&apos;a laissé aucune trace dans l&apos;application.
                  </p>
                ) : (
                  <ul className="text-sm mb-3 space-y-0.5" style={{ color: "#66716B" }}>
                    {lines.map(l => <li key={l}>· {l}</li>)}
                  </ul>
                )
              )}
              <p className="text-sm mb-4" style={{ color: "#66716B" }}>
                Ces éléments restent en place et gardent leur date : une validation, un devis ou un
                dépôt font partie des pièces justificatives présentées au MEAE et au Département.
                Seul leur auteur change de nom.
              </p>

              {!user.confirmationTarget && (
                <p className="text-sm rounded-lg px-3 py-2 mb-4" style={{ background: "#F6E7E5", color: "#A3342C" }}>
                  Ce compte n&apos;a ni nom ni adresse : la confirmation consiste à en recopier un,
                  et sans eux rien ne prouve qu&apos;on anonymise le bon compte. Renseignez d&apos;abord
                  une adresse depuis « Modifier ».
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button onClick={close} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>Annuler</button>
                <button onClick={() => setStep(2)} disabled={!user.confirmationTarget}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ background: "#B4690E" }}>
                  Continuer
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <label htmlFor={`anon-confirm-${user.id}`} className="block text-sm" style={{ color: "#66716B" }}>
                Pour confirmer, saisissez exactement :{" "}
                <span className="font-semibold break-words" style={{ color: "#17211D" }}>{user.confirmationTarget}</span>
              </label>
              <input
                id={`anon-confirm-${user.id}`}
                value={confirmation}
                onChange={e => setConfirmation(e.target.value)}
                placeholder={user.full_name ? "Nom complet du compte" : "Adresse du compte"}
                className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                style={{ borderColor: "#E3E6E2" }}
              />
              <ErrorMessage>{error}</ErrorMessage>
              <div className="flex justify-end gap-2">
                <button onClick={close} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>Annuler</button>
                <button onClick={submit} disabled={pending || !ready}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: "#A3342C" }}>
                  {pending ? "Anonymisation…" : "Anonymiser définitivement"}
                </button>
              </div>
            </div>
          )}
        </>
      </Modal>
    </>
  )
}

export default function UsersTable({ users }: { users: AdminUserRow[] }) {
  const [query, setQuery] = useState("")
  const [role, setRole] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users
      .filter(u => !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .filter(u => !role || u.platform_role === role)
  }, [users, query, role])

  return (
    <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E6E2" }}>
      <div className="p-4 border-b flex flex-wrap items-center gap-3" style={{ borderColor: "#E3E6E2" }}>
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#66716B" }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un nom, un email…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" style={{ borderColor: "#E3E6E2" }} />
        </div>
        <select value={role} onChange={e => setRole(e.target.value)} className="px-3 py-2 rounded-xl border text-sm focus:outline-none" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
          <option value="">Tous les rôles</option>
          {Object.entries(PLATFORM_ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span className="text-sm" style={{ color: "#66716B" }}>{filtered.length} / {users.length}</span>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full text-sm table-cards tc-760">
        <thead>
          <tr style={{ background: "#F5F6F4", borderBottom: "1px solid #E3E6E2" }}>
            <th className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "#66716B" }}>NOM</th>
            <th className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "#66716B" }}>EMAIL</th>
            <th className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "#66716B" }}>RÔLE</th>
            <th className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "#66716B" }}>STATUT</th>
            <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#66716B" }}>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((u, i) => {
            const r = PLATFORM_ROLES[u.platform_role] ?? PLATFORM_ROLES.user
            return (
              <tr key={u.id} style={{ borderBottom: "1px solid #E3E6E2", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                <td data-primary="" className="px-5 py-3 font-medium" style={{ color: "#17211D" }}>
                  {u.full_name || "—"}
                  {u.isSelf && <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full" style={{ background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }}>Vous</span>}
                </td>
                <td data-label="Email" className="px-5 py-3 font-mono text-xs" style={{ color: "#66716B" }}>
                  {u.email}
                  {/* Adresse inexploitable (règle de lib/email.ts, la
                      même que l'envoi) : la personne ne reçoit AUCUN
                      email de l'application. Le badge rend le défaut
                      visible ici — l'écran Modifier le corrige. */}
                  {u.email && !isUsableEmail(u.email) && (
                    <span className="ml-2 font-sans text-xs px-1.5 py-0.5 rounded-full" style={{ background: "#F6E7E5", color: "#A3342C" }}
                      title="Adresse invalide : les notifications email n'arrivent pas — corrigez-la via Modifier.">
                      Adresse invalide
                    </span>
                  )}
                </td>
                <td data-label="Rôle et périmètre" className="px-5 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: r.bg, color: r.fg }}>{r.label}</span>
                  {/* Ce qui explique réellement le périmètre : les
                      organisations. Le rôle seul ne le dit plus. */}
                  <span className="block text-xs mt-1" style={{ color: u.organizations.length ? "#66716B" : "#9AA39D" }}>
                    {u.organizations.length ? u.organizations.join(" · ") : "aucune organisation"}
                  </span>
                  {u.canManageRoadmap && (
                    <span className="inline-block text-xs mt-1 px-1.5 py-0.5 rounded" style={{ background: "#F0E9F5", color: "#6B4A8C" }}>
                      arbitre la roadmap
                    </span>
                  )}
                  {/* La capacité se lit dans la liste, sinon elle ne se
                      découvre qu'en ouvrant chaque fiche — et l'on ne
                      sait plus qui gère les comptes. */}
                  {u.canManageUsers && (
                    <span className="inline-block text-xs mt-1 ml-1 px-1.5 py-0.5 rounded" style={{ background: "#E4F0EC", color: "#0E6B5C" }}
                      title="Peut créer et modifier des comptes ordinaires, sans accès à la configuration, au stockage ni à l'anonymisation">
                      gère les comptes
                    </span>
                  )}
                </td>
                <td data-label="Statut" className="px-5 py-3">
                  {u.anonymizedAt ? (
                    // La pierre tombale se dit à l'écran plutôt que de se
                    // deviner : sans cela, un compte anonymisé se lit
                    // comme un compte simplement désactivé, et l'on
                    // s'étonne que « Modifier » ait disparu.
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1"
                      style={{ background: "#FBF0DF", color: "#B4690E" }}
                      title={`Identité effacée le ${new Date(u.anonymizedAt).toLocaleDateString("fr-FR")} — traces conservées`}>
                      <EyeOff size={11} aria-hidden="true" /> Anonymisé
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: u.active ? "var(--brand-accent-soft,#E4F0EC)" : "#F6E7E5", color: u.active ? "var(--brand-accent,#0E6B5C)" : "#A3342C" }}>
                      {u.active ? "Actif" : "Inactif"}
                    </span>
                  )}
                </td>
                <td data-label="Actions" className="px-5 py-3">
                  <div className="flex items-center justify-end gap-2 flex-wrap">
                    {u.anonymizedAt ? (
                      <span className="text-xs" style={{ color: "#9AA39D" }}>
                        Identité effacée le {new Date(u.anonymizedAt).toLocaleDateString("fr-FR")}
                      </span>
                    ) : (
                      <>
                        {u.canEdit ? (
                          <Link href={`/admin/utilisateurs/${u.id}/editer`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium hover:bg-gray-50" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
                            <Settings size={13} /> Modifier
                          </Link>
                        ) : (
                          <span className="text-xs" style={{ color: "#9AA39D" }}
                            title="Seul un administrateur de la plateforme peut modifier ou supprimer un compte Administrateur — le formulaire porte un champ « mot de passe ».">
                            Administrateur
                          </span>
                        )}
                        {u.canAnonymize && <AnonymizeButton user={u} />}
                        {u.canDelete && !u.isSelf && <DeleteButton user={u} />}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
          {!filtered.length && (
            <tr><td data-primary="" colSpan={5} className="px-5 py-10 text-center text-sm" style={{ color: "#66716B" }}>Aucun utilisateur trouvé</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  )
}
