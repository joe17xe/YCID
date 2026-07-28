export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PROJECT_STATUS, fmtEur } from "@/lib/constants"
import { countryFlag } from "@/lib/flags"
import Link from "next/link"
import { AlertTriangle, CalendarClock, MapPin } from "lucide-react"
import { StatTile, AlertStatTile } from "@/components/ui/StatTile"
import RowMenu from "@/components/pilotage/RowMenu"

// Tri du tableau (V1, Lot 2). « pays » est l'ordre historique : groupé
// par pays (PR 27). Les deux autres répondent à une question qui
// traverse les pays — « où en est-on ? », « où est ce projet ? » — le
// groupement n'y aiderait pas : la liste passe à plat, avec le pays en
// colonne. Pas de case à cocher ni de pagination : trois projets
// paginés, c'est du décor (règle de lecture de la maquette).
const TRIS: Record<string, string> = {
  pays: "Pays",
  avancement: "Avancement",
  nom: "Nom",
}

type OrgRef = { name: string } | { name: string }[] | null

function orgName(o: OrgRef): string {
  const org = Array.isArray(o) ? o[0] : o
  return org?.name ?? ""
}

// Ce que le tableau lit d'une ligne projet — le reste du `select *`
// ne l'intéresse pas. Le typage du client Supabase lui-même reste le
// chantier de la PR 20.
type TaskRow = { id: string; progress: number; status: string; end_date: string | null }
type ProjectRow = {
  id: string
  name: string
  status: string
  country: string | null
  programme: string | null
  budget: number | null
  public_token: string | null
  phases?: { tasks?: TaskRow[] | null }[] | null
  project_organizations?: { role: string; organizations: OrgRef }[] | null
}

export default async function PilotagePage({ searchParams }: { searchParams: Promise<{ tri?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const { tri: rawTri } = await searchParams
  const tri = rawTri && TRIS[rawTri] ? rawTri : "pays"

  const [{ data: projects }, { data: decisions }] = await Promise.all([
    supabase.from("projects").select("*, project_organizations(role, organizations(name)), phases(tasks(id, progress, status, end_date)), budget_lines(planned_amount, is_valorisation)").order("name"),
    supabase.from("decisions").select("*, project:project_id(name), owner:owner_user_id(full_name)").neq("status", "fait").order("due_date"),
  ])

  function progress(p: ProjectRow): number {
    const tasks = (p.phases ?? []).flatMap(ph => ph.tasks ?? [])
    if (!tasks.length) return 0
    return Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length)
  }

  // Les organisations du projet : la porteuse d'abord (c'est elle qui
  // valide en premier), puis les autres dans l'ordre de la base.
  function partners(p: ProjectRow): string[] {
    const rows = p.project_organizations ?? []
    return [...rows]
      .sort((a, b) => (a.role === "porteur" ? -1 : 0) - (b.role === "porteur" ? -1 : 0))
      .map(r => orgName(r.organizations))
      .filter(Boolean)
  }

  const today = new Date().toISOString().slice(0, 10)
  const overdueDecisions = (decisions ?? []).filter((d: any) => d.due_date && d.due_date < today)
  const totalBudget = (projects ?? []).reduce((s: number, p: ProjectRow) => s + (p.budget ?? 0), 0)

  // Regroupement par pays (vision multi-niveaux, PR 27) — vue par défaut
  const byCountry = new Map<string, ProjectRow[]>()
  for (const p of projects ?? []) {
    const key = (p.country ?? "").trim() || "Pays non renseigné"
    if (!byCountry.has(key)) byCountry.set(key, [])
    byCountry.get(key)!.push(p)
  }
  const countryGroups = [...byCountry.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr"))

  // Vues triées à plat (avancement décroissant — les retards en bas —
  // ou ordre alphabétique)
  const flat: ProjectRow[] = [...(projects ?? [])]
  if (tri === "avancement") flat.sort((a, b) => progress(b) - progress(a))
  if (tri === "nom") flat.sort((a, b) => a.name.localeCompare(b.name, "fr"))

  const th = (label: string) => (
    <th key={label} className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "#66716B" }}>{label}</th>
  )

  function projectRow(p: ProjectRow, showCountry: boolean) {
    const s = PROJECT_STATUS[p.status] ?? { label: p.status, fg: "#66716B", bg: "#EEF0EE" }
    const prog = progress(p)
    const allTasks = (p.phases ?? []).flatMap(ph => ph.tasks ?? [])
    const lateTasks = allTasks.filter(t => t.end_date && t.end_date < today && t.status !== "terminee")
    const orgs = partners(p)
    const flag = countryFlag(p.country)
    return (
      <tr key={p.id} style={{ borderBottom: "1px solid #E3E6E2" }}>
        <td data-primary="" className="px-5 py-3">
          <Link href={`/projets/${p.id}`} className="font-medium hover:underline" style={{ color: "var(--brand-accent,#0E6B5C)" }}>{p.name}</Link>
          {p.programme && <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ background: "#F0E9F5", color: "#6B4A8C" }}>{p.programme}</span>}
        </td>
        {showCountry && (
          <td data-label="Pays" className="px-5 py-3 whitespace-nowrap" style={{ color: "#17211D" }}>
            {flag && <span className="mr-1.5" aria-hidden="true">{flag}</span>}
            {(p.country ?? "").trim() || "—"}
          </td>
        )}
        <td data-label="Partenaires" className="px-5 py-3 text-xs" style={{ color: "#66716B" }} title={orgs.join(", ") || undefined}>
          {orgs.length === 0 ? "—" : (
            <>
              {orgs.slice(0, 2).join(", ")}
              {orgs.length > 2 && <span className="ml-1 px-1.5 py-0.5 rounded-full" style={{ background: "#EEF0EE", color: "#17211D" }}>+{orgs.length - 2}</span>}
            </>
          )}
        </td>
        <td data-label="Statut" className="px-5 py-3">
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
        </td>
        <td data-label="Avancement" className="px-5 py-3 w-40">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#E3E6E2" }}>
              <div className="h-full rounded-full" style={{ width: `${prog}%`, background: "var(--brand-accent,#0E6B5C)" }} />
            </div>
            <span className="text-xs w-8" style={{ color: "#66716B" }}>{prog}%</span>
          </div>
        </td>
        <td data-label="Montant voté" className="px-5 py-3" style={{ color: "#17211D" }}>{fmtEur(p.budget)}</td>
        <td data-label="Tâches en retard" className="px-5 py-3">
          {lateTasks.length > 0 ? (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#F6E7E5", color: "#A3342C" }}>
              {lateTasks.length} en retard
            </span>
          ) : (
            <span className="text-xs" style={{ color: "#66716B" }}>—</span>
          )}
        </td>
        <td data-label="Actions" className="px-5 py-3 text-right">
          <RowMenu projectId={p.id} publicToken={p.public_token ?? null} projectName={p.name} />
        </td>
      </tr>
    )
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Pilotage — Portefeuille</h1>
        <p className="mt-1 text-sm" style={{ color: "#66716B" }}>{(projects ?? []).length} projets · {(projects ?? []).filter((p: ProjectRow) => p.status === "en_cours").length} en cours</p>
      </div>

      {/* KPI globaux */}
      {/* Anatomie partagée (StatTile) : un chiffre se lit pareil sur
          l'accueil, un projet et ici. Grille stable — l'alerte à zéro
          s'éteint en tuile neutre au lieu de disparaître. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-8">
        <StatTile label="Budget total portefeuille" mark="var(--brand-accent,#0E6B5C)" value={fmtEur(totalBudget)}
          sub="somme des montants votés" />
        <StatTile label="Projets en cours" mark="#3B5488"
          value={(projects ?? []).filter((p: ProjectRow) => p.status === "en_cours").length} />
        {(decisions ?? []).length > 0
          ? <AlertStatTile tone="warning" icon={<CalendarClock size={13} aria-hidden="true" />}
              label="Décisions ouvertes" value={(decisions ?? []).length} sub="en attente d'une suite" />
          : <StatTile label="Décisions ouvertes" mark="#9AA39D" value={0} />}
        {overdueDecisions.length > 0
          ? <AlertStatTile tone="danger" icon={<AlertTriangle size={13} aria-hidden="true" />}
              label="Décisions en retard" value={overdueDecisions.length} sub="échéance dépassée" />
          : <StatTile label="Décisions en retard" mark="#9AA39D" value={0} sub="rien ne glisse" />}
      </div>

      {/* Tableau projets */}
      <div className="bg-white rounded-2xl border overflow-hidden mb-6" style={{ borderColor: "#E3E6E2" }}>
        <div className="px-6 py-4 border-b flex flex-wrap items-center justify-between gap-3" style={{ borderColor: "#E3E6E2" }}>
          <h2 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
            {tri === "pays" ? "Projets par pays" : "Statut des projets"}
          </h2>
          {/* Même mécanique que le sélecteur de période du tableau de
              bord : des liens serveur, pas d'état client. */}
          <nav aria-label="Trier les projets" className="flex items-center gap-1 bg-white rounded-2xl border p-1" style={{ borderColor: "#E3E6E2" }}>
            <span className="pl-3 pr-1 text-xs" style={{ color: "#66716B" }}>Trier :</span>
            {Object.entries(TRIS).map(([key, label]) => (
              <Link
                key={key}
                href={key === "pays" ? "/pilotage" : `/pilotage?tri=${key}`}
                aria-current={tri === key ? "true" : undefined}
                className="px-3 py-1.5 rounded-xl text-sm font-medium transition-colors"
                style={{
                  background: tri === key ? "var(--brand-accent,#0E6B5C)" : "transparent",
                  color: tri === key ? "#fff" : "#66716B",
                }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        {/* Un tableau ne rétrécit pas : il déborde. Sans conteneur qui
            défile, c'est la PAGE ENTIÈRE qui glisse sous le doigt, et le
            reste de l'écran part avec elle. */}
        <div className="overflow-x-auto">
        {/* Sous 640 px chaque ligne devient un bloc (voir globals.css) :
            lire un projet en balayant l'écran de gauche à droite, en
            perdant l'en-tête en route, n'est pas lire. */}
        <table className="w-full text-sm table-cards tc-900">
          <thead>
            <tr style={{ background: "#F5F6F4", borderBottom: "1px solid #E3E6E2" }}>
              {th("Projet")}
              {tri !== "pays" && th("Pays")}
              {th("Partenaires")}
              {th("Statut")}
              {th("Avancement")}
              {th("Montant voté")}
              {th("Tâches en retard")}
              <th className="px-5 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {tri === "pays"
              ? countryGroups.map(([country, group]) => [
                  <tr key={`g-${country}`} data-group="" style={{ background: "#FAFBFA", borderBottom: "1px solid #E3E6E2" }}>
                    <td className="px-5 py-2.5 font-semibold" style={{ color: "#17211D" }}>
                      {countryFlag(country)
                        ? <span className="mr-1.5" aria-hidden="true">{countryFlag(country)}</span>
                        : <MapPin size={13} className="inline -mt-0.5 mr-1" aria-hidden="true" />}
                      {country} <span className="text-xs font-normal" style={{ color: "#66716B" }}>· {group.length} projet{group.length > 1 ? "s" : ""}</span>
                    </td>
                    <td />
                    <td />
                    <td data-label="Avancement moyen" className="px-5 py-2.5 text-xs" style={{ color: "#66716B" }}>
                      {group.length ? Math.round(group.reduce((s, p) => s + progress(p), 0) / group.length) : 0}% moyen
                    </td>
                    <td data-label="Montant voté" className="px-5 py-2.5 text-xs font-semibold" style={{ color: "#17211D" }}>
                      {fmtEur(group.reduce((s, p) => s + (p.budget ?? 0), 0))}
                    </td>
                    <td />
                    <td />
                  </tr>,
                  ...group.map(p => projectRow(p, false)),
                ])
              : flat.map(p => projectRow(p, true))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Décisions ouvertes */}
      {(decisions ?? []).length > 0 && (
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E6E2" }}>
          <div className="px-6 py-4 border-b" style={{ borderColor: "#E3E6E2" }}>
            <h2 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Décisions ouvertes ({decisions?.length})</h2>
          </div>
          <div className="divide-y" style={{ borderColor: "#E3E6E2" }}>
            {(decisions ?? []).slice(0, 10).map((d: any) => {
              const isLate = d.due_date && d.due_date < today
              return (
                <div key={d.id} className="px-6 py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium" style={{ color: "#17211D" }}>{d.text}</div>
                    <div className="text-xs mt-0.5" style={{ color: "#66716B" }}>
                      {d.project?.name} · {d.owner?.full_name ?? "Sans responsable"}
                    </div>
                  </div>
                  {d.due_date && (
                    <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{
                      background: isLate ? "#F6E7E5" : "#EEF0EE",
                      color: isLate ? "#A3342C" : "#66716B"
                    }}>
                      {isLate ? "⚠ " : ""}Échéance {new Date(d.due_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
