import { getAiConfig } from '@/lib/ai-settings'
import { recordAiUsage } from '@/lib/ai-usage'

// ============================================================
// Fondation LLM — client compatible API OpenAI (chat/completions)
// ============================================================
// Fournisseur configurable dans Admin ▸ Configuration ▸ IA (ou par les
// variables LLM_* du serveur). Le même code fonctionne avec tout service
// exposant l'API OpenAI (Gemini, Groq, OpenRouter, Kimi, OpenAI…).
//
// Incident du 25/07/2026 : avec un modèle à raisonnement (gemini-3.x),
// les « thinking tokens » consommaient tout le budget de sortie —
// réponse vide sur requête courte, JSON tronqué, rapports coupés en
// plein mot. D'où : bride du raisonnement, budget de sortie élevé,
// mode JSON natif, réparation et nouvelle tentative automatiques.

export interface LlmResult {
  ok: boolean
  content?: string
  error?: string
  model?: string
  finishReason?: string
  usage?: { prompt?: number; completion?: number; total?: number }
  truncated?: boolean
}

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai'
const DEFAULT_MODEL = 'gemini-flash-latest'
const TIMEOUT_MS = 180_000

export async function llmConfigured(): Promise<boolean> {
  return !!(await getAiConfig()).apiKey
}

// Modèles qui « réfléchissent » avant de répondre : il faut brider le
// raisonnement, sans quoi il épuise max_tokens avant d'écrire.
function isReasoningModel(model: string, baseUrl: string): boolean {
  return /gemini-[3-9]|thinking|reasoning|^o[1-9]|gpt-5/i.test(model) || /googleapis\.com/i.test(baseUrl)
}

// Extrait un objet JSON d'une réponse : retire les blocs de code, isole
// le premier objet équilibré, supprime les virgules terminales.
export function extractJson<T = unknown>(raw: string): T | null {
  if (!raw) return null
  let s = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  const start = s.indexOf('{')
  if (start === -1) return null
  let depth = 0, end = -1, inStr = false, esc = false
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (esc) { esc = false; continue }
    if (c === '\\') { esc = true; continue }
    if (c === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) { end = i; break } }
  }
  s = end === -1 ? s.slice(start) : s.slice(start, end + 1)
  const tryParse = (txt: string): T | null => {
    try { return JSON.parse(txt) as T } catch { return null }
  }
  return tryParse(s) ?? tryParse(s.replace(/,\s*([}\]])/g, '$1'))
}

interface ChatOptions {
  system: string
  user: string
  temperature?: number
  maxTokens?: number
  json?: boolean      // demande une réponse JSON stricte au fournisseur
  attempts?: number   // tentatives totales (défaut 2)
  // Comptabilisation (0043). Renseigné ici plutôt que dans chaque
  // appelant : la génération des contenus de communication appelait
  // l'IA sans rien enregistrer, et personne ne s'en était aperçu. Un
  // compteur qu'on peut oublier de brancher n'est pas un compteur.
  usageContext?: { feature: string; projectId?: string | null }
}

async function callOnce(opts: ChatOptions, config: { apiKey: string; baseUrl: string; model: string }): Promise<LlmResult> {
  const { apiKey, baseUrl, model } = config
  const body: Record<string, unknown> = {
    model,
    temperature: opts.temperature ?? 0.3,
    // Budget large : le raisonnement éventuel s'impute sur ce total
    max_tokens: opts.maxTokens ?? 12_000,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
  }
  // Bride du raisonnement : garde l'essentiel du budget pour le texte
  if (isReasoningModel(model, baseUrl)) body.reasoning_effort = 'low'
  // Mode JSON natif quand c'est un objet qui est attendu
  if (opts.json) body.response_format = { type: 'json_object' }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const raw = await res.text()
    if (!res.ok) {
      let detail = `HTTP ${res.status}`
      try {
        const b = JSON.parse(raw)
        detail = b?.error?.message || b?.message || detail
      } catch { /* corps non JSON */ }
      console.error('[llm] échec API:', { model, status: res.status, detail })
      // 429 / 5xx : nouvelle tentative utile
      return { ok: false, error: `Le fournisseur IA a répondu : ${detail}`, model, finishReason: res.status >= 500 || res.status === 429 ? 'retry' : 'error' }
    }
    const data = JSON.parse(raw)
    const choice = data?.choices?.[0]
    const content: string = choice?.message?.content ?? ''
    const finishReason: string = choice?.finish_reason ?? ''
    const usage = {
      prompt: data?.usage?.prompt_tokens,
      completion: data?.usage?.completion_tokens,
      total: data?.usage?.total_tokens,
    }
    if (!content.trim()) {
      console.error('[llm] réponse vide:', { model, finishReason, usage })
      return {
        ok: false, model, finishReason, usage,
        error: finishReason === 'length'
          ? `Budget de sortie épuisé par le raisonnement du modèle « ${model} » avant toute rédaction. Choisissez un modèle « flash » non raisonnant dans Administration ▸ Configuration ▸ IA.`
          : 'Réponse IA vide.',
      }
    }
    return { ok: true, content, model, finishReason, usage, truncated: finishReason === 'length' }
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError'
    console.error('[llm] exception:', e)
    return {
      ok: false, model, finishReason: 'retry',
      error: aborted ? `Génération interrompue (délai de ${TIMEOUT_MS / 1000} s dépassé).` : `Erreur réseau vers le fournisseur IA : ${e instanceof Error ? e.message : String(e)}`,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function chatComplete(opts: ChatOptions): Promise<LlmResult> {
  const config = await getAiConfig()
  if (!config.apiKey) {
    return { ok: false, error: "IA non configurée : renseignez le fournisseur et la clé API dans Administration ▸ Configuration ▸ Intelligence artificielle." }
  }
  const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '')
  const model = config.model || DEFAULT_MODEL
  const attempts = Math.max(1, opts.attempts ?? 2)

  const feature = opts.usageContext?.feature ?? 'inconnu'
  let last: LlmResult = { ok: false, error: 'Aucune tentative effectuée.' }
  for (let i = 0; i < attempts; i++) {
    last = await callOnce(opts, { apiKey: config.apiKey, baseUrl, model })
    // CHAQUE tentative est comptée, réussie ou non : un appel qui
    // échoue a déjà consommé ses jetons d'entrée, et deux tentatives
    // coûtent deux fois. Ne compter que le succès sous-estimerait la
    // facture d'autant plus que le service fonctionne mal.
    await recordAiUsage({
      feature, projectId: opts.usageContext?.projectId ?? null,
      model: last.model ?? model, usage: last.usage,
      ok: last.ok, truncated: !!last.truncated,
    })
    if (last.ok) return last
    // On ne réessaie que ce qui a une chance d'aboutir
    const retryable = last.finishReason === 'retry' || last.finishReason === 'length' || last.error === 'Réponse IA vide.'
    if (!retryable || i === attempts - 1) break
    await new Promise(r => setTimeout(r, 1200 * (i + 1)))
  }
  return last
}
