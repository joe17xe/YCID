"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Sparkles, ExternalLink, AlertTriangle } from "lucide-react"
import { updateAiSettings, testAiConnection, listAiModels } from "@/app/(app)/admin/configuration/settings-actions"

// ============================================================
// PR 31 — Configuration du fournisseur IA (Admin ▸ Configuration)
// ============================================================
// La clé API n'est JAMAIS envoyée au navigateur : le serveur ne
// transmet qu'un booléen « configurée ». Laisser le champ vide
// conserve la clé existante.

const labelCls = "block text-xs font-semibold mb-1 tracking-wider"
const inputCls = "w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
const border = { borderColor: "#E3E6E2" }

export interface AiProviderInfo { label: string; baseUrl: string; model: string; keyUrl: string; free: string }
export interface AiSettingsView {
  provider: string; baseUrl: string; model: string
  hasKey: boolean; source: string; tableMissing: boolean
}

export default function AiForm({ settings, providers }: { settings: AiSettingsView; providers: Record<string, AiProviderInfo> }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [models, setModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [form, setForm] = useState({
    provider: settings.provider,
    baseUrl: settings.baseUrl,
    model: settings.model,
    apiKey: "",
  })

  // Changer de fournisseur pré-remplit URL et modèle recommandés
  function pickProvider(key: string) {
    const p = providers[key]
    setForm(f => ({
      ...f,
      provider: key,
      baseUrl: p?.baseUrl || f.baseUrl,
      model: p?.model || f.model,
    }))
    setSaved(false); setTestResult(null)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(""); setTestResult(null)
    startTransition(async () => {
      const res = await updateAiSettings(form)
      if (res.ok) { setSaved(true); setForm(f => ({ ...f, apiKey: "" })); router.refresh() }
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  // Interroge le fournisseur : les identifiants de modèles changent
  // (ex. gemini-2.5-flash retiré le 09/07/2026), mieux vaut les lire
  // que les deviner.
  async function loadModels() {
    setLoadingModels(true); setError(""); setTestResult(null)
    const res = await listAiModels({ baseUrl: form.baseUrl, apiKey: form.apiKey })
    if (res.ok && res.models) {
      setModels(res.models)
      // Si le modèle saisi n'existe plus, on propose le premier compatible
      if (!res.models.includes(form.model)) {
        const suggestion = res.models.find(m => /flash|mini|haiku|turbo/i.test(m)) ?? res.models[0]
        setForm(f => ({ ...f, model: suggestion }))
        setError(`Le modèle « ${form.model} » n'est pas proposé par le fournisseur — remplacé par « ${suggestion} ». Vérifiez puis enregistrez.`)
      }
    } else {
      setError(res.error ?? "Impossible de récupérer la liste des modèles.")
    }
    setLoadingModels(false)
  }

  async function test() {
    setTesting(true); setError(""); setTestResult(null)
    const res = await testAiConnection()
    setTestResult(res.ok
      ? { ok: true, text: `Connexion réussie avec « ${settings.model} » — le modèle a répondu : « ${res.reply} »` }
      : { ok: false, text: res.error ?? "Échec du test." })
    setTesting(false)
  }

  const current = providers[form.provider]

  return (
    <form onSubmit={submit} className="space-y-6">
      {settings.tableMissing && (
        <p className="text-sm rounded-lg px-3 py-2 flex items-start gap-2" style={{ background: "#F7EDDD", color: "#B4690E" }}>
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>Migration <strong>0023_ai_settings.sql</strong> non appliquée : l&apos;enregistrement échouera tant qu&apos;elle n&apos;est pas passée dans le SQL Editor Supabase.</span>
        </p>
      )}

      <div className="bg-white rounded-2xl border p-6 space-y-5" style={border}>
        {/* État actuel */}
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="text-xs font-semibold tracking-wider" style={{ color: "#66716B" }}>ÉTAT</span>
          {settings.hasKey ? (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }}>
              Clé configurée ({settings.source === "base" ? "enregistrée ici" : "variable du serveur"})
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#F6E7E5", color: "#A3342C" }}>Aucune clé — les fonctions IA sont inactives</span>
          )}
        </div>
        {/* Configuration RÉELLEMENT utilisée par le serveur : lève toute
            ambiguïté entre ce qui est saisi ici et les variables du serveur */}
        <p className="text-xs -mt-3" style={{ color: "#66716B" }}>
          Actuellement utilisé : modèle <span className="font-mono">{settings.model}</span> sur <span className="font-mono">{settings.baseUrl}</span>
        </p>

        <div>
          <label className={labelCls} style={{ color: "#66716B" }}>FOURNISSEUR</label>
          <select value={form.provider} onChange={e => pickProvider(e.target.value)} className={inputCls} style={border}>
            {Object.entries(providers).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
          </select>
          {current?.free && (
            <p className="text-xs mt-1 flex items-center gap-2" style={{ color: "#66716B" }}>
              {current.free}
              {current.keyUrl && (
                <a href={current.keyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline" style={{ color: "var(--brand-accent,#0E6B5C)" }}>
                  obtenir une clé <ExternalLink size={11} />
                </a>
              )}
            </p>
          )}
        </div>

        <div>
          <label className={labelCls} style={{ color: "#66716B" }}>CLÉ API</label>
          <input type="password" value={form.apiKey} autoComplete="off"
            onChange={e => { setForm({ ...form, apiKey: e.target.value }); setSaved(false) }}
            placeholder={settings.hasKey ? "•••••••••••• (laisser vide pour conserver)" : "Collez la clé du fournisseur"}
            className={inputCls} style={border} />
          <p className="text-xs mt-1" style={{ color: "#66716B" }}>
            Stockée côté serveur, jamais renvoyée au navigateur. Laisser vide conserve la clé actuelle.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} style={{ color: "#66716B" }}>URL DE L&apos;API</label>
            <input value={form.baseUrl} onChange={e => { setForm({ ...form, baseUrl: e.target.value }); setSaved(false) }}
              className={inputCls} style={border} placeholder="https://…/v1" />
          </div>
          <div>
            <label className={labelCls} style={{ color: "#66716B" }}>MODÈLE</label>
            <input list="ai-models" value={form.model}
              onChange={e => { setForm({ ...form, model: e.target.value }); setSaved(false) }}
              className={inputCls} style={border} placeholder="gemini-3.5-flash" />
            <datalist id="ai-models">
              {models.map(m => <option key={m} value={m} />)}
            </datalist>
            <button type="button" onClick={loadModels} disabled={loadingModels}
              className="text-xs underline mt-1" style={{ color: "var(--brand-accent,#0E6B5C)" }}>
              {loadingModels ? "Chargement…" : models.length ? `${models.length} modèles disponibles — recharger` : "Charger les modèles disponibles"}
            </button>
          </div>
        </div>
        <p className="text-xs" style={{ color: "#66716B" }}>
          Tout service exposant l&apos;API OpenAI (<span className="font-mono">/chat/completions</span>) convient.
          Utilisé par le rapport d&apos;expert IA et la génération des contenus de communication.
        </p>
      </div>

      {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
      {saved && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }}>Enregistré.</p>}
      {testResult && (
        <p className="text-sm rounded-lg px-3 py-2" style={testResult.ok
          ? { background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }
          : { background: "#F6E7E5", color: "#A3342C" }}>
          {testResult.text}
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button type="submit" disabled={pending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold"
          style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending ? 0.7 : 1 }}>
          <Check size={16} /> {pending ? "…" : "Enregistrer"}
        </button>
        <button type="button" onClick={test} disabled={testing || pending}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium"
          style={{ ...border, color: "#17211D" }}>
          <Sparkles size={15} /> {testing ? "Test en cours…" : "Tester la connexion"}
        </button>
      </div>
    </form>
  )
}
