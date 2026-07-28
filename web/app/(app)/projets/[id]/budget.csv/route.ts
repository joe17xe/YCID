import { createClient } from "@/lib/supabase/server"
import { financialsFor, sumFinancials, type DocLike } from "@/lib/budget"
import { LINE_STATUS, LINE_CATEGORIES } from "@/lib/constants"

// ============================================================
// Export CSV du budget (roadmap, priorisé le 28/07)
// ============================================================
// Le compte rendu au Département et au MEAE se fait sur tableur. Cet
// export applique LES MÊMES règles de calcul que l'écran — engagé =
// devis validés par TOUTES les organisations sollicitées, payé =
// pièces réglées hors devis — parce qu'elles viennent du même module
// (lib/budget.ts, source unique) : le chiffre exporté ne peut pas
// contredire le chiffre affiché.
//
// Format pour Excel FRANÇAIS : séparateur point-virgule, virgule
// décimale, BOM UTF-8 (sans lui, Excel affiche « Ã© » pour « é »).
// Comme l'écran, les totaux séparent le budget réel de la
// valorisation (cofinancement en nature).
//
// Les droits sont ceux de la lecture : la RLS filtre les lignes, et un
// projet hors droits renvoie 404 — exporter n'ouvre rien de plus que
// l'onglet Budget.

export const dynamic = "force-dynamic"

type OrgRef = { name: string } | { name: string }[] | null
function refName(o: OrgRef): string {
  const v = Array.isArray(o) ? o[0] : o
  return v?.name ?? ""
}

// Un champ CSV se protège s'il contient le séparateur, des guillemets
// ou un retour à la ligne — et les guillemets se doublent.
function field(v: string): string {
  return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

// Montant à la française : virgule décimale, pas de séparateur de
// milliers — c'est Excel qui met en forme, pas le fichier.
function eur(n: number): string {
  return n.toFixed(2).replace(".", ",")
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Non authentifié.", { status: 401 })

  const [{ data: project }, { data: lines }] = await Promise.all([
    supabase.from("projects").select("name").eq("id", id).maybeSingle(),
    supabase.from("budget_lines")
      .select("poste, description, category, year, planned_amount, is_valorisation, status, phase:phase_id(name), funder:funder_org_id(name), owner:owner_org_id(name), documents(type, amount, paid, validations(decision))")
      .eq("project_id", id)
      .order("year", { ascending: true, nullsFirst: false }),
  ])
  if (!project) return new Response("Projet introuvable.", { status: 404 })

  type LineRow = {
    poste: string; description: string | null; category: string; year: number | null
    planned_amount: number | null; is_valorisation: boolean; status: string
    phase: { name: string } | { name: string }[] | null
    funder: OrgRef; owner: OrgRef
    documents: DocLike[] | null
  }

  const rows: string[][] = [[
    "Poste", "Description", "Phase", "Catégorie", "Financeur", "Porteur", "Année",
    "Statut", "Valorisation", "Prévu (€)", "Engagé (€)", "Payé (€)",
    "Reste à engager (€)", "Reste à payer (€)",
  ]]

  const fins: { valo: boolean; fin: ReturnType<typeof financialsFor> }[] = []
  for (const l of (lines ?? []) as LineRow[]) {
    const fin = financialsFor(l.planned_amount ?? 0, l.documents ?? [])
    fins.push({ valo: l.is_valorisation, fin })
    rows.push([
      l.poste,
      l.description ?? "",
      refName(l.phase),
      LINE_CATEGORIES[l.category]?.label ?? l.category,
      refName(l.funder),
      refName(l.owner),
      l.year != null ? String(l.year) : "",
      LINE_STATUS[l.status]?.label ?? l.status,
      l.is_valorisation ? "oui" : "",
      eur(fin.planned), eur(fin.engaged), eur(fin.paid),
      eur(fin.remainingToCommit), eur(fin.remainingToPay),
    ])
  }

  // Les totaux de l'écran : le réel d'un côté, la valorisation de
  // l'autre — les additionner mélangerait de l'argent et du temps donné.
  const real = sumFinancials(fins.filter(f => !f.valo).map(f => f.fin))
  const valo = sumFinancials(fins.filter(f => f.valo).map(f => f.fin))
  rows.push([])
  rows.push(["TOTAL (hors valorisation)", "", "", "", "", "", "", "", "",
    eur(real.planned), eur(real.engaged), eur(real.paid), eur(real.remainingToCommit), eur(real.remainingToPay)])
  if (fins.some(f => f.valo)) {
    rows.push(["TOTAL valorisation", "", "", "", "", "", "", "", "oui",
      eur(valo.planned), eur(valo.engaged), eur(valo.paid), eur(valo.remainingToCommit), eur(valo.remainingToPay)])
  }

  const csv = "\uFEFF" + rows.map(r => r.map(field).join(";")).join("\r\n") + "\r\n"

  // Nom de fichier en ASCII : les accents dans Content-Disposition se
  // gèrent mal d'un navigateur à l'autre.
  const slug = project.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 60) || "projet"
  const today = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="budget-${slug}-${today}.csv"`,
    },
  })
}
