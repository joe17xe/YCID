"use client"
import { useMemo, useState } from "react"
import Link from "next/link"
import { Search, ArrowUp, MessageSquare } from "lucide-react"
import { IDEA_STATUS, IDEA_PRIORITY } from "@/lib/constants"

export interface IdeaCard {
  id: string
  title: string
  description: string
  status: string
  priority: string
  difficulty: number | null
  tags: string[]
  votes: number
  comments: number
  authorName: string
  createdAt: string
}

function Dots({ n }: { n: number | null }) {
  if (!n) return null
  return (
    <span className="flex gap-0.5" title={`Difficulté ${n}/5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i <= n ? "#0E6B5C" : "#E3E6E2" }} />
      ))}
    </span>
  )
}

export default function RoadmapList({ ideas }: { ideas: IdeaCard[] }) {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("")
  const [priority, setPriority] = useState("")
  const [tag, setTag] = useState("")
  const [sort, setSort] = useState<"votes" | "date">("votes")

  const allTags = useMemo(() => [...new Set(ideas.flatMap(i => i.tags))].sort(), [ideas])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ideas
      .filter(i => !q || i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
      .filter(i => !status || i.status === status)
      .filter(i => !priority || i.priority === priority)
      .filter(i => !tag || i.tags.includes(tag))
      .sort((a, b) => sort === "votes" ? b.votes - a.votes || b.createdAt.localeCompare(a.createdAt) : b.createdAt.localeCompare(a.createdAt))
  }, [ideas, query, status, priority, tag, sort])

  const selectCls = "px-3 py-2 rounded-xl border text-sm focus:outline-none"

  return (
    <div>
      {/* Filtres */}
      <div className="bg-white rounded-2xl border p-4 mb-6 flex flex-wrap items-center gap-3" style={{ borderColor: "#E3E6E2" }}>
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#66716B" }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher une idée…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" style={{ borderColor: "#E3E6E2" }} />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} className={selectCls} style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
          <option value="">Tous les statuts</option>
          {Object.entries(IDEA_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={priority} onChange={e => setPriority(e.target.value)} className={selectCls} style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
          <option value="">Toutes les priorités</option>
          {Object.entries(IDEA_PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={tag} onChange={e => setTag(e.target.value)} className={selectCls} style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
          <option value="">Tous les tags</option>
          {allTags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value as "votes" | "date")} className={selectCls} style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
          <option value="votes">Tri : votes</option>
          <option value="date">Tri : date</option>
        </select>
        <span className="text-sm" style={{ color: "#66716B" }}>{filtered.length} idée{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Cartes */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(i => {
          const st = IDEA_STATUS[i.status] ?? IDEA_STATUS.idee
          const pr = IDEA_PRIORITY[i.priority] ?? IDEA_PRIORITY.moyenne
          return (
            <Link key={i.id} href={`/roadmap/${i.id}`}
              className="block bg-white rounded-2xl border p-5 hover:shadow-md transition-shadow"
              style={{ borderColor: i.status === "acceptee" ? "#6B4A8C" : "#E3E6E2" }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex gap-1.5">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: pr.bg, color: pr.fg }}>{pr.label}</span>
                </div>
                <Dots n={i.difficulty} />
              </div>
              <h3 className="text-sm font-semibold mb-1.5" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{i.title}</h3>
              {i.description && <p className="text-xs mb-3 line-clamp-3" style={{ color: "#66716B" }}>{i.description}</p>}
              {i.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {i.tags.map(t => <span key={t} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#F5F6F4", color: "#66716B" }}>{t}</span>)}
                </div>
              )}
              <div className="flex items-center justify-between text-xs pt-2 border-t" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><ArrowUp size={12} /> {i.votes}</span>
                  <span className="flex items-center gap-1"><MessageSquare size={12} /> {i.comments}</span>
                </span>
                <span>{i.authorName} · {new Date(i.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}</span>
              </div>
            </Link>
          )
        })}
        {!filtered.length && (
          <div className="col-span-3 text-center py-16 text-sm" style={{ color: "#66716B" }}>
            Aucune idée pour ces filtres — proposez la première !
          </div>
        )}
      </div>
    </div>
  )
}
