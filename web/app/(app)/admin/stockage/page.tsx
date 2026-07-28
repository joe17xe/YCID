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

  // Point de contrôle des sauvegardes VPS (0052) — calculé dans
  // l'action (le rendu reste pur). Une date qui vieillit se VOIT :
  // neutre < 48 h, orange ensuite, rouge après 8 jours ou jamais —
  // une sauvegarde qui s'arrête en silence est le mode de panne
  // classique.
  const backup = res.ok ? res.backup ?? null : null
  const backupTone = backup === null || backup.ageHours >= 24 * 8
    ? { bg: "#F6E7E5", fg: "#A3342C" }
    : backup.ageHours >= 48
      ? { bg: "#F7EDDD", fg: "#8A6A1F" }
      : { bg: "var(--brand-accent-soft,#E4F0EC)", fg: "var(--brand-accent,#0E6B5C)" }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
        Stockage
      </h1>
      <p className="text-sm mb-4" style={{ color: "#66716B" }}>
        Espace occupé, répartition par projet et fichiers orphelins. Cet écran sert à
        surveiller et à nettoyer — le dépôt des pièces se fait dans l&apos;onglet Documents de chaque projet.
      </p>
      <p className="text-sm rounded-xl px-4 py-3 mb-6" style={{ background: backupTone.bg, color: backupTone.fg }}>
        {backup ? (
          <>Dernière sauvegarde VPS (base + fichiers) : <strong>{new Date(backup.at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</strong>.</>
        ) : (
          <>Aucune sauvegarde VPS constatée — installation : <strong>docs/sauvegardes.md</strong> du dépôt.</>
        )}
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
