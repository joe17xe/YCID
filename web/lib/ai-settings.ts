import { cache } from 'react'
import { adminClient } from '@/lib/supabase/admin'

// ============================================================
// Configuration IA — base de données d'abord, variables d'env ensuite
// ============================================================
// La configuration saisie dans Admin ▸ Configuration ▸ Intelligence
// artificielle prime ; à défaut, on retombe sur LLM_* de .env.local.
// SERVEUR UNIQUEMENT : la clé ne doit jamais atteindre le navigateur.

// Fiche d'un fournisseur. Le type est exporté et importé en `import
// type` par AiForm : la forme n'est décrite qu'ICI, à côté des valeurs
// qu'elle décrit. Une interface recopiée dans le composant tenait tant
// que personne n'ajoutait de champ ; `zone` et `transfert` sont
// justement des champs ajoutés après coup.
export interface AiProviderInfo {
  label: string
  baseUrl: string
  model: string
  keyUrl: string
  free: string
  // OÙ partent les données, et à quel titre elles peuvent en partir.
  //
  // Ces deux champs vivent dans la DONNÉE, pas dans le JSX d'un écran,
  // parce que DEUX écrans en dépendent et qu'ils ne s'adressent pas au
  // même lecteur : Admin ▸ Configuration ▸ IA, où l'on CHOISIT le
  // fournisseur — et l'on doit savoir ce que ce choix engage avant de
  // le faire —, et /confidentialite, où la personne concernée doit
  // trouver le pays de destination et la base du transfert (RGPD
  // art. 13.1.f). Écrits deux fois, ils auraient divergé au premier
  // fournisseur ajouté, et c'est la page publique qui aurait menti.
  //
  // Rédaction volontairement FACTUELLE : le pays ou la zone, la base de
  // transfert quand elle existe, rien de plus. Ni alarmisme — le choix
  // reste celui d'YCID —, ni conseil juridique : dire qu'un transfert
  // « est conforme » n'appartient pas à un fichier de configuration.

  /** Pays ou zone de traitement, en quelques mots. */
  zone: string
  /** Base du transfert hors Union européenne, en une phrase. */
  transfert: string
}

export const AI_PROVIDERS: Record<string, AiProviderInfo> = {
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-3.5-flash',
    keyUrl: 'https://aistudio.google.com/apikey',
    free: 'Offre gratuite généreuse · très bon en français',
    zone: 'États-Unis (Google LLC)',
    transfert: 'Décision d\'adéquation UE–États-Unis du 10 juillet 2023 (EU-US Data Privacy Framework), qui couvre les organisations certifiées à ce cadre.',
  },
  groq: {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    keyUrl: 'https://console.groq.com/keys',
    free: 'Offre gratuite · très rapide',
    zone: 'États-Unis (Groq Inc.)',
    transfert: 'Décision d\'adéquation UE–États-Unis du 10 juillet 2023 (EU-US Data Privacy Framework), qui couvre les organisations certifiées à ce cadre.',
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'deepseek/deepseek-chat-v3-0324:free',
    keyUrl: 'https://openrouter.ai/keys',
    free: 'Modèles gratuits (suffixe « :free »)',
    // Le cas le plus difficile à documenter, et il faut le dire tel
    // quel : OpenRouter n'exécute pas le modèle, il réachemine la
    // requête vers celui qui l'héberge. La destination réelle dépend
    // donc du MODÈLE choisi dans le champ voisin, pas du fournisseur.
    zone: 'Variable — réacheminement vers des fournisseurs tiers',
    transfert: 'OpenRouter est établi aux États-Unis et confie la requête au fournisseur du modèle retenu, qui peut se trouver dans un autre pays. La destination finale dépend du modèle choisi et n\'est pas fixée par ce réglage.',
  },
  kimi: {
    label: 'Kimi (Moonshot)',
    baseUrl: 'https://api.moonshot.ai/v1',
    model: 'kimi-k2-0711-preview',
    keyUrl: 'https://platform.moonshot.ai',
    free: 'Crédits à l\'usage',
    zone: 'Chine (Moonshot AI)',
    transfert: 'La Commission européenne n\'a rendu aucune décision d\'adéquation pour la Chine : le transfert repose sur les garanties prévues au contrat conclu avec le fournisseur.',
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
    free: 'Payant à l\'usage',
    zone: 'États-Unis (OpenAI, L.L.C.)',
    transfert: 'Décision d\'adéquation UE–États-Unis du 10 juillet 2023 (EU-US Data Privacy Framework), qui couvre les organisations certifiées à ce cadre.',
  },
  autre: {
    label: 'Autre (compatible OpenAI)',
    baseUrl: '',
    model: '',
    keyUrl: '',
    free: 'Tout service exposant /chat/completions',
    // Seule réponse vraie : l'URL est saisie à la main, l'application
    // ne sait rien de ce qu'il y a au bout. Inventer une zone ici
    // serait pire que l'absence d'information — la page publique la
    // reprendrait telle quelle.
    zone: 'Inconnue de l\'application',
    transfert: 'La destination dépend de l\'URL saisie dans la configuration : l\'application ne peut pas la qualifier. Il revient à YCID de la documenter.',
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
