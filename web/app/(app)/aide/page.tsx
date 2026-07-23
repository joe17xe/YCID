export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ACCESS_ROLES, REVIEW_STATES } from "@/lib/constants"
import { HELP_INTRO, HELP_SECURITY, HELP_ROLES, HELP_STEPS, HELP_FAQ } from "@/lib/help-content"
import { BookOpen, ShieldCheck, Users, MessageCircleQuestion } from "lucide-react"

function Card({ id, icon, title, children }: { id?: string; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="bg-white rounded-2xl border p-6 scroll-mt-20" style={{ borderColor: "#E3E6E2" }}>
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

export default async function AidePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const FLOW = ["brouillon", "soumis", "en_revue", "valide"]

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Aide et prise en main</h1>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: "#66716B" }}>{HELP_INTRO}</p>
      </div>

      <div className="space-y-6">
        <Card id="premiers-pas" icon={<BookOpen size={16} style={{ color: "#0E6B5C" }} />} title="Premiers pas">
          <div className="space-y-4">
            {HELP_STEPS.map(st => (
              <div key={st.title}>
                <div className="text-sm font-medium" style={{ color: "#17211D" }}>{st.title}</div>
                <p className="text-sm mt-0.5 leading-relaxed" style={{ color: "#66716B" }}>{st.text}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card id="roles" icon={<Users size={16} style={{ color: "#0E6B5C" }} />} title="Les profils d'accès">
          <div className="space-y-3">
            {HELP_ROLES.map(r => {
              const meta = ACCESS_ROLES[r.role]
              return (
                <div key={r.role} className="flex items-start gap-3">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 mt-0.5" style={{ background: meta?.bg ?? "#EEF0EE", color: meta?.fg ?? "#66716B" }}>
                    {meta?.short ?? r.role}
                  </span>
                  <p className="text-sm leading-relaxed" style={{ color: "#66716B" }}>{r.desc}</p>
                </div>
              )
            })}
          </div>
        </Card>

        <Card id="validation" icon={<ShieldCheck size={16} style={{ color: "#0E6B5C" }} />} title="Le workflow de validation">
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            {FLOW.map((st, i) => {
              const meta = REVIEW_STATES[st]
              return (
                <span key={st} className="flex items-center gap-1.5">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: meta.bg, color: meta.fg }}>{meta.label}</span>
                  {i < FLOW.length - 1 && <span style={{ color: "#66716B" }}>→</span>}
                </span>
              )
            })}
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "#66716B" }}>{HELP_SECURITY}</p>
        </Card>

        <Card id="faq" icon={<MessageCircleQuestion size={16} style={{ color: "#0E6B5C" }} />} title="Questions fréquentes">
          <div className="divide-y" style={{ borderColor: "#E3E6E2" }}>
            {HELP_FAQ.map(f => (
              <details key={f.q} className="py-3 group">
                <summary className="text-sm font-medium cursor-pointer list-none flex items-center justify-between" style={{ color: "#17211D" }}>
                  {f.q}
                  <span className="transition-transform group-open:rotate-90" style={{ color: "#66716B" }}>›</span>
                </summary>
                <p className="text-sm mt-2 leading-relaxed" style={{ color: "#66716B" }}>{f.a}</p>
              </details>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
