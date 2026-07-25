import { GitPullRequest, Rocket, ExternalLink } from "lucide-react"
import type { DevActivity, PrItem, ReleaseItem } from "@/lib/github"

// ============================================================
// PR 30 — Tableau « Déploiements » : PR et mises en production
// ============================================================

const border = { borderColor: "#E3E6E2" }

function fmt(iso: string): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

function Column({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border p-4 flex flex-col gap-3 min-w-0" style={border}>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{title}</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#EEF0EE", color: "#66716B" }}>{count}</span>
      </div>
      {count === 0 ? (
        <div className="rounded-xl border border-dashed py-8 text-center text-xs" style={{ ...border, color: "#66716B" }}>Aucune</div>
      ) : children}
    </div>
  )
}

function PrCard({ pr, tone }: { pr: PrItem; tone: { fg: string; bg: string; label: string } }) {
  return (
    <a href={pr.url} target="_blank" rel="noopener noreferrer"
      className="block rounded-xl border p-3 hover:bg-gray-50 transition-colors" style={border}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-mono font-semibold" style={{ color: "var(--brand-accent,#0E6B5C)" }}>#{pr.number}</span>
        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>
        <GitPullRequest size={13} className="ml-auto flex-shrink-0" style={{ color: "#66716B" }} />
      </div>
      <div className="text-sm font-medium leading-snug mb-1.5" style={{ color: "#17211D" }}>{pr.title}</div>
      <div className="text-xs" style={{ color: "#66716B" }}>{pr.author} · {fmt(pr.date)}</div>
    </a>
  )
}

function ReleaseCard({ item }: { item: ReleaseItem }) {
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer"
      className="block rounded-xl border p-3 hover:bg-gray-50 transition-colors" style={border}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-mono font-semibold" style={{ color: "var(--brand-accent,#0E6B5C)" }}>{item.tag}</span>
        <ExternalLink size={12} className="ml-auto flex-shrink-0" style={{ color: "#66716B" }} />
      </div>
      <div className="text-sm font-medium leading-snug mb-1" style={{ color: "#17211D" }}>{item.name}</div>
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: "#66716B" }}>{fmt(item.date)}</span>
        {item.prerelease && (
          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#F7EDDD", color: "#B4690E" }}>préversion</span>
        )}
        {item.kind === "deployment" && (
          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }}>en production</span>
        )}
      </div>
    </a>
  )
}

export default function DeploymentsBoard({ activity }: { activity: DevActivity }) {
  const { open, review, merged, published, repo, error } = activity

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <p className="text-sm" style={{ color: "#66716B" }}>
          Suivi du développement — pull requests et mises en production
        </p>
        <a href={`https://github.com/${repo}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border font-medium" style={{ ...border, color: "#17211D" }}>
          <Rocket size={13} /> {repo}
        </a>
      </div>

      {error && (
        <p className="text-sm rounded-lg px-3 py-2 mb-4" style={{ background: "#F7EDDD", color: "#B4690E" }}>{error}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        <Column title="Ouvertes" count={open.length}>
          <div className="space-y-2">
            {open.map(pr => <PrCard key={pr.number} pr={pr} tone={{ label: "ouverte", fg: "#3B5488", bg: "#E8ECF5" }} />)}
          </div>
        </Column>
        <Column title="En revue" count={review.length}>
          <div className="space-y-2">
            {review.map(pr => <PrCard key={pr.number} pr={pr} tone={{ label: pr.draft ? "brouillon" : "en revue", fg: "#B4690E", bg: "#F7EDDD" }} />)}
          </div>
        </Column>
        <Column title="Fusionnées" count={merged.length}>
          <div className="space-y-2">
            {merged.map(pr => <PrCard key={pr.number} pr={pr} tone={{ label: "fusionnée", fg: "#6B4A8C", bg: "#F0E9F5" }} />)}
          </div>
        </Column>
        <Column title="Publiées" count={published.length}>
          <div className="space-y-2">
            {published.map(item => <ReleaseCard key={`${item.tag}-${item.date}`} item={item} />)}
          </div>
        </Column>
      </div>
    </div>
  )
}
