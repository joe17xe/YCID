export const dynamic = 'force-dynamic'
import Link from "next/link"
import { Palette, Sparkles, Scale } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { isUserAdmin } from "@/lib/permissions"
import { getPlatformSettings } from "@/lib/settings"
import { getAiConfigPublic, AI_PROVIDERS } from "@/lib/ai-settings"
import BrandForm from "@/components/admin/BrandForm"
import AiForm from "@/components/admin/AiForm"
import LegalForm from "@/components/admin/LegalForm"

const SECTIONS = [
  { key: "marque", label: "Marque", Icon: Palette },
  { key: "ia", label: "Intelligence artificielle", Icon: Sparkles },
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
  const [settings, ai] = await Promise.all([
    getPlatformSettings(),
    isAi ? getAiConfigPublic() : Promise.resolve(null),
  ])

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
        Configuration
      </h1>
      <p className="text-sm mb-5" style={{ color: "#66716B" }}>
        {isAi
          ? "Choisissez le fournisseur d'intelligence artificielle utilisé par le rapport d'expert et la génération des contenus de communication."
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

      {isAi && ai ? <AiForm settings={ai} providers={AI_PROVIDERS} />
        : isLegal ? <LegalForm settings={settings} />
        : <BrandForm settings={settings} />}
    </div>
  )
}
