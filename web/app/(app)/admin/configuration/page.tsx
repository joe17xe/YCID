export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { isUserAdmin } from "@/lib/permissions"
import { getPlatformSettings } from "@/lib/settings"
import BrandForm from "@/components/admin/BrandForm"

export default async function ConfigurationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")
  if (!(await isUserAdmin(supabase, user.id))) redirect("/dashboard")

  const settings = await getPlatformSettings()

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
        Configuration &middot; Marque
      </h1>
      <p className="text-sm mb-6" style={{ color: "#66716B" }}>
        Personnalisez le nom, l&apos;accroche, le logo et les couleurs de la plateforme.
        Les changements s&apos;appliquent immédiatement à toute l&apos;application.
      </p>
      <BrandForm settings={settings} />
    </div>
  )
}
