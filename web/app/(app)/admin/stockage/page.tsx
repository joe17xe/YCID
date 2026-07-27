export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { isUserAdmin } from "@/lib/permissions"
import { loadStorage } from "./actions"
import StorageClient from "@/components/admin/StorageClient"

// ============================================================
// PR 41 — Écran Stockage
// ============================================================
// Inventaire, pas dépôt. Aucun bouton « Importer » : les fichiers de
// projet ont un domicile — l'onglet Documents — et un second endroit
// pour les déposer produirait exactement les divergences qu'on a
// passé la Phase 5 à supprimer.

export default async function StoragePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")
  if (!(await isUserAdmin(supabase, user.id))) redirect("/dashboard")

  const res = await loadStorage()

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
        Stockage
      </h1>
      <p className="text-sm mb-6" style={{ color: "#66716B" }}>
        Espace occupé, répartition par projet et fichiers orphelins. Cet écran sert à
        surveiller et à nettoyer — le dépôt des pièces se fait dans l&apos;onglet Documents de chaque projet.
      </p>

      {!res.ok ? (
        <p className="text-sm rounded-xl px-4 py-3" style={{ background: "#F6E7E5", color: "#A3342C" }}>
          {res.error}
        </p>
      ) : (
        <StorageClient
          buckets={res.buckets ?? []}
          orphans={res.orphans ?? []}
          projects={res.projects ?? []}
        />
      )}
    </div>
  )
}
