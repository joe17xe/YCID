"use client"
import { useState, useRef } from "react"
import Papa from "papaparse"
import { Upload, X, Check, AlertTriangle } from "lucide-react"

type ImportType = "projets" | "phases" | "taches" | "budget"

const IMPORT_TYPES: Record<ImportType, { label: string; columns: string[]; required: string[] }> = {
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

export default function ImportPage() {
  const [importType, setImportType] = useState<ImportType>("projets")
  const [rows, setRows] = useState<any[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [filename, setFilename] = useState("")
  const [step, setStep] = useState<"upload" | "preview" | "confirmed">("upload")
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const conf = IMPORT_TYPES[importType]

  function handleFile(file: File) {
    setFilename(file.name)
    Papa.parse(file, {
      header: true,
      delimiter: ";",
      skipEmptyLines: true,
      complete: (result) => {
        const data = result.data as any[]
        const errs: string[] = []
        const valid = data.slice(0, 200).filter((row, i) => {
          const missing = conf.required.filter(col => !row[col]?.trim())
          if (missing.length) { errs.push(`Ligne ${i + 2} : colonnes obligatoires manquantes (${missing.join(", ")})`); return false }
          return true
        })
        setRows(valid)
        setErrors(errs)
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

  async function handleConfirm() {
    setLoading(true)
    // TODO: POST to /api/import
    await new Promise(r => setTimeout(r, 1000))
    setLoading(false)
    setStep("confirmed")
  }

  function reset() { setStep("upload"); setRows([]); setErrors([]); setFilename("") }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Import CSV</h1>
        <p className="mt-1 text-sm" style={{ color: "#66716B" }}>Importez vos données depuis un fichier CSV (séparateur ;)</p>
      </div>

      {step === "confirmed" ? (
        <div className="bg-white rounded-2xl border p-12 text-center" style={{ borderColor: "#E3E6E2" }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#E4F0EC" }}>
            <Check size={32} style={{ color: "#0E6B5C" }} />
          </div>
          <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{rows.length} ligne{rows.length > 1 ? "s" : ""} importée{rows.length > 1 ? "s" : ""}</h2>
          <p className="text-sm mb-6" style={{ color: "#66716B" }}>Les données ont été importées avec succès.</p>
          <button onClick={reset} className="px-6 py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background: "#0E6B5C" }}>
            Nouvel import
          </button>
        </div>
      ) : step === "upload" ? (
        <div className="space-y-6">
          {/* Type selector */}
          <div className="bg-white rounded-2xl border p-6" style={{ borderColor: "#E3E6E2" }}>
            <h2 className="font-semibold mb-4" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Type de données</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(Object.entries(IMPORT_TYPES) as [ImportType, any][]).map(([key, { label }]) => (
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

          {/* Drop zone */}
          <div
            className="bg-white rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer"
            style={{ borderColor: "#E3E6E2" }}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={32} className="mx-auto mb-4" style={{ color: "#0E6B5C" }} />
            <p className="font-medium mb-1" style={{ color: "#17211D" }}>Glissez votre fichier ici ou cliquez pour parcourir</p>
            <p className="text-sm" style={{ color: "#66716B" }}>Format CSV, séparateur ; · encodage UTF-8 recommandé</p>
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
                <AlertTriangle size={16} /> {errors.length} ligne{errors.length > 1 ? "s" : ""} ignorée{errors.length > 1 ? "s" : ""}
              </div>
              <ul className="text-xs space-y-1" style={{ color: "#B4690E" }}>
                {errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                {errors.length > 10 && <li>... et {errors.length - 10} autres erreurs</li>}
              </ul>
            </div>
          )}

          {/* Preview table */}
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
                      {Object.values(row).map((v: any, j) => (
                        <td key={j} className="px-4 py-2" style={{ color: "#17211D" }}>{v}</td>
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

          <button
            onClick={handleConfirm}
            disabled={loading || rows.length === 0}
            className="w-full py-3 rounded-xl text-white font-semibold transition-opacity"
            style={{ background: "#0E6B5C", opacity: loading || rows.length === 0 ? 0.6 : 1 }}
          >
            {loading ? "Import en cours..." : `Confirmer l'import de ${rows.length} ligne${rows.length > 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  )
}
