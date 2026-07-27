"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { HardDrive, Trash2, AlertTriangle } from "lucide-react"
import { purgeOrphans, type BucketStat, type Orphan, type ProjectStat } from "@/app/(app)/admin/stockage/actions"

// Octets en unité lisible. Les tailles utiles ici vont du Ko (un PDF de
// devis) au Go (des centaines de photos de chantier).
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} o`
  const units = ["Ko", "Mo", "Go", "To"]
  let v = n / 1024, i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 100 ? 0 : 1).replace(".", ",")} ${units[i]}`
}

const BUCKET_LABELS: Record<string, string> = {
  documents: "Pièces des projets",
  avatars: "Photos de profil",
  branding: "Marque (logo, favicon)",
}

export default function StorageClient({ buckets, orphans, projects }: {
  buckets: BucketStat[]; orphans: Orphan[]; projects: ProjectStat[]
}) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [done, setDone] = useState("")
  const [pending, startTransition] = useTransition()

  const totalBytes = buckets.reduce((s, b) => s + b.bytes, 0)
  const totalFiles = buckets.reduce((s, b) => s + b.files, 0)
  const orphanBytes = orphans.reduce((s, o) => s + o.bytes, 0)

  function purge() {
    if (!window.confirm(
      `Supprimer définitivement ${orphans.length} fichier(s) orphelin(s) (${fmtBytes(orphanBytes)}) ?\n\n` +
      `Ces fichiers ne sont rattachés à aucune pièce enregistrée : ils ne sont visibles nulle part dans l'application.`
    )) return
    setError(""); setDone("")
    startTransition(async () => {
      const res = await purgeOrphans()
      if (!res.ok) setError(res.error ?? "Purge impossible.")
      else { setDone(`${res.removed} fichier(s) supprimé(s).`); router.refresh() }
    })
  }

  const card = "bg-white rounded-2xl border p-4"
  const border = { borderColor: "#E3E6E2" }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={card} style={border}>
          <div className="text-xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "var(--brand-accent,#0E6B5C)" }}>
            {fmtBytes(totalBytes)}
          </div>
          <div className="text-xs mt-1" style={{ color: "#66716B" }}>Espace occupé</div>
        </div>
        <div className={card} style={border}>
          <div className="text-xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{totalFiles}</div>
          <div className="text-xs mt-1" style={{ color: "#66716B" }}>Fichiers</div>
        </div>
        <div className={card} style={border}>
          <div className="text-xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{projects.length}</div>
          <div className="text-xs mt-1" style={{ color: "#66716B" }}>Projets avec pièces</div>
        </div>
        <div className={card} style={border}>
          <div className="text-xl font-bold" style={{ fontFamily: "var(--font-sora)", color: orphans.length ? "#B4690E" : "#17211D" }}>
            {orphans.length}
          </div>
          <div className="text-xs mt-1" style={{ color: "#66716B" }}>Fichiers orphelins</div>
        </div>
      </div>

      <section className="bg-white rounded-2xl border overflow-hidden" style={border}>
        <h2 className="px-4 py-3 font-semibold border-b flex items-center gap-2" style={{ ...border, fontFamily: "var(--font-sora)", color: "#17211D" }}>
          <HardDrive size={16} aria-hidden="true" /> Par espace de stockage
        </h2>
        <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 620 }}>
          <tbody>
            {buckets.map((b, i) => (
              <tr key={b.bucket} style={{ borderTop: i ? "1px solid #E3E6E2" : undefined }}>
                <td className="px-4 py-3" style={{ color: "#17211D" }}>
                  {BUCKET_LABELS[b.bucket] ?? b.bucket}
                  <span className="ml-2 text-xs font-mono" style={{ color: "#9AA39D" }}>{b.bucket}</span>
                </td>
                <td className="px-4 py-3 text-xs text-right" style={{ color: "#66716B" }}>{b.files} fichier{b.files > 1 ? "s" : ""}</td>
                <td className="px-4 py-3 text-right font-semibold" style={{ color: "#17211D" }}>{fmtBytes(b.bytes)}</td>
              </tr>
            ))}
            {buckets.length === 0 && (
              <tr><td className="px-4 py-6 text-center text-sm" style={{ color: "#66716B" }}>Aucun fichier stocké.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </section>

      {projects.length > 0 && (
        <section className="bg-white rounded-2xl border overflow-hidden" style={border}>
          <h2 className="px-4 py-3 font-semibold border-b" style={{ ...border, fontFamily: "var(--font-sora)", color: "#17211D" }}>
            Par projet
          </h2>
          <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 620 }}>
            <tbody>
              {projects.map((p, i) => (
                <tr key={p.projectId} style={{ borderTop: i ? "1px solid #E3E6E2" : undefined }}>
                  <td className="px-4 py-3" style={{ color: "#17211D" }}>{p.projectName}</td>
                  <td className="px-4 py-3 text-xs text-right" style={{ color: "#66716B" }}>{p.files} fichier{p.files > 1 ? "s" : ""}</td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: "#17211D" }}>{fmtBytes(p.bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      )}

      <section className="bg-white rounded-2xl border overflow-hidden" style={border}>
        <h2 className="px-4 py-3 font-semibold border-b flex items-center gap-2" style={{ ...border, fontFamily: "var(--font-sora)", color: "#17211D" }}>
          <AlertTriangle size={16} aria-hidden="true" /> Fichiers orphelins
        </h2>
        <div className="p-4 space-y-3">
          {/* Origine attendue : la suppression d'une pièce retire d'abord
              la ligne, puis le fichier. Si le second échoue, l'échec est
              journalisé sans bloquer — l'utilisateur ne doit pas rester
              avec une ligne qu'il croit supprimée. D'où ces résidus. */}
          <p className="text-sm" style={{ color: "#66716B" }}>
            Fichiers présents dans le stockage sans pièce correspondante en base. Ils occupent
            de l&apos;espace et ne sont visibles nulle part dans l&apos;application. Ils proviennent
            de suppressions dont le retrait du fichier a échoué après celui de la ligne.
          </p>

          {orphans.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--brand-accent,#0E6B5C)" }}>Aucun fichier orphelin.</p>
          ) : (
            <>
              <ul className="text-xs space-y-1 max-h-64 overflow-y-auto rounded-xl p-3" style={{ background: "#F5F6F4" }}>
                {orphans.map(o => (
                  <li key={o.path} className="flex justify-between gap-3">
                    <span className="font-mono truncate" style={{ color: "#66716B" }}>{o.path}</span>
                    <span className="flex-shrink-0" style={{ color: "#9AA39D" }}>{fmtBytes(o.bytes)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-sm" style={{ color: "#B4690E" }}>
                  {orphans.length} fichier{orphans.length > 1 ? "s" : ""} · {fmtBytes(orphanBytes)} récupérables
                </span>
                <button type="button" onClick={purge} disabled={pending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
                  style={{ background: "#A3342C", opacity: pending ? 0.6 : 1 }}>
                  <Trash2 size={14} aria-hidden="true" /> {pending ? "Purge…" : "Purger"}
                </button>
              </div>
            </>
          )}

          {done && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }}>{done}</p>}
          {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
        </div>
      </section>
    </div>
  )
}
