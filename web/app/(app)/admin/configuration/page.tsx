export const dynamic = 'force-dynamic'
import Link from "next/link"
import { Palette, Sparkles, Scale, Mail, GitBranch } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { isUserAdmin } from "@/lib/permissions"
import { getPlatformSettings } from "@/lib/settings"
import { getAiConfigPublic, AI_PROVIDERS } from "@/lib/ai-settings"
import BrandForm from "@/components/admin/BrandForm"
import AiForm from "@/components/admin/AiForm"
import LegalForm from "@/components/admin/LegalForm"
import EmailForm from "@/components/admin/EmailForm"
import ValidationForm from "@/components/admin/ValidationForm"
import AiUsagePanel from "@/components/admin/AiUsagePanel"
import { getAiUsageSummary } from "@/lib/ai-usage"
import { getEmailSettings, getEmailTestStatus } from "@/lib/mailer"

const SECTIONS = [
  { key: "marque", label: "Marque", Icon: Palette },
  { key: "ia", label: "Intelligence artificielle", Icon: Sparkles },
  { key: "email", label: "Email", Icon: Mail },
  { key: "validation", label: "Validation", Icon: GitBranch },
  { key: "legal", label: "Mentions légales", Icon: Scale },
]

export default async function ConfigurationPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { section = "marque" } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")
  if (!(await isUserAdmin(supabase, user.id))) redirect("/dashboard")

  const isAi = section === "ia"
  const isLegal = section === "legal"
  const isEmail = section === "email"
  const isValidation = section === "validation"
  const [settings, ai, email] = await Promise.all([
    getPlatformSettings(),
    isAi ? getAiConfigPublic() : Promise.resolve(null),
    isEmail ? getEmailSettings() : Promise.resolve(null),
  ])
  const emailTest = isEmail ? await getEmailTestStatus() : null
  // La consommation s'affiche SOUS la configuration du fournisseur :
  // c'est le même sujet, et la séparer inviterait à ne jamais la
  // regarder.
  const aiUsage = isAi ? await getAiUsageSummary() : null

  // Réglages du circuit + aperçu projet par projet : un réglage dont on
  // ne voit pas l'effet se règle à l'aveugle.
  let validation = null
  if (isValidation) {
    const [{ data: ps }, { data: orgs }, { data: projs }] = await Promise.all([
      supabase.from("platform_settings").select("coordinator_org_id, coordinator_min_amount").eq("id", true).maybeSingle(),
      supabase.from("organizations").select("id, name").eq("status", "active").order("name"),
      supabase.from("projects").select("name, lead:lead_org_id(name)").order("name"),
    ])
    validation = {
      settings: {
        coordinator_org_id: ps?.coordinator_org_id ?? null,
        coordinator_min_amount: Number(ps?.coordinator_min_amount ?? 0),
      },
      organizations: (orgs ?? []) as { id: string; name: string }[],
      projects: (projs ?? []).map((p: any) => ({
        name: p.name,
        leadName: (Array.isArray(p.lead) ? p.lead[0]?.name : p.lead?.name) ?? null,
      })),
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
        Configuration
      </h1>
      <p className="text-sm mb-5" style={{ color: "#66716B" }}>
        {isAi
          ? "Choisissez le fournisseur d'intelligence artificielle utilisé par le rapport d'expert et la génération des contenus de communication."
          : isValidation
          ? "Qui valide un devis, et dans quel ordre. L'organisation porteuse approuve d'abord, l'organisation coordinatrice entérine ensuite."
          : isEmail
          ? "Serveur d'envoi des notifications : soumission d'un devis, décision de validation, tâche terminée. Rien n'est écrit en dur — tout se règle ici."
          : isLegal
          ? "Informations affichées sur les pages publiques Mentions légales et Politique de confidentialité. Obligatoires pour une plateforme portée par un financeur public."
          : "Personnalisez le nom, l'accroche, le logo et les couleurs de la plateforme. Les changements s'appliquent immédiatement à toute l'application."}
      </p>

      <div className="flex gap-2 p-1 rounded-2xl mb-6" style={{ background: "#EEF0EE" }}>
        {SECTIONS.map(({ key, label, Icon }) => {
          const active = section === key
          return (
            <Link key={key} href={`/admin/configuration?section=${key}`}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{
                background: active ? "#FFFFFF" : "transparent",
                color: active ? "var(--brand-accent,#0E6B5C)" : "#66716B",
                boxShadow: active ? "0 1px 2px rgba(23,33,29,0.06)" : "none",
              }}>
              <Icon size={15} /> {label}
            </Link>
          )
        })}
      </div>

      {isAi && ai ? (
          <div className="space-y-6">
            <AiForm settings={ai} providers={AI_PROVIDERS} />
            {aiUsage
              ? <AiUsagePanel usage={aiUsage} />
              : (
                <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#F7EDDD", color: "#8A6A1F" }}>
                  Suivi de consommation indisponible. Appliquez la migration <code>0043_ai_usage.sql</code>.
                </div>
              )}
          </div>
        )
        : isValidation ? (
          validation
            ? <ValidationForm settings={validation.settings} organizations={validation.organizations} projects={validation.projects} />
            : (
              <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#F7EDDD", color: "#8A6A1F" }}>
                Réglages du circuit illisibles. Appliquez les migrations <code>0041</code> et <code>0042</code>.
              </div>
            )
        )
        : isEmail ? (
          email ? (
            <EmailForm settings={{
              enabled: email.enabled, host: email.host, port: email.port, secure: email.secure,
              username: email.username,
              // Le mot de passe ne franchit jamais la frontière serveur :
              // seul le fait qu'il existe est transmis.
              hasPassword: !!email.password,
              from_name: email.from_name, from_email: email.from_email,
              reply_to: email.reply_to, site_url: email.site_url,
              last_test_at: emailTest?.last_test_at ?? null,
              last_test_ok: emailTest?.last_test_ok ?? null,
              last_test_error: emailTest?.last_test_error ?? null,
            }} />
          ) : (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#F7EDDD", color: "#8A6A1F" }}>
              Configuration email illisible. Appliquez la migration <code>0040_email_settings.sql</code>
              {" "}dans le SQL Editor Supabase, et vérifiez que <code>SUPABASE_SERVICE_ROLE_KEY</code> est bien posée sur le serveur.
            </div>
          )
        )
        : isLegal ? <LegalForm settings={settings} />
        : <BrandForm settings={settings} />}
    </div>
  )
}
