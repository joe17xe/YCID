"use client"
import { useState } from "react"
import { Sparkles, X, Copy, Download, Printer, Check, History, ChevronLeft } from "lucide-react"
import { generateExpertReport, listReports, getReport, type ReportSummary } from "@/app/(app)/projets/[id]/report-actions"

// ============================================================
// PR 25 — Rapport d'expert IA (bouton + dialogue)
// ============================================================

// Mini-rendu Markdown (titres, gras, listes, séparateurs) — suffisant pour
// le rapport structuré, sans dépendance externe.
function renderMarkdown(md: string): React.ReactNode[] {
  // Gras **texte** puis italique *texte* — sinon les astérisques
  // s'affichaient littéralement dans le livrable.
  const bold = (s: string, key: number): React.ReactNode[] => {
    const out: React.ReactNode[] = []
    s.split(/\*\*(.+?)\*\*/g).forEach((part, i) => {
      if (i % 2 === 1) { out.push(<strong key={`${key}-b${i}`}>{part}</strong>); return }
      part.split(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g).forEach((sub, j) => {
        out.push(j % 2 === 1 ? <em key={`${key}-i${i}-${j}`}>{sub}</em> : sub)
      })
    })
    return out
  }
  const nodes: React.ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  const flush = (key: string) => {
    if (!list) return
    const items = list.items.map((it, i) => <li key={i} className="ml-5 list-disc text-sm leading-relaxed">{bold(it, i)}</li>)
    nodes.push(list.ordered
      ? <ol key={key} className="space-y-1 my-2 [&>li]:list-decimal">{items}</ol>
      : <ul key={key} className="space-y-1 my-2">{items}</ul>)
    list = null
  }
  md.split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.trimEnd()
    const mList = line.match(/^\s*[-*]\s+(.*)/)
    const mNum = line.match(/^\s*\d+[.)]\s+(.*)/)
    if (mList || mNum) {
      const ordered = !!mNum
      if (!list || list.ordered !== ordered) { flush(`f${idx}`); list = { ordered, items: [] } }
      list.items.push((mList?.[1] ?? mNum?.[1] ?? ""))
      return
    }
    flush(`f${idx}`)
    if (!line.trim()) return
    if (line.startsWith("### ")) nodes.push(<h4 key={idx} className="font-semibold mt-4 mb-1" style={{ color: "#17211D" }}>{bold(line.slice(4), idx)}</h4>)
    else if (line.startsWith("## ")) nodes.push(<h3 key={idx} className="font-bold text-base mt-5 mb-1.5" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{bold(line.slice(3), idx)}</h3>)
    else if (line.startsWith("# ")) nodes.push(<h2 key={idx} className="font-bold text-lg mb-2" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{bold(line.slice(2), idx)}</h2>)
    else if (/^-{3,}$/.test(line)) nodes.push(<hr key={idx} className="my-3" style={{ borderColor: "#E3E6E2" }} />)
    else nodes.push(<p key={idx} className="text-sm leading-relaxed my-1.5" style={{ color: "#3A423E" }}>{bold(line, idx)}</p>)
  })
  flush("end")
  return nodes
}

export default function ExpertReportDialog({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState("")
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  // Consignes libres du chef de projet / de l'expert local, envoyées au
  // modèle en plus des données du projet.
  const [instructions, setInstructions] = useState("")
  // Historique : un rapport est une pièce datée, comparable dans le temps
  const [history, setHistory] = useState<ReportSummary[]>([])
  const [showHistory, setShowHistory] = useState(false)

  async function openDialog() {
    setOpen(true)
    const res = await listReports(projectId)
    if (res.ok && res.reports) setHistory(res.reports)
  }

  async function loadPast(id: string) {
    setLoading(true); setError(""); setShowHistory(false)
    const res = await getReport(id)
    if (res.ok && res.report) setReport(res.report)
    else setError(res.error ?? "Rapport introuvable.")
    setLoading(false)
  }

  async function generate() {
    setLoading(true); setError(""); setCopied(false)
    const res = await generateExpertReport(projectId, instructions)
    if (res.ok && res.report) {
      setReport(res.report)
      const h = await listReports(projectId)
      if (h.ok && h.reports) setHistory(h.reports)
    } else setError(res.error ?? "Une erreur est survenue.")
    setLoading(false)
  }

  async function copy() {
    await navigator.clipboard.writeText(report)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function download() {
    const blob = new Blob([report], { type: "text/markdown;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `rapport-${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function print() {
    const w = window.open("", "_blank", "width=900,height=700")
    if (!w) return
    const safe = report.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    w.document.write(`<html><head><title>Rapport — ${projectName}</title><style>
      body{font-family:Georgia,serif;max-width:760px;margin:2rem auto;line-height:1.55;color:#17211D;white-space:pre-wrap}
    </style></head><body>${safe}</body></html>`)
    w.document.close()
    w.print()
  }

  return (
    <>
      <button
        onClick={openDialog}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
        style={{ background: "var(--brand-accent,#0E6B5C)" }}
      >
        <Sparkles size={15} /> Rapport d&apos;expert IA
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !loading && setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#E3E6E2" }}>
              <h2 className="font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
                <Sparkles size={18} style={{ color: "var(--brand-accent,#0E6B5C)" }} /> Rapport d&apos;expert IA
              </h2>
              <span className="flex items-center gap-1">
                {history.length > 0 && (
                  <button onClick={() => setShowHistory(v => !v)}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-medium"
                    style={{ borderColor: "#E3E6E2", color: showHistory ? "var(--brand-accent,#0E6B5C)" : "#17211D" }}>
                    {showHistory ? <><ChevronLeft size={13} /> Retour</> : <><History size={13} /> Historique ({history.length})</>}
                  </button>
                )}
                <button onClick={() => setOpen(false)} disabled={loading} aria-label="Fermer" className="p-1.5 rounded-lg hover:bg-gray-50" style={{ color: "#66716B" }}>
                  <X size={20} />
                </button>
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {showHistory ? (
                <div className="divide-y" style={{ borderColor: "#E3E6E2" }}>
                  <p className="text-xs pb-3" style={{ color: "#66716B" }}>
                    Rapports déjà générés pour ce projet — cliquez pour rouvrir sans régénérer.
                  </p>
                  {history.map(h => (
                    <button key={h.id} onClick={() => loadPast(h.id)}
                      className="w-full text-left py-3 hover:bg-gray-50 transition-colors">
                      <span className="block text-sm font-medium" style={{ color: "#17211D" }}>
                        {new Date(h.createdAt).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}
                        {h.truncated && <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ background: "#F7EDDD", color: "#B4690E" }}>tronqué</span>}
                      </span>
                      <span className="block text-xs mt-0.5" style={{ color: "#66716B" }}>
                        {h.authorName} · modèle {h.model ?? "?"}{h.instructions ? " · avec consignes" : ""}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (<>
              {!report && !loading && !error && (
                <div className="text-center py-8">
                  <p className="text-sm mb-1" style={{ color: "#17211D" }}>
                    Générer un rapport d&apos;expertise complet du projet <strong>{projectName}</strong> ?
                  </p>
                  <p className="text-xs mb-5" style={{ color: "#66716B" }}>
                    Analyse de l&apos;avancement, du budget, des indicateurs et des risques — à partir des
                    données réelles du projet uniquement. Environ 30 secondes.
                  </p>
                  <div className="text-left mb-5">
                    <label htmlFor="report-instructions" className="block text-xs font-semibold mb-1 tracking-wider" style={{ color: "#66716B" }}>
                      CONSIGNES (FACULTATIF)
                    </label>
                    <textarea id="report-instructions" rows={3} value={instructions}
                      onChange={e => setInstructions(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border text-sm"
                      style={{ borderColor: "#E3E6E2" }}
                      placeholder="Contexte terrain, angle attendu, points à approfondir. Ex. : « Insister sur le retard des aménagements et son impact sur le calendrier de la convention. »" />
                    <p className="text-xs mt-1" style={{ color: "#66716B" }}>
                      Vos consignes priment sur la trame par défaut. Les chiffres restent tirés des seules données du projet.
                    </p>
                  </div>
                  <button onClick={generate} className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: "var(--brand-accent,#0E6B5C)" }}>
                    Générer le rapport
                  </button>
                </div>
              )}
              {loading && (
                <div className="text-center py-12">
                  <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-4" style={{ borderColor: "var(--brand-accent,#0E6B5C)", borderTopColor: "transparent" }} />
                  <p className="text-sm" style={{ color: "#66716B" }}>Analyse des données du projet en cours…</p>
                </div>
              )}
              {error && (
                <div className="text-sm rounded-lg px-4 py-3 my-4" style={{ background: "#F6E7E5", color: "#A3342C" }}>
                  {error}
                </div>
              )}
              {report && <div>{renderMarkdown(report)}</div>}
              </>)}
            </div>

            {report && (
              <div className="flex items-center gap-2 px-6 py-4 border-t flex-wrap" style={{ borderColor: "#E3E6E2" }}>
                <button onClick={copy} className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: "#E3E6E2", color: "#17211D" }}>
                  {copied ? <Check size={14} style={{ color: "var(--brand-accent,#0E6B5C)" }} /> : <Copy size={14} />} {copied ? "Copié" : "Copier"}
                </button>
                <button onClick={download} className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: "#E3E6E2", color: "#17211D" }}>
                  <Download size={14} /> Télécharger
                </button>
                <button onClick={print} className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: "#E3E6E2", color: "#17211D" }}>
                  <Printer size={14} /> Imprimer / PDF
                </button>
                <button onClick={generate} className="ml-auto text-xs underline" style={{ color: "#66716B" }}>
                  Régénérer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
