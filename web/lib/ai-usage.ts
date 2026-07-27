import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// ============================================================
// Consommation d'IA — mesure et estimation de coût (0043)
// ============================================================
// Serveur uniquement.
//
// L'application appelle un fournisseur payant à l'usage. Jusqu'ici elle
// ne savait pas ce qu'elle consommait : seul le rapport d'expert gardait
// un total de jetons, la génération de campagnes n'enregistrait rien, et
// aucun écran n'affichait quoi que ce soit. Une dépense engagée
// automatiquement, sans compteur.

export interface AiUsageInput {
  feature: string
  projectId?: string | null
  model?: string | null
  usage?: { prompt?: number; completion?: number; total?: number }
  ok: boolean
  truncated: boolean
}

function adminDb() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// N'échoue jamais et ne bloque rien : compter une dépense ne doit pas
// empêcher de produire le rapport qui la justifie. En revanche l'échec
// est tracé — un compteur muet qui cesse de compter serait pire que pas
// de compteur du tout.
export async function recordAiUsage(input: AiUsageInput): Promise<void> {
  try {
    const db = adminDb()
    if (!db) {
      console.error('[ai-usage] clé service absente — consommation NON enregistrée')
      return
    }
    let userId: string | null = null
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id ?? null
    } catch { /* appel hors session : la consommation compte quand même */ }

    const prompt = input.usage?.prompt ?? 0
    const completion = input.usage?.completion ?? 0
    // Certains fournisseurs ne renvoient que le total. On ne l'invente
    // pas en deux moitiés : il reste au total, et l'estimation de coût
    // le signale.
    const total = input.usage?.total ?? (prompt + completion)

    const { error } = await db.from('ai_usage').insert({
      user_id: userId, project_id: input.projectId ?? null,
      feature: input.feature, model: input.model ?? null,
      prompt_tokens: prompt, completion_tokens: completion, total_tokens: total,
      ok: input.ok, truncated: input.truncated,
    })
    if (error) console.error('[ai-usage] enregistrement échoué:', error.message)
  } catch (e) {
    console.error('[ai-usage] exception:', e)
  }
}

// ------------------------------------------------------------
// Lecture
// ------------------------------------------------------------

export interface AiUsageSummary {
  currency: string
  priceIn: number
  priceOut: number
  monthlyBudget: number
  month: { prompt: number; completion: number; total: number; calls: number; failed: number; cost: number }
  allTime: { total: number; calls: number }
  byFeature: { feature: string; calls: number; total: number; cost: number }[]
  // Vrai si des appels n'ont qu'un total, sans répartition entrée/sortie.
  // L'estimation est alors basse : on impute au tarif d'entrée, le moins
  // cher — mieux vaut annoncer une incertitude qu'un chiffre faux.
  partial: boolean
  configured: boolean
}

export async function getAiUsageSummary(): Promise<AiUsageSummary | null> {
  const db = adminDb()
  if (!db) return null

  const startOfMonth = (() => {
    const d = new Date()
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString()
  })()

  const [{ data: settings }, { data: monthRows }, { count: allCalls, data: allSum }] = await Promise.all([
    db.from('ai_settings')
      .select('price_input_per_million, price_output_per_million, monthly_budget, currency')
      .eq('id', true).maybeSingle(),
    db.from('ai_usage')
      .select('feature, prompt_tokens, completion_tokens, total_tokens, ok')
      .gte('at', startOfMonth),
    db.from('ai_usage').select('total_tokens', { count: 'exact' }),
  ])

  const priceIn = Number(settings?.price_input_per_million ?? 0)
  const priceOut = Number(settings?.price_output_per_million ?? 0)
  const rows = (monthRows ?? []) as { feature: string; prompt_tokens: number; completion_tokens: number; total_tokens: number; ok: boolean }[]

  // Coût = (entrée × tarif entrée + sortie × tarif sortie) / 1 000 000.
  // Quand la répartition manque, tout est imputé à l'entrée : le tarif
  // le moins cher, donc une estimation prudente vers le bas, signalée.
  const costOf = (p: number, c: number, t: number) => {
    const known = p + c
    if (known === 0) return (t * priceIn) / 1_000_000
    return (p * priceIn + c * priceOut) / 1_000_000
  }

  const month = rows.reduce((acc, r) => {
    acc.prompt += r.prompt_tokens; acc.completion += r.completion_tokens
    acc.total += r.total_tokens; acc.calls += 1
    if (!r.ok) acc.failed += 1
    acc.cost += costOf(r.prompt_tokens, r.completion_tokens, r.total_tokens)
    return acc
  }, { prompt: 0, completion: 0, total: 0, calls: 0, failed: 0, cost: 0 })

  const featureMap = new Map<string, { feature: string; calls: number; total: number; cost: number }>()
  for (const r of rows) {
    const f = featureMap.get(r.feature) ?? { feature: r.feature, calls: 0, total: 0, cost: 0 }
    f.calls += 1; f.total += r.total_tokens
    f.cost += costOf(r.prompt_tokens, r.completion_tokens, r.total_tokens)
    featureMap.set(r.feature, f)
  }

  return {
    currency: settings?.currency ?? 'EUR',
    priceIn, priceOut,
    monthlyBudget: Number(settings?.monthly_budget ?? 0),
    month,
    allTime: {
      total: ((allSum ?? []) as { total_tokens: number }[]).reduce((s, r) => s + (r.total_tokens ?? 0), 0),
      calls: allCalls ?? 0,
    },
    byFeature: [...featureMap.values()].sort((a, b) => b.total - a.total),
    partial: rows.some(r => r.prompt_tokens === 0 && r.completion_tokens === 0 && r.total_tokens > 0),
    configured: priceIn > 0 || priceOut > 0,
  }
}
