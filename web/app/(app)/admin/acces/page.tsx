export const dynamic = 'force-dynamic'
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { isUserAdmin } from "@/lib/permissions"
import { RBAC_MATRIX, ROLE_COLUMNS } from "@/lib/rbac"
import { Check } from "lucide-react"

export default async function AdminAccesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")
  if (!(await isUserAdmin(supabase, user.id))) redirect("/dashboard")

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Accès & rôles</h1>
        <p className="mt-1 text-sm" style={{ color: "#66716B" }}>
          Contrôle d&apos;accès (RBAC) : qui accède à quoi. Les droits sont appliqués en base de données (RLS Supabase) et re-vérifiés côté serveur.
        </p>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E6E2" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-cards tc-900">
            <thead>
              <tr style={{ background: "#F5F6F4", borderBottom: "1px solid #E3E6E2" }}>
                <th className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "#66716B" }}>Permission</th>
                <th className="text-center px-3 py-3 text-xs font-semibold" style={{ color: "var(--brand-accent,#0E6B5C)" }}>Administrateur</th>
                {ROLE_COLUMNS.map(r => (
                  <th key={r.key} className="text-center px-3 py-3 text-xs font-semibold" style={{ color: "#66716B" }}>{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RBAC_MATRIX.map((p, i) => (
                <tr key={p.key} style={{ borderBottom: "1px solid #E3E6E2", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                  <td data-primary="" className="px-5 py-3">
                    <div className="font-medium" style={{ color: "#17211D" }}>{p.label}</div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: "#66716B" }}>{p.key}</div>
                    {p.note && <div className="text-xs mt-0.5" style={{ color: "#B4690E" }}>{p.note}</div>}
                  </td>
                  <td data-label="Administrateur" className="text-center px-3 py-3">
                    {p.admin ? <Check size={16} className="inline" style={{ color: "var(--brand-accent,#0E6B5C)" }} /> : <span style={{ color: "#66716B" }}>—</span>}
                  </td>
                  {ROLE_COLUMNS.map(r => (
                    <td key={r.key} data-label={r.label} className="text-center px-3 py-3">
                      {p.roles.includes(r.key)
                        ? <Check size={16} className="inline" style={{ color: "var(--brand-accent,#0E6B5C)" }} />
                        : <span style={{ color: "#66716B" }}>—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs" style={{ color: "#66716B" }}>
        Matrice en lecture seule, et désormais <strong>appliquée</strong> : c&apos;est elle que
        l&apos;application interroge pour afficher ou masquer une action. La règle opposable
        reste la sécurité au niveau des lignes (`supabase/migrations/`), inviolable depuis le
        navigateur ; un contrôle automatique vérifie que les deux concordent.
        Un rôle non listé ici n&apos;a aucun accès : les projets ne sont visibles que par leurs membres et les admins.
        <br />
        <strong>Décider d&apos;une validation ne figure dans aucune colonne</strong> : ce droit ne vient
        pas du rôle projet mais de l&apos;appartenance à l&apos;organisation sollicitée.
      </p>

      {/* Deux droits de la plateforme ne se lisent dans AUCUNE colonne
          de ce tableau : ils ne viennent ni du rôle projet ni du rôle
          plateforme, mais d'une case cochée sur le profil. Ne pas le
          dire ici ferait de cet écran un menteur par omission — c'est
          exactement le défaut que lib/rbac.ts a été écrit pour
          supprimer. */}
      <div className="mt-6 bg-white rounded-2xl border p-5" style={{ borderColor: "#E3E6E2" }}>
        <h2 className="text-sm font-semibold mb-1" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
          Capacités cochées sur le profil
        </h2>
        <p className="text-xs mb-3" style={{ color: "#66716B" }}>
          Elles ne figurent dans aucune colonne : elles ne viennent ni du rôle projet ni du rôle
          plateforme, mais d&apos;une case cochée compte par compte depuis{" "}
          <Link href="/admin/utilisateurs" className="underline">Administration ▸ Utilisateurs</Link>.
          Leur attribution reste réservée à l&apos;administrateur.
        </p>
        <ul className="text-xs space-y-2" style={{ color: "#17211D" }}>
          <li>
            <strong>Arbitrage de la roadmap</strong> — statut, priorité et difficulté des idées.
            <span style={{ color: "#66716B" }}> N&apos;ouvre aucun écran d&apos;administration (0037).</span>
          </li>
          <li>
            <strong>Gestion des comptes</strong> — ouvre Administration ▸ Utilisateurs : créer, modifier,
            rattacher, désactiver un compte ordinaire.
            <span style={{ color: "#B4690E" }}> N&apos;accorde ni le rôle Administrateur, ni le droit de
            toucher au compte d&apos;un administrateur, ni l&apos;attribution des capacités,
            ni l&apos;anonymisation (0065).</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
