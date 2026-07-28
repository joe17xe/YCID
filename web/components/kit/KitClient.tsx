"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Upload, Trash2, Download, FileText } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

// ============================================================
// Kit de communication (0057)
// ============================================================
// La page HÉBERGE le kit livré par le designer (fabriqué chez Canva,
// décision du 28/07) : chacun télécharge, les admins déposent et
// retirent. Un dossier PLAT tenu par les admins — le jour où il
// déborde, on en reparle (arbitrage de la roadmap).

export interface KitFile {
  name: string
  size: number | null
  createdAt: string | null
  url: string | null
}

function fmtSize(bytes: number | null): string {
  if (bytes == null) return ""
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export default function KitClient({ files, isAdmin }: { files: KitFile[]; isAdmin: boolean }) {
  const router = useRouter()
  const supabase = createClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  async function upload(list: FileList | null) {
    if (!list?.length) return
    setError("")
    setBusy(true)
    const failed: string[] = []
    for (const file of Array.from(list)) {
      if (file.size > 25 * 1024 * 1024) { failed.push(`${file.name} (plus de 25 Mo)`); continue }
      const { error: upErr } = await supabase.storage.from("communication")
        .upload(file.name, file, { upsert: true })
      if (upErr) failed.push(`${file.name} (${upErr.message})`)
    }
    setBusy(false)
    if (failed.length) setError(`Non déposé : ${failed.join(" · ")}`)
    router.refresh()
  }

  function remove(name: string) {
    if (!window.confirm(`Retirer « ${name} » du kit ?`)) return
    setError("")
    startTransition(async () => {
      const { error: delErr } = await supabase.storage.from("communication").remove([name])
      if (delErr) setError(`Échec du retrait : ${delErr.message}`)
      else router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="bg-white rounded-2xl border p-5" style={{ borderColor: "#E3E6E2" }}>
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white cursor-pointer"
            style={{ background: "var(--brand-accent,#0E6B5C)", opacity: busy ? 0.6 : 1 }}>
            <Upload size={15} aria-hidden="true" /> {busy ? "Dépôt…" : "Déposer des fichiers"}
            <input type="file" multiple className="sr-only" disabled={busy}
              onChange={e => { void upload(e.target.files); e.target.value = "" }} />
          </label>
          <p className="text-xs mt-2" style={{ color: "#66716B" }}>
            Les exports du designer (pack de logos, charte, gabarits — depuis Canva), 25 Mo max par fichier.
            Un fichier du même nom remplace l&apos;ancien.
          </p>
        </div>
      )}

      {error && <p className="text-sm rounded-xl px-4 py-3" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}

      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E6E2" }}>
        <div className="divide-y" style={{ borderColor: "#E3E6E2" }}>
          {files.map(f => (
            <div key={f.name} className="px-5 py-3 flex items-center gap-3">
              <FileText size={18} aria-hidden="true" className="flex-shrink-0" style={{ color: "#66716B" }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: "#17211D" }}>{f.name}</div>
                <div className="text-xs" style={{ color: "#66716B" }}>
                  {fmtSize(f.size)}
                  {f.createdAt && ` · déposé le ${new Date(f.createdAt).toLocaleDateString("fr-FR")}`}
                </div>
              </div>
              {f.url && (
                <a href={f.url} download={f.name}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium flex-shrink-0"
                  style={{ borderColor: "#E3E6E2", color: "var(--brand-accent,#0E6B5C)" }}>
                  <Download size={13} aria-hidden="true" /> Télécharger
                </a>
              )}
              {isAdmin && (
                <button type="button" onClick={() => remove(f.name)} disabled={pending}
                  className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0" aria-label={`Retirer ${f.name}`}>
                  <Trash2 size={14} style={{ color: "#A3342C" }} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
          {files.length === 0 && (
            <p className="p-8 text-center text-sm" style={{ color: "#66716B" }}>
              Le kit est vide pour l&apos;instant — les supports du designer apparaîtront ici.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
