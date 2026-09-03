export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { fmtEur, fmtDate } from "@/lib/constants"

// ============================================================
// File « À valider »
// ============================================================
// Le circuit de validation fonctionnait, mais rien ne disait à personne
// qu'on l'attendait : il fallait ouvrir projet par projet, ligne par
// ligne, le dialogue des pièces pour découvrir qu'une décision
// dormait. « Un validateur qui ne fouille pas ne validera jamais »
// (relecture du 25/07).
//
// Avec l'unanimité, ce n'est plus un inconfort : une organisation qui
// ignore qu'on l'attend gèle l'engagé du projet.
//
// Le périmètre est celui de la décision, tel que posé par la 0036 : on
// voit ce que doivent trancher les organisations dont on est MEMBRE.
// Pas de vue globale, même pour un administrateur — son recours existe,
// mais il reste exceptionnel et se prend sur la ligne concernée.

export default async function AValiderPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const { data: myOrgs } = await supabase.from("memberships")
    .select("org_id, organizations:org_id(name)").eq("user_id", user.id)
  const orgIds = (myOrgs ?? []).map(m => m.org_id as string)

  const { data: pending } = orgIds.length
    ? await supabase.from("validations")
        .select(`id, org_id, step, organizations:org_id(name),
                 documents:document_id(
                   id, filename, amount, project_id, uploaded_at, withdrawn_at,
                   uploaded_by, profiles:uploaded_by(full_name),
                   projects:project_id(name),
                   budget_line_id, budget_lines:budget_line_id(poste),
                   validations(step, decision)
                 )`)
        .eq("decision", "en_attente")
        .in("org_id", orgIds)
    : { data: [] }

  // Ne montrer que ce sur quoi on peut AGIR. Le circuit est ordonné
  // depuis la 0041 : le coordinateur n'a rien à faire d'un devis que le
  // porteur n'a pas encore signé, et une file qui affiche l'inatteignable
  // cesse vite d'être consultée.
  const isActionable = (v: any) => {
    const all = (Array.isArray(v.documents) ? v.documents[0] : v.documents)?.validations ?? []
    const step = v.step ?? 1
    return !all.some((o: any) => (o.step ?? 1) < step && o.decision !== 'valide')
  }
  // Une pièce retirée par son déposant (0070) n'attend plus personne :
  // la laisser ici ferait ouvrir un panneau où les boutons ont disparu,
  // et la base refuserait la décision de toute façon.
  const notWithdrawn = (v: any) => !(Array.isArray(v.documents) ? v.documents[0] : v.documents)?.withdrawn_at
  const all = (pending ?? []).filter(v => v.documents).filter(notWithdrawn)
  const rows = all.filter(isActionable)
  const waiting = all.length - rows.length
  const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null)

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>À valider</h1>
        <p className="mt-1 text-sm" style={{ color: "#66716B" }}>
          {rows.length === 0
            ? "Rien n’attend votre décision."
            : `${rows.length} devis attend${rows.length > 1 ? "ent" : ""} une décision de ${orgIds.length > 1 ? "vos organisations" : "votre organisation"}.`}
        </p>
        {waiting > 0 && (
          <p className="mt-1 text-xs" style={{ color: "#66716B" }}>
            {waiting} autre{waiting > 1 ? "s" : ""} vous {waiting > 1 ? "reviendront" : "reviendra"} une fois
            l&apos;organisation porteuse prononcée.
          </p>
        )}
      </div>

      {orgIds.length === 0 && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#F7EDDD", color: "#8A6A1F" }}>
          Vous n’êtes rattaché à aucune organisation. Décider d’une validation revient aux membres
          de l’organisation sollicitée : demandez votre rattachement à un administrateur.
        </div>
      )}

      {orgIds.length > 0 && rows.length === 0 && (
        <div className="rounded-2xl border p-8 text-center text-sm" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
          Aucun devis en attente. Cette page se remplit dès qu’une pièce est soumise
          à {orgIds.length > 1 ? "l’une de vos organisations" : "votre organisation"}.
        </div>
      )}

      <ul className="space-y-3">
        {rows.map(v => {
          const doc = one(v.documents) as {
            id: string; filename: string; amount: number | null; project_id: string
            budget_line_id?: string | null; uploaded_at?: string
            profiles?: { full_name: string } | { full_name: string }[] | null
            projects?: { name: string } | { name: string }[] | null
            budget_lines?: { poste: string } | { poste: string }[] | null
          } | null
          if (!doc) return null
          const org = one(v.organizations) as { name: string } | null
          const author = one(doc.profiles) as { full_name: string } | null
          const project = one(doc.projects) as { name: string } | null
          const line = one(doc.budget_lines) as { poste: string } | null
          return (
            <li key={v.id} className="rounded-2xl border bg-white p-4" style={{ borderColor: "#E3E6E2" }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "#17211D" }}>
                    {doc.filename}
                    {doc.amount != null && <span className="ml-2">{fmtEur(doc.amount)}</span>}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "#66716B" }}>
                    {project?.name ?? "Projet"}
                    {line?.poste ? ` · ${line.poste}` : ""}
                    {author?.full_name ? ` · déposé par ${author.full_name}` : ""}
                    {doc.uploaded_at ? ` · ${fmtDate(doc.uploaded_at)}` : ""}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "#B4690E" }}>
                    Sollicite {org?.name ?? "votre organisation"}
                  </p>
                </div>
                {/* La décision se prend sur la ligne budgétaire, où l'on
                    voit le montant prévu, l'engagé et les autres pièces.
                    Décider depuis une liste, sans ce contexte, serait
                    plus rapide et moins sérieux. Le lien porte l'identifiant
                    de la ligne : le panneau s'ouvre sur la bonne pièce au
                    lieu de laisser chercher dans le tableau. */}
                <Link href={`/projets/${doc.project_id}?tab=budget${doc.budget_line_id ? `&ligne=${doc.budget_line_id}` : ""}`}
                  className="px-4 py-2 rounded-xl text-white text-sm font-semibold flex-shrink-0"
                  style={{ background: "var(--brand-accent,#0E6B5C)" }}>
                  Examiner
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
