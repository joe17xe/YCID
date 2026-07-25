export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { adminClient } from '@/lib/supabase/admin'
import { getPlatformSettings } from '@/lib/settings'
import { PROJECT_STATUS, fmtDate } from '@/lib/constants'

// ============================================================
// PR 28 — Page vitrine publique d'un projet (lecture seule)
// ============================================================
// Accessible SANS connexion via un jeton non devinable (/p/<uuid>),
// activée projet par projet (opt-in). Servie via la clé service côté
// serveur — n'expose QUE des informations non sensibles : avancement,
// phases, indicateurs, actualités publiées. Jamais de membres, emails,
// budgets détaillés ni journal interne.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function loadProject(token: string) {
  if (!UUID_RE.test(token)) return null
  const admin = adminClient()
  if (!admin) return null
  const { data: project } = await admin
    .from('projects')
    .select('id, name, description, country, zone, programme, start_date, end_date, status')
    .eq('public_token', token)
    .maybeSingle()
  return project
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const [project, s] = await Promise.all([loadProject(token), getPlatformSettings()])
  return { title: project ? `${project.name} — ${s.brandName}` : s.brandName, robots: { index: false } }
}

export default async function PublicProjectPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const [project, s] = await Promise.all([loadProject(token), getPlatformSettings()])
  if (!project) notFound()
  const admin = adminClient()!

  const [{ data: phases }, { data: indicators }, { data: campaigns }] = await Promise.all([
    admin.from('phases').select('id, name, status, start_date, end_date, tasks(progress, status)').eq('project_id', project.id).order('position'),
    admin.from('indicators').select('id, name, unit, target, measures:indicator_measures(period, value)').eq('project_id', project.id),
    admin.from('comm_campaigns').select('id, title, published_at, languages, contents').eq('project_id', project.id).eq('status', 'publiee').order('published_at', { ascending: false }),
  ])

  const allTasks = (phases ?? []).flatMap(p => p.tasks ?? [])
  const progress = allTasks.length ? Math.round(allTasks.reduce((sum, t) => sum + (t.progress ?? 0), 0) / allTasks.length) : 0
  const st = PROJECT_STATUS[project.status] ?? { label: project.status, fg: "#66716B", bg: "#EEF0EE" }

  const brandVars = { '--brand-accent': s.accentColor, '--brand-accent-soft': s.accentSoftColor } as React.CSSProperties

  return (
    <div className="min-h-screen py-10 px-4" style={{ background: "#F5F6F4", ...brandVars }}>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Marque */}
        <div className="flex items-center gap-2">
          {s.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logoUrl} alt={s.brandName} className="w-8 h-8 rounded-lg object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-lg" style={{ background: "var(--brand-accent,#0E6B5C)" }} />
          )}
          <span className="font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{s.brandName}</span>
        </div>

        {/* En-tête projet */}
        <div className="bg-white rounded-2xl border p-8" style={{ borderColor: "#E3E6E2" }}>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{project.name}</h1>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: st.fg, background: st.bg }}>{st.label}</span>
            {project.programme && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#F0E9F5", color: "#6B4A8C" }}>{project.programme}</span>}
          </div>
          <div className="text-sm mb-3" style={{ color: "#66716B" }}>
            {project.country && <>📍 {project.country}{project.zone ? ` — ${project.zone}` : ""} · </>}
            {project.start_date && <>{fmtDate(project.start_date)} → {fmtDate(project.end_date)}</>}
          </div>
          {project.description && <p className="text-sm mb-5" style={{ color: "#3A423E" }}>{project.description}</p>}
          <div className="flex justify-between text-sm mb-2" style={{ color: "#66716B" }}>
            <span>Avancement global</span>
            <span className="font-semibold" style={{ color: "#17211D" }}>{progress}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "#E3E6E2" }}>
            <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "var(--brand-accent,#0E6B5C)" }} />
          </div>
        </div>

        {/* Phases */}
        {(phases ?? []).length > 0 && (
          <div className="bg-white rounded-2xl border p-8" style={{ borderColor: "#E3E6E2" }}>
            <h2 className="font-semibold mb-4" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Étapes du projet</h2>
            <div className="space-y-4">
              {(phases ?? []).map(p => {
                const tasks = p.tasks ?? []
                const done = tasks.filter(t => t.status === 'terminee').length
                const pProg = tasks.length ? Math.round(tasks.reduce((sum, t) => sum + (t.progress ?? 0), 0) / tasks.length) : (p.status === 'terminee' ? 100 : 0)
                return (
                  <div key={p.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium" style={{ color: "#17211D" }}>{p.name}</span>
                      <span style={{ color: "#66716B" }}>{tasks.length ? `${done}/${tasks.length} réalisées · ` : ""}{pProg}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#E3E6E2" }}>
                      <div className="h-full rounded-full" style={{ width: `${pProg}%`, background: "var(--brand-accent,#0E6B5C)" }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Indicateurs */}
        {(indicators ?? []).length > 0 && (
          <div className="bg-white rounded-2xl border p-8" style={{ borderColor: "#E3E6E2" }}>
            <h2 className="font-semibold mb-4" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Indicateurs d&apos;impact</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(indicators ?? []).map(i => {
                const latest = [...(i.measures ?? [])].sort((a, b) => String(a.period).localeCompare(String(b.period))).pop()
                return (
                  <div key={i.id} className="rounded-xl border p-4" style={{ borderColor: "#E3E6E2" }}>
                    <div className="text-sm font-medium mb-1" style={{ color: "#17211D" }}>{i.name}</div>
                    <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "var(--brand-accent,#0E6B5C)" }}>
                      {latest ? latest.value : "—"}<span className="text-sm font-normal" style={{ color: "#66716B" }}> / {i.target}{i.unit ? ` ${i.unit}` : ""}</span>
                    </div>
                    {latest && <div className="text-xs mt-0.5" style={{ color: "#66716B" }}>période {latest.period}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Actualités = campagnes publiées */}
        {(campaigns ?? []).length > 0 && (
          <div className="bg-white rounded-2xl border p-8" style={{ borderColor: "#E3E6E2" }}>
            <h2 className="font-semibold mb-4" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Actualités</h2>
            <div className="space-y-6">
              {(campaigns ?? []).map(c => {
                const contents = (c.contents ?? {}) as Record<string, Record<string, string>>
                const lang = ['fr', 'en', 'ar'].find(l => contents[l]?.communique) ?? Object.keys(contents)[0]
                const text = lang ? contents[lang]?.communique : null
                return (
                  <article key={c.id}>
                    <h3 className="font-semibold text-sm mb-1" style={{ color: "#17211D" }}>{c.title}</h3>
                    {c.published_at && <div className="text-xs mb-2" style={{ color: "#66716B" }}>{fmtDate(c.published_at.slice(0, 10))}</div>}
                    {text && (
                      <div className="text-sm leading-relaxed whitespace-pre-line" dir={lang === 'ar' ? 'rtl' : 'ltr'} style={{ color: "#3A423E" }}>
                        {text}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          </div>
        )}

        {/* Pied de page */}
        <footer className="text-center text-xs space-y-1 pb-6" style={{ color: "#66716B" }}>
          <div>Projet soutenu dans le cadre du programme {project.programme || "CEM"} avec l&apos;appui d&apos;YCID — Yvelines Coopération Internationale et Développement.</div>
          <div>Suivi assuré avec {s.brandName}.</div>
        </footer>
      </div>
    </div>
  )
}
