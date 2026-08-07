"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Check } from "lucide-react"
import { PLATFORM_ROLES } from "@/lib/constants"
import { createUser, updateUser } from "@/app/(app)/admin/utilisateurs/user-actions"

const label = "block text-xs font-semibold mb-1 tracking-wider"
const inputCls = "w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
const border = { borderColor: "#E3E6E2" }

interface UserData {
  id: string; full_name: string; email: string; platform_role: string; active: boolean
  can_manage_roadmap?: boolean
  can_manage_users?: boolean
  organizationIds?: string[]
}

export default function UserForm({ user, canCreateAdmin, canGrantCapabilities, organizations = [] }: {
  user?: UserData; canCreateAdmin: boolean
  // Attribuer une capacité de profil est réservé à l'administrateur
  // (0065). Le porteur de la capacité « gestion des comptes » remplit
  // ce formulaire sans voir les deux cases : les lui montrer grisées
  // annoncerait un droit qu'il n'a pas, les lui montrer actives ferait
  // échouer l'enregistrement. Le serveur refuse quoi qu'il arrive, et
  // laisse les valeurs en base intactes quand le formulaire ne les
  // envoie pas.
  canGrantCapabilities: boolean
  organizations?: { id: string; name: string }[]
}) {
  const router = useRouter()
  const isEdit = !!user
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    fullName: user?.full_name ?? "",
    email: user?.email ?? "",
    // Un nouveau compte est un utilisateur ordinaire. La valeur par
    // défaut « admin » datait d'un temps où le rôle portait le
    // périmètre ; depuis la 0037 il ne porte plus que l'administration
    // de l'outil, et un défaut à ce niveau ne se rattrape qu'en
    // relisant la liste.
    role: user?.platform_role ?? "user",
    password: "",
    confirmPassword: "",
    active: user?.active ?? true,
    canManageRoadmap: user?.can_manage_roadmap ?? false,
    canManageUsers: user?.can_manage_users ?? false,
    organizationIds: user?.organizationIds ?? [] as string[],
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    // Les deux capacités ne sont ENVOYÉES que par un administrateur.
    // Les omettre n'est pas une politesse : côté serveur, une clé
    // absente laisse la colonne en place, une clé à `false` l'écrase —
    // un gestionnaire corrigeant une adresse retirerait sinon
    // l'arbitrage roadmap de la personne éditée sans s'en apercevoir.
    const payload = {
      fullName: form.fullName, email: form.email, role: form.role,
      password: form.password, confirmPassword: form.confirmPassword,
      active: form.active, organizationIds: form.organizationIds,
      ...(canGrantCapabilities
        ? { canManageRoadmap: form.canManageRoadmap, canManageUsers: form.canManageUsers }
        : {}),
    }
    startTransition(async () => {
      const res = isEdit ? await updateUser(user!.id, payload) : await createUser(payload)
      if (res.ok) router.push("/admin/utilisateurs")
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  const roleOptions = Object.entries(PLATFORM_ROLES).filter(([k]) => canCreateAdmin || k !== "admin")

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border p-6 space-y-5 max-w-xl" style={border}>
      <div>
        <label className={label} style={{ color: "#66716B" }}>NOM COMPLET</label>
        <input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} required className={inputCls} style={border} />
      </div>
      <div>
        <label className={label} style={{ color: "#66716B" }}>ADRESSE EMAIL</label>
        <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required className={inputCls} style={border} />
      </div>
      <div>
        <label className={label} style={{ color: "#66716B" }}>RÔLE</label>
        <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className={inputCls} style={border}>
          {roleOptions.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <p className="text-xs mt-1" style={{ color: "#66716B" }}>
          Administrateur : administre l&apos;outil lui-même (comptes, stockage, configuration)
          et voit tous les projets. Utilisateur : ne voit que les projets de ses
          organisations et ceux dont il est membre. Le périmètre se règle ci-dessous,
          par les organisations — pas par le rôle.
        </p>
      </div>
      <div>
        <label className={label} style={{ color: "#66716B" }}>MOT DE PASSE</label>
        <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
          minLength={12} required={!isEdit} autoComplete="new-password" className={inputCls} style={border} />
        <p className="text-xs mt-1" style={{ color: "#66716B" }}>
          {isEdit ? "Laisser vide pour conserver le mot de passe actuel." : "12 caractères minimum."}
        </p>
      </div>
      <div>
        <label className={label} style={{ color: "#66716B" }}>CONFIRMER LE MOT DE PASSE</label>
        <input type="password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
          required={!isEdit || !!form.password} autoComplete="new-password" className={inputCls} style={border} />
      </div>
      {/* Rattachement aux organisations. C'est CE lien qui décide du
          périmètre : un membre d'YCID voit les projets auxquels YCID est
          rattachée. Il n'existait aucun écran pour le poser — d'où une
          table vide et des droits qui passaient par un rôle global. */}
      <div className="pt-2 border-t" style={border}>
        <span className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Organisations</span>
        <p className="text-xs mb-2" style={{ color: "#66716B" }}>
          Détermine les projets visibles : la personne voit tous les projets auxquels
          l&apos;une de ses organisations est rattachée. Laisser vide limite l&apos;accès
          aux projets dont elle est membre déclarée.
        </p>
        {organizations.length === 0 ? (
          <p className="text-xs" style={{ color: "#9AA39D" }}>Aucune organisation enregistrée.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
            {organizations.map(o => (
              <label key={o.id} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "#17211D" }}>
                <input type="checkbox" checked={form.organizationIds.includes(o.id)}
                  onChange={e => setForm({
                    ...form,
                    organizationIds: e.target.checked
                      ? [...form.organizationIds, o.id]
                      : form.organizationIds.filter(x => x !== o.id),
                  })} />
                {o.name}
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="pt-2 border-t" style={border}>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="mt-0.5" />
          <span>
            <span className="text-sm font-medium" style={{ color: "#17211D" }}>Compte actif</span>
            <span className="block text-xs" style={{ color: "#66716B" }}>Un compte désactivé ne peut plus se connecter.</span>
          </span>
        </label>
        {/* Les CAPACITÉS de profil : ni des droits projet, ni de
            l'administration technique. Des cases à cocher, pour ne pas
            avoir à inventer un rôle intermédiaire — c'est ce mélange qui
            avait donné la console d'administration à qui n'en avait pas
            l'usage (0037). Leur ATTRIBUTION reste à l'administrateur :
            qui distribue les droits distribuerait le sien. */}
        {canGrantCapabilities && (
          <>
            <label className="flex items-start gap-2.5 cursor-pointer mt-3">
              <input type="checkbox" checked={form.canManageRoadmap}
                onChange={e => setForm({ ...form, canManageRoadmap: e.target.checked })} className="mt-0.5" />
              <span>
                <span className="text-sm font-medium" style={{ color: "#17211D" }}>Arbitrage de la roadmap</span>
                <span className="block text-xs" style={{ color: "#66716B" }}>
                  Peut changer le statut, la priorité et la difficulté des idées (rôle Product Owner).
                  N&apos;ouvre aucun accès à l&apos;administration.
                </span>
              </span>
            </label>
            {/* Le libellé dit ce que la case donne ET ce qu'elle ne donne
                pas. Une aide qui n'énonce que le droit accordé laisse
                l'administrateur deviner le reste — et c'est en devinant
                qu'on avait fini par accorder le rôle « admin » à qui ne
                demandait qu'à créer des comptes. */}
            <label className="flex items-start gap-2.5 cursor-pointer mt-3">
              <input type="checkbox" checked={form.canManageUsers}
                onChange={e => setForm({ ...form, canManageUsers: e.target.checked })} className="mt-0.5" />
              <span>
                <span className="text-sm font-medium" style={{ color: "#17211D" }}>Gestion des comptes</span>
                <span className="block text-xs" style={{ color: "#66716B" }}>
                  Ouvre Administration ▸ Utilisateurs, et rien d&apos;autre : créer un compte,
                  modifier son nom, son adresse, son mot de passe et son statut actif,
                  le rattacher à des organisations (ce qui élargit les projets qu&apos;il voit),
                  le supprimer s&apos;il n&apos;a laissé aucune trace.
                </span>
                <span className="block text-xs mt-1" style={{ color: "#B4690E" }}>
                  N&apos;ouvre pas Configuration, Stockage ni Accès &amp; rôles, ne montre pas les projets
                  des autres. Ne permet ni de nommer un Administrateur, ni de toucher au compte
                  d&apos;un Administrateur, ni de cocher ces deux cases pour quiconque,
                  ni d&apos;anonymiser un compte : cela reste à vous.
                </span>
              </span>
            </label>
          </>
        )}
      </div>
      {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={pending} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending ? 0.7 : 1 }}>
          <Check size={16} /> {pending ? "…" : "Enregistrer"}
        </button>
        <Link href="/admin/utilisateurs" className="text-sm underline" style={{ color: "#66716B" }}>Annuler</Link>
      </div>
    </form>
  )
}
