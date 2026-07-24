// ============================================================
// Fondation LLM — client compatible API OpenAI (chat/completions)
// ============================================================
// Fournisseur configurable par variables d'environnement (serveur
// uniquement, jamais côté client) :
//   LLM_BASE_URL — défaut : https://api.moonshot.ai/v1 (Kimi)
//   LLM_API_KEY  — clé secrète (jamais commitée)
//   LLM_MODEL    — défaut : kimi-k2-0711-preview
// Le même code fonctionne avec tout fournisseur exposant l'API
// OpenAI (Kimi/Moonshot, OpenAI, Mistral, Anthropic via passerelle…) :
// changer de modèle = changer 3 variables, zéro code.

export interface LlmResult {
  ok: boolean
  content?: string
  error?: string
}

const DEFAULT_BASE_URL = 'https://api.moonshot.ai/v1'
const DEFAULT_MODEL = 'kimi-k2-0711-preview'

export function llmConfigured(): boolean {
  return !!process.env.LLM_API_KEY
}

export async function chatComplete(opts: {
  system: string
  user: string
  temperature?: number
  maxTokens?: number
}): Promise<LlmResult> {
  const apiKey = process.env.LLM_API_KEY
  if (!apiKey) {
    return { ok: false, error: "IA non configurée : ajoutez LLM_API_KEY (et LLM_BASE_URL / LLM_MODEL si besoin) dans l'environnement du serveur." }
  }
  const baseUrl = (process.env.LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
  const model = process.env.LLM_MODEL || DEFAULT_MODEL

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180_000)
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 4096,
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.user },
        ],
      }),
    })
    if (!res.ok) {
      let detail = `HTTP ${res.status}`
      try {
        const body = await res.json()
        detail = body?.error?.message || body?.message || JSON.stringify(body).slice(0, 300) || detail
      } catch { /* corps non JSON */ }
      console.error('[llm] échec API:', { model, status: res.status, detail })
      return { ok: false, error: `Le fournisseur IA a répondu : ${detail}` }
    }
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content) return { ok: false, error: 'Réponse IA vide.' }
    return { ok: true, content }
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError'
    console.error('[llm] exception:', e)
    return { ok: false, error: aborted ? 'Génération interrompue (délai de 3 minutes dépassé).' : `Erreur réseau vers le fournisseur IA : ${e instanceof Error ? e.message : String(e)}` }
  } finally {
    clearTimeout(timeout)
  }
}
