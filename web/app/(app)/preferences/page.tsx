export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ACCESS_ROLES } from "@/lib/constants"
import AvatarUploader from "@/components/preferences/AvatarUploader"
import PasswordForm from "@/components/preferences/PasswordForm"
import AppearanceSettings from "@/components/preferences/AppearanceSettings"

function Block({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border p-6" style={{ borderColor: "#E3E6E2" }}>
      <h2 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{title}</h2>
      <p className="text-sm mt-0.5 mb-4" style={{ color: "#66716B" }}>{subtitle}</p>
      {children}
    </div>
  )
}

export default async function PreferencesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const [{ data: profile }, { data: memberRoles }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("project_members").select("role, projects:project_id(name)").eq("user_id", user.id),
  ])

  const roles = (memberRoles ?? []).map((m: { role: string; projects: { name: string } | { name: string }[] | null }) => {
    const project = Array.isArray(m.projects) ? m.projects[0] : m.projects
    return `${ACCESS_ROLES[m.role]?.label ?? m.role} — ${project?.name ?? ""}`
  })

  const providers: string[] = (user.app_metadata?.providers as string[] | undefined) ?? [user.app_metadata?.provider].filter(Boolean) as string[]
  const hasPassword = providers.includes("email")

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Préférences</h1>
        <p className="mt-1 text-sm" style={{ color: "#66716B" }}>Votre compte et vos réglages personnels</p>
      </div>

      <div className="space-y-6">
        <Block title="Photo de profil" subtitle="Affichée dans le menu compte et à côté de vos contributions.">
          <AvatarUploader userId={user.id} avatarUrl={profile?.avatar_url ?? null} name={profile?.full_name ?? ""} />
        </Block>

        <Block title="Informations du compte" subtitle="Ces informations sont gérées par les administrateurs — contactez YCID pour toute correction.">
          <dl className="space-y-3 text-sm">
            <div className="flex gap-4">
              <dt className="w-32 flex-shrink-0" style={{ color: "#66716B" }}>Nom</dt>
              <dd style={{ color: "#17211D" }}>{profile?.full_name || "—"}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-32 flex-shrink-0" style={{ color: "#66716B" }}>Email</dt>
              <dd style={{ color: "#17211D" }}>{profile?.email ?? user.email}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-32 flex-shrink-0" style={{ color: "#66716B" }}>Rôles</dt>
              <dd className="space-y-1" style={{ color: "#17211D" }}>
                {roles.length ? roles.map((r, i) => <div key={i}>{r}</div>) : "Aucun rôle projet"}
              </dd>
            </div>
          </dl>
        </Block>

        <Block title="Mot de passe" subtitle="Choisissez un mot de passe long et unique (12 caractères minimum).">
          <PasswordForm email={profile?.email ?? user.email ?? ""} hasPassword={hasPassword} />
        </Block>

        <Block title="Apparence & accessibilité" subtitle="Adaptez l'affichage à votre confort de lecture — mémorisé sur cet appareil.">
          <AppearanceSettings />
        </Block>
      </div>
    </div>
  )
}
