export const dynamic = 'force-dynamic'
import Link from "next/link"
import { Lightbulb, GitPullRequest } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import IdeaDialog from "@/components/roadmap/IdeaDialog"
import RoadmapList, { type IdeaCard } from "@/components/roadmap/RoadmapList"
import DeploymentsBoard from "@/components/roadmap/DeploymentsBoard"
import { getDevActivity } from "@/lib/github"

export default async function RoadmapPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "roadmap" } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  // Onglet Déploiements : activité GitHub (PR 30)
  if (tab === "deploiements") {
    const activity = await getDevActivity()
    return (
      <div className="p-4 sm:p-8 max-w-6xl mx-auto">
        <RoadmapHeader tab={tab} />
        <DeploymentsBoard activity={activity} />
      </div>
    )
  }

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

  type RawIdea = {
    id: string; title: string; description: string | null; status: string; priority: string
    difficulty: number | null; tags: string[] | null; author_id: string; created_at: string
  }
  const cards: IdeaCard[] = (ideas ?? []).map((i: RawIdea) => ({
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
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <RoadmapHeader tab={tab} action={<IdeaDialog />} />
      <RoadmapList ideas={cards} />
    </div>
  )
}

// En-tête commun aux deux onglets (Roadmap · Déploiements)
function RoadmapHeader({ tab, action }: { tab: string; action?: React.ReactNode }) {
  const TABS = [
    { key: "roadmap", label: "Roadmap", Icon: Lightbulb },
    { key: "deploiements", label: "Déploiements", Icon: GitPullRequest },
  ]
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Roadmap</h1>
          <p className="mt-1 text-sm" style={{ color: "#66716B" }}>Idées et propositions d&apos;évolution — votez pour prioriser</p>
        </div>
        {action}
      </div>
      <div className="flex gap-2 p-1 rounded-2xl mb-6" style={{ background: "#EEF0EE" }}>
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key
          return (
            <Link key={key} href={`/roadmap?tab=${key}`}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{
                background: active ? "#FFFFFF" : "transparent",
                color: active ? "var(--brand-accent,#0E6B5C)" : "#66716B",
                boxShadow: active ? "0 1px 2px rgba(23,33,29,0.06)" : "none",
              }}>
              <Icon size={15} /> {label}
            </Link>
          )
        })}
      </div>
    </>
  )
}
