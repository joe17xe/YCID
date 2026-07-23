export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { IDEA_STATUS, IDEA_PRIORITY, fmtDate } from "@/lib/constants"
import { isUserAdmin } from "@/lib/permissions"
import IdeaDialog from "@/components/roadmap/IdeaDialog"
import { VoteButton, AdminPanel, DeleteIdeaButton, Comments } from "@/components/roadmap/IdeaInteractions"

export default async function IdeaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const [{ data: idea }, { data: votes }, { data: comments }, { data: profiles }, isAdmin] = await Promise.all([
    supabase.from("ideas").select("*").eq("id", id).maybeSingle(),
    supabase.from("idea_votes").select("user_id").eq("idea_id", id),
    supabase.from("idea_comments").select("*").eq("idea_id", id).order("created_at"),
    supabase.from("profiles").select("id, full_name"),
    isUserAdmin(supabase, user.id),
  ])
  if (!idea) notFound()

  const nameById = new Map((profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? "—"]))
  const voteCount = (votes ?? []).length
  const hasVoted = (votes ?? []).some((v: { user_id: string }) => v.user_id === user.id)
  const isAuthor = idea.author_id === user.id
  const st = IDEA_STATUS[idea.status] ?? IDEA_STATUS.idee
  const pr = IDEA_PRIORITY[idea.priority] ?? IDEA_PRIORITY.moyenne
  const tags: string[] = Array.isArray(idea.tags) ? idea.tags : []

  const commentRows = (comments ?? []).map((c: any) => ({
    id: c.id,
    body: c.body,
    authorName: nameById.get(c.author_id) ?? "—",
    createdAt: c.created_at,
    canDelete: isAdmin || c.author_id === user.id,
  }))

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <Link href="/roadmap" className="inline-flex items-center gap-1 text-sm" style={{ color: "#66716B" }}>
          <ChevronLeft size={16} /> Retour à la roadmap
        </Link>
        {(isAdmin || isAuthor) && (
          <div className="flex items-center gap-2">
            <IdeaDialog idea={{ id: idea.id, title: idea.title, description: idea.description ?? "", tags: tags.join(", ") }} />
            <DeleteIdeaButton ideaId={idea.id} />
          </div>
        )}
      </div>

      <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{idea.title}</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Colonne gauche */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border p-5" style={{ borderColor: "#E3E6E2" }}>
            <VoteButton ideaId={idea.id} votes={voteCount} hasVoted={hasVoted} />
          </div>

          <div className="bg-white rounded-2xl border p-5" style={{ borderColor: "#E3E6E2" }}>
            <h2 className="font-semibold mb-3" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Fiche</h2>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: pr.bg, color: pr.fg }}>{pr.label}</span>
            </div>
            {idea.difficulty && (
              <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: "#66716B" }}>
                <span className="font-semibold tracking-wider">DIFFICULTÉ</span>
                <span className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(i => (
                    <span key={i} className="w-2 h-2 rounded-full" style={{ background: i <= idea.difficulty ? "#0E6B5C" : "#E3E6E2" }} />
                  ))}
                </span>
                <span>{idea.difficulty}/5</span>
              </div>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {tags.map(t => <span key={t} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#F5F6F4", color: "#66716B" }}>{t}</span>)}
              </div>
            )}
            <p className="text-xs" style={{ color: "#66716B" }}>
              Proposée par {nameById.get(idea.author_id) ?? "—"} le {fmtDate(idea.created_at)}
            </p>
          </div>

          {isAdmin && (
            <div className="bg-white rounded-2xl border p-5" style={{ borderColor: "#E3E6E2" }}>
              <h2 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Gestion produit</h2>
              <p className="text-xs mb-3" style={{ color: "#66716B" }}>Réservé à l&apos;administrateur</p>
              <AdminPanel ideaId={idea.id} status={idea.status} priority={idea.priority} difficulty={idea.difficulty ?? null} />
            </div>
          )}
        </div>

        {/* Colonne droite */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border p-6" style={{ borderColor: "#E3E6E2" }}>
            <h2 className="font-semibold mb-3" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Description</h2>
            <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "#17211D" }}>
              {idea.description || "Aucune description."}
            </p>
          </div>

          <div className="bg-white rounded-2xl border p-6" style={{ borderColor: "#E3E6E2" }}>
            <h2 className="font-semibold mb-4" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
              Commentaires <span className="text-sm font-normal" style={{ color: "#66716B" }}>{commentRows.length} commentaire{commentRows.length !== 1 ? "s" : ""}</span>
            </h2>
            <Comments ideaId={idea.id} comments={commentRows} />
          </div>
        </div>
      </div>
    </div>
  )
}
