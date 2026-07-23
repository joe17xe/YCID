"use client"
import { useState, useRef, useTransition } from "react"
import Papa from "papaparse"
import { Upload, X, Check, AlertTriangle, Info } from "lucide-react"
import { runImport, type ImportKind } from "@/app/(app)/import/actions"

const IMPORT_TYPES: Record<ImportKind, { label: string; columns: string[]; required: string[] }> = {
  projets: {
    label: "Projets",
    columns: ["nom", "description", "pays", "zone", "date_debut", "date_fin", "statut", "organisation_porteuse"],
    required: ["nom", "organisation_porteuse"],
  },
  phases: {
    label: "Phases",
    columns: ["projet", "phase", "date_debut", "date_fin", "statut"],
    required: ["projet", "phase"],
  },
  taches: {
    label: "Tâches",
    columns: ["projet", "phase", "titre", "description", "responsable_email", "date_debut", "date_fin", "statut", "avancement", "commentaire"],
    required: ["projet", "phase", "titre"],
  },
  budget: {
    label: "Lignes budgétaires",
    columns: ["projet", "poste", "categorie", "montant_previsionnel", "description", "financeur", "organisation_responsable", "phase", "annee", "valorisation", "statut", "commentaire"],
    required: ["projet", "poste", "categorie", "montant_previsionnel"],
  },
}

export default function ImportClient({ canImport }: { canImport: boolean }) {
  const [importType, setImportType] = useState<ImportKind>("projets")
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [filename, setFilename] = useState("")
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload")
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)
  const [serverError, setServerError] = useState("")
  const [pending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const conf = IMPORT_TYPES[importType]

  function handleFile(file: File) {
    setFilename(file.name)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      delimiter: ";",
      skipEmptyLines: true,
      complete: (parsed) => {
        const errs: string[] = []
        const valid = parsed.data.slice(0, 500).filter((row, i) => {
          const missing = conf.required.filter(col => !row[col]?.trim())
          if (missing.length) { errs.push(`Ligne ${i + 2} : colonnes obligatoires manquantes (${missing.join(", ")})`); return false }
          return true
        })
        setRows(valid)
        setErrors(errs)
        setServerError("")
        setStep("preview")
      },
      error: () => setErrors(["Erreur lors de la lecture du fichier. Vérifiez le format CSV (séparateur ;)."]),
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function confirm() {
    setServerError("")
    startTransition(async () => {
      const res = await runImport({ kind: importType, filename, rows })
      if (res.ok) {
        setResult({ created: res.created, skipped: res.skipped, errors: res.errors })
        setStep("done")
      } else {
        setServerError(res.error ?? "Une erreur est survenue.")
        if (res.errors.length) setErrors(res.errors)
      }
    })
  }

  function reset() { setStep("upload"); setRows([]); setErrors([]); setFilename(""); setResult(null); setServerError("") }

  return (
    <div>
      {step === "done" && result ? (
        <div className="bg-white rounded-2xl border p-12 text-center" style={{ borderColor: "#E3E6E2" }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#E4F0EC" }}>
            <Check size={32} style={{ color: "#0E6B5C" }} />
          </div>
          <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
            {result.created} ligne{result.created > 1 ? "s" : ""} importée{result.created > 1 ? "s" : ""}
          </h2>
          <p className="text-sm mb-2" style={{ color: "#66716B" }}>
            {result.skipped > 0
              ? `${result.skipped} ligne${result.skipped > 1 ? "s" : ""} ignorée${result.skipped > 1 ? "s" : ""} — détail dans le journal ci-dessous.`
              : "Toutes les lignes valides ont été enregistrées."}
          </p>
          <button onClick={reset} className="mt-4 px-6 py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background: "#0E6B5C" }}>
            Nouvel import
          </button>
        </div>
      ) : step === "upload" ? (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border p-6" style={{ borderColor: "#E3E6E2" }}>
            <h2 className="font-semibold mb-4" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Type de données</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(Object.entries(IMPORT_TYPES) as [ImportKind, { label: string }][]).map(([key, { label }]) => (
                <button
                  key={key}
                  onClick={() => setImportType(key)}
                  className="py-3 px-4 rounded-xl text-sm font-medium border transition-colors"
                  style={{
                    background: importType === key ? "#E4F0EC" : "#fff",
                    borderColor: importType === key ? "#0E6B5C" : "#E3E6E2",
                    color: importType === key ? "#0E6B5C" : "#66716B",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-xl text-xs" style={{ background: "#F5F6F4", color: "#66716B" }}>
              Colonnes attendues : <span className="font-mono">{conf.columns.join(" ; ")}</span>
              <br />Colonnes obligatoires* : <span style={{ color: "#A3342C" }}>{conf.required.join(", ")}</span>
            </div>
          </div>

          <div
            className="bg-white rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer"
            style={{ borderColor: "#E3E6E2" }}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={32} className="mx-auto mb-4" style={{ color: "#0E6B5C" }} />
            <p className="font-medium mb-1" style={{ color: "#17211D" }}>Glissez votre fichier ici ou cliquez pour parcourir</p>
            <p className="text-sm" style={{ color: "#66716B" }}>Format CSV, séparateur ; · encodage UTF-8 recommandé · 500 lignes max</p>
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold" style={{ color: "#17211D" }}>{filename}</span>
              <span className="ml-3 text-sm" style={{ color: "#66716B" }}>{rows.length} ligne{rows.length > 1 ? "s" : ""} valide{rows.length > 1 ? "s" : ""}</span>
            </div>
            <button onClick={reset} className="flex items-center gap-1 text-sm" style={{ color: "#66716B" }}>
              <X size={14} /> Annuler
            </button>
          </div>

          {errors.length > 0 && (
            <div className="rounded-xl p-4" style={{ background: "#F7EDDD" }}>
              <div className="flex items-center gap-2 mb-2 font-medium text-sm" style={{ color: "#B4690E" }}>
                <AlertTriangle size={16} /> {errors.length} problème{errors.length > 1 ? "s" : ""} détecté{errors.length > 1 ? "s" : ""}
              </div>
              <ul className="text-xs space-y-1" style={{ color: "#B4690E" }}>
                {errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                {errors.length > 10 && <li>... et {errors.length - 10} autres</li>}
              </ul>
            </div>
          )}

          <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E6E2" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "#F5F6F4", borderBottom: "1px solid #E3E6E2" }}>
                    {Object.keys(rows[0] ?? {}).map(h => (
                      <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: "#66716B" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #E3E6E2", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="px-4 py-2" style={{ color: "#17211D" }}>{String(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 20 && (
              <div className="px-4 py-2 text-xs border-t" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
                Affichage des 20 premières lignes sur {rows.length}
              </div>
            )}
          </div>

          {serverError && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{serverError}</p>
          )}

          {canImport ? (
            <button
              onClick={confirm}
              disabled={pending || rows.length === 0}
              className="w-full py-3 rounded-xl text-white font-semibold transition-opacity"
              style={{ background: "#0E6B5C", opacity: pending || rows.length === 0 ? 0.6 : 1 }}
            >
              {pending ? "Import en cours…" : `Confirmer l'import de ${rows.length} ligne${rows.length > 1 ? "s" : ""}`}
            </button>
          ) : (
            <div className="flex items-start gap-2 rounded-xl p-4 text-sm" style={{ background: "#E8ECF5", color: "#3B5488" }}>
              <Info size={16} className="flex-shrink-0 mt-0.5" />
              <span>L&apos;enregistrement est réservé aux administrateurs YCID / LEY — cet aperçu vous permet de valider le format du fichier.</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
