export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import IdeaDialog from "@/components/roadmap/IdeaDialog"
import RoadmapList, { type IdeaCard } from "@/components/roadmap/RoadmapList"

export default async function RoadmapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const [{ data: ideas }, { data: votes }, { data: comments }, { data: profiles }] = await Promise.all([
    supabase.from("ideas").select("*"),
    supabase.from("idea_votes").select("idea_id"),
    supabase.from("idea_comments").select("idea_id"),
    supabase.from("profiles").select("id, full_name"),
  ])

  const voteCount = new Map<string, number>()
  for (const v of votes ?? []) voteCount.set(v.idea_id, (voteCount.get(v.idea_id) ?? 0) + 1)
  const commentCount = new Map<string, number>()
  for (const c of comments ?? []) commentCount.set(c.idea_id, (commentCount.get(c.idea_id) ?? 0) + 1)
  const nameById = new Map((profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? "—"]))

  const cards: IdeaCard[] = (ideas ?? []).map((i: any) => ({
    id: i.id,
    title: i.title,
    description: i.description ?? "",
    status: i.status,
    priority: i.priority,
    difficulty: i.difficulty ?? null,
    tags: Array.isArray(i.tags) ? i.tags : [],
    votes: voteCount.get(i.id) ?? 0,
    comments: commentCount.get(i.id) ?? 0,
    authorName: nameById.get(i.author_id) ?? "—",
    createdAt: i.created_at,
  }))

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Roadmap</h1>
          <p className="mt-1 text-sm" style={{ color: "#66716B" }}>Idées et propositions d&apos;évolution — votez pour prioriser</p>
        </div>
        <IdeaDialog />
      </div>
      <RoadmapList ideas={cards} />
    </div>
  )
}
