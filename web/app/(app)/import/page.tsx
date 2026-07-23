export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { isUserAdmin } from "@/lib/permissions"
import ImportClient from "@/components/import/ImportClient"

const KIND_LABELS: Record<string, string> = {
  projets: "Projets", phases: "Phases", taches: "Tâches", budget: "Budget",
}

export default async function ImportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const [canImport, { data: runs }] = await Promise.all([
    isUserAdmin(supabase, user.id),
    supabase.from("import_runs")
      .select("*, profiles:by_user(full_name)")
      .order("at", { ascending: false })
      .limit(20),
  ])

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Import CSV</h1>
        <p className="mt-1 text-sm" style={{ color: "#66716B" }}>
          Importez vos données depuis un fichier CSV (séparateur ;) — aperçu avant validation, chaque import est journalisé
        </p>
      </div>

      <ImportClient canImport={canImport} />

      {/* Journal des imports */}
      {(runs ?? []).length > 0 && (
        <div className="mt-8 bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E6E2" }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: "#E3E6E2" }}>
            <h2 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Journal des imports</h2>
            <p className="text-xs mt-0.5" style={{ color: "#66716B" }}>20 derniers imports</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#F5F6F4", borderBottom: "1px solid #E3E6E2" }}>
                {["Date", "Type", "Fichier", "Créées", "Ignorées", "Statut", "Par"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: "#66716B" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(runs ?? []).map((r: any, i: number) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #E3E6E2", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                  <td className="px-4 py-2.5 text-xs" style={{ color: "#66716B" }}>
                    {new Date(r.at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "#17211D" }}>{KIND_LABELS[r.kind] ?? r.kind}</td>
                  <td className="px-4 py-2.5 text-xs font-mono" style={{ color: "#66716B" }}>{r.filename ?? "—"}</td>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: "#0E6B5C" }}>{r.created_count}</td>
                  <td className="px-4 py-2.5" style={{ color: r.skipped_count > 0 ? "#B4690E" : "#66716B" }}>{r.skipped_count}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
                      background: r.status === "succes" ? "#E4F0EC" : "#F6E7E5",
                      color: r.status === "succes" ? "#0E6B5C" : "#A3342C",
                    }}>
                      {r.status === "succes" ? "Succès" : "Échec"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: "#66716B" }}>{r.profiles?.full_name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
