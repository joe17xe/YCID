import { cache } from 'react'
import { adminClient } from '@/lib/supabase/admin'

// ============================================================
// Configuration IA — base de données d'abord, variables d'env ensuite
// ============================================================
// La configuration saisie dans Admin ▸ Configuration ▸ Intelligence
// artificielle prime ; à défaut, on retombe sur LLM_* de .env.local.
// SERVEUR UNIQUEMENT : la clé ne doit jamais atteindre le navigateur.

export const AI_PROVIDERS: Record<string, { label: string; baseUrl: string; model: string; keyUrl: string; free: string }> = {
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-3.5-flash',
    keyUrl: 'https://aistudio.google.com/apikey',
    free: 'Offre gratuite généreuse · très bon en français',
  },
  groq: {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    keyUrl: 'https://console.groq.com/keys',
    free: 'Offre gratuite · très rapide',
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'deepseek/deepseek-chat-v3-0324:free',
    keyUrl: 'https://openrouter.ai/keys',
    free: 'Modèles gratuits (suffixe « :free »)',
  },
  kimi: {
    label: 'Kimi (Moonshot)',
    baseUrl: 'https://api.moonshot.ai/v1',
    model: 'kimi-k2-0711-preview',
    keyUrl: 'https://platform.moonshot.ai',
    free: 'Crédits à l\'usage',
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
    free: 'Payant à l\'usage',
  },
  autre: {
    label: 'Autre (compatible OpenAI)',
    baseUrl: '',
    model: '',
    keyUrl: '',
    free: 'Tout service exposant /chat/completions',
  },
}

export interface AiConfig {
  provider: string
  baseUrl: string
  model: string
  apiKey: string | null
  source: 'base' | 'environnement' | 'aucune'
}

// Lecture complète (clé incluse) — usage serveur exclusivement.
export const getAiConfig = cache(async (): Promise<AiConfig> => {
  const envKey = process.env.LLM_API_KEY ?? null
  const envConfig: AiConfig = {
    provider: 'autre',
    baseUrl: process.env.LLM_BASE_URL || AI_PROVIDERS.gemini.baseUrl,
    model: process.env.LLM_MODEL || AI_PROVIDERS.gemini.model,
    apiKey: envKey,
    source: envKey ? 'environnement' : 'aucune',
  }
  try {
    const admin = adminClient()
    if (!admin) return envConfig
    const { data, error } = await admin
      .from('ai_settings')
      .select('provider, base_url, model, api_key')
      .maybeSingle()
    // Table absente (migration 0023 non appliquée) : repli complet
    if (error || !data) return envConfig
    // Fusion CHAMP PAR CHAMP : chaque réglage saisi dans l'interface prime
    // sur son équivalent d'environnement. Auparavant l'absence de clé en
    // base faisait ignorer AUSSI le modèle et l'URL enregistrés, si bien
    // qu'un modèle changé dans l'écran restait sans effet tant que la clé
    // vivait dans .env.local (incident du 25/07/2026).
    const apiKey = data.api_key || envConfig.apiKey
    return {
      provider: data.provider ?? 'autre',
      baseUrl: data.base_url || envConfig.baseUrl,
      model: data.model || envConfig.model,
      apiKey,
      source: data.api_key ? 'base' : (apiKey ? 'environnement' : 'aucune'),
    }
  } catch {
    return envConfig
  }
})

// Version sûre pour l'affichage : jamais la clé, seulement sa présence.
export interface AiConfigPublic {
  provider: string
  baseUrl: string
  model: string
  hasKey: boolean
  source: AiConfig['source']
  tableMissing: boolean
}

export async function getAiConfigPublic(): Promise<AiConfigPublic> {
  const admin = adminClient()
  let tableMissing = false
  if (admin) {
    const { error } = await admin.from('ai_settings').select('id').limit(1)
    if (error) tableMissing = true
  }
  const c = await getAiConfig()
  return {
    provider: c.provider,
    baseUrl: c.baseUrl,
    model: c.model,
    hasKey: !!c.apiKey,
    source: c.source,
    tableMissing,
  }
}
