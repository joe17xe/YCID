export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Plus, Upload } from "lucide-react"
import { canAnonymizeAccounts, canManageUsers, isUserAdmin } from "@/lib/permissions"
import UsersTable, { type AdminUserRow } from "@/components/admin/UsersTable"
import { anonymizationConfirmationTarget } from "./anonymisation"

export default async function AdminUtilisateursPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")
  // Deux questions distinctes depuis la 0065 : ouvre-t-on l'écran
  // (capacité OU rôle admin) et jusqu'où peut-on y agir (rôle admin).
  const [mayManage, isAdmin, { data: me }, { data: profiles, error }, { data: allMemberships }, mayAnonymize] = await Promise.all([
    canManageUsers(supabase, user.id),
    isUserAdmin(supabase, user.id),
    supabase.from("profiles").select("platform_role").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("id, full_name, email, platform_role, is_platform_admin, active, can_manage_roadmap, can_manage_users, anonymized_at").order("full_name"),
    supabase.from("memberships").select("user_id, organizations:org_id(name)"),
    canAnonymizeAccounts(supabase, user.id),
  ])
  if (!mayManage) redirect("/dashboard")
  const myRole = me?.platform_role ?? "admin"

  type RawProfile = {
    id: string; full_name: string | null; email: string | null
    platform_role: string | null; is_platform_admin: boolean | null; active: boolean | null
    can_manage_roadmap?: boolean | null
    can_manage_users?: boolean | null
    anonymized_at?: string | null
  }
  // Rattachement par compte : c'est lui qui explique le périmètre, et
  // il n'apparaissait nulle part.
  const orgsByUser = new Map<string, string[]>()
  for (const m of (allMemberships ?? []) as { user_id: string; organizations: { name: string } | { name: string }[] | null }[]) {
    const o = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations
    if (o?.name) orgsByUser.set(m.user_id, [...(orgsByUser.get(m.user_id) ?? []), o.name])
  }

  const users: AdminUserRow[] = (profiles ?? []).map((p: RawProfile) => {
    const role = p.platform_role ?? (p.is_platform_admin ? "admin" : "user")
    // Un YCID ne peut ni supprimer NI MODIFIER un Administrateur : les
    // deux sont refusés côté serveur (user-actions.ts), mais seule la
    // suppression était masquée. « Modifier » restait proposé sur un
    // compte administrateur, ouvrant un formulaire — champ mot de passe
    // compris — dont l'enregistrement échouait ensuite. Proposer une
    // action interdite, sur un écran de gestion des comptes, se lit
    // comme une faille alors que le verrou tient.
    // Une pierre tombale (0063) ne se modifie ni ne se supprime : la
    // renommer réattribuerait une identité aux traces qu'on vient
    // d'anonymiser, la supprimer effacerait l'attestation même de
    // l'effacement. Les deux sont refusés côté serveur ; on ne propose
    // pas ce que le serveur refuse.
    // Un porteur de la capacité « gestion des comptes » (0065) ne touche
    // pas à un compte administrateur : le formulaire porte un champ
    // « mot de passe », et l'ouvrir sur un administrateur reviendrait à
    // proposer d'en prendre la place — la borne « ne pas se promouvoir »
    // se contournerait sans jamais toucher à un rôle. Refusé côté
    // serveur ET côté page ; on ne propose pas ce que le serveur refuse.
    const anonymized = !!p.anonymized_at
    const targetIsAdmin = role === "admin"
    const forbiddenTarget = (myRole === "ycid" || !isAdmin) && targetIsAdmin
    const canDelete = !anonymized && !forbiddenTarget
    const canEdit = !anonymized && !forbiddenTarget
    return {
      id: p.id,
      full_name: p.full_name ?? "",
      email: p.email ?? "",
      platform_role: role,
      active: p.active !== false,
      isSelf: p.id === user.id,
      canDelete,
      canEdit,
      organizations: (orgsByUser.get(p.id) ?? []).sort(),
      canManageRoadmap: p.can_manage_roadmap === true,
      canManageUsers: p.can_manage_users === true,
      anonymizedAt: p.anonymized_at ?? null,
      // Calculée ICI et transmise, jamais recalculée dans le navigateur :
      // l'écran et l'action serveur doivent exiger la MÊME chaîne, sans
      // quoi le bouton se déverrouille sur une saisie que le serveur
      // refuse. Vide = aucune confirmation possible (ni nom ni adresse),
      // et l'écran le dit au lieu de laisser `'' === ''` déverrouiller
      // tout seul le geste le plus irréversible de l'application.
      confirmationTarget: anonymizationConfirmationTarget(p),
      canAnonymize: mayAnonymize && !anonymized && p.id !== user.id,
    }
  })
  const anonymizedCount = users.filter(u => u.anonymizedAt).length

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Utilisateurs</h1>
          <p className="mt-1 text-sm" style={{ color: "#66716B" }}>
            {users.length} compte{users.length !== 1 ? "s" : ""} ·{" "}
            {isAdmin
              ? "vous administrez la plateforme"
              : "vous gérez les comptes : ni rôle Administrateur, ni capacité, ni anonymisation"}
            {anonymizedCount > 0 && (
              <> · {anonymizedCount} anonymisé{anonymizedCount > 1 ? "s" : ""}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/admin/utilisateurs/import" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium" style={{ borderColor: "#E3E6E2", color: "#17211D" }}>
            <Upload size={16} /> Import en masse
          </Link>
          <Link href="/admin/utilisateurs/creer" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: "var(--brand-accent,#0E6B5C)" }}>
            <Plus size={16} /> Nouvel utilisateur
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl px-4 py-3 text-sm" style={{ background: "#F6E7E5", color: "#A3342C" }}>
          Impossible de charger les utilisateurs : {error.message}. Vérifiez que la migration 0017 a été appliquée.
        </div>
      )}

      <UsersTable users={users} />
    </div>
  )
}
