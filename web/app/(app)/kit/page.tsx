export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { isUserAdmin } from "@/lib/permissions"
import KitClient, { type KitFile } from "@/components/kit/KitClient"

// ============================================================
// Kit de communication (0057)
// ============================================================
// Disponible pour TOUT compte connecté : les supports définis par le
// designer (fabriqués chez Canva — décision du 28/07), à télécharger
// en URL signée. Dépôt et retrait : admins seuls. L'application
// héberge le kit, elle ne le crée pas.

export default async function KitPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")
  const admin = await isUserAdmin(supabase, user.id)

  const { data: objects, error } = await supabase.storage.from("communication")
    .list("", { limit: 200, sortBy: { column: "name", order: "asc" } })

  // URL signées une par une (1 h) : le bucket est privé — un lien du
  // kit ne doit pas être devinable ni éternel.
  const files: KitFile[] = []
  for (const o of objects ?? []) {
    if (o.id === null) continue // dossier
    const { data: signed } = await supabase.storage.from("communication")
      .createSignedUrl(o.name, 3600)
    files.push({
      name: o.name,
      size: (o.metadata as { size?: number } | null)?.size ?? null,
      createdAt: o.created_at ?? null,
      url: signed?.signedUrl ?? null,
    })
  }

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
        Kit de communication
      </h1>
      <p className="text-sm mb-6" style={{ color: "#66716B" }}>
        Les supports officiels — pack de logos, charte, gabarits — définis par le designer,
        à télécharger par tous. Les logos propres à chaque organisation se gèrent sur sa fiche
        (écran Organisations).
      </p>

      {error ? (
        <p className="text-sm rounded-xl px-4 py-3" style={{ background: "#F7EDDD", color: "#8A6A1F" }}>
          Kit non activé : appliquez la migration <strong>0057_communication_kit.sql</strong> dans le SQL Editor Supabase.
        </p>
      ) : (
        <KitClient files={files} isAdmin={admin} />
      )}
    </div>
  )
}
