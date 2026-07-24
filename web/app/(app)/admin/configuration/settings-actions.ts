'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isUserAdmin } from '@/lib/permissions'

const HEX = /^#[0-9A-Fa-f]{6}$/

interface BrandInput {
  brandName: string
  tagline: string
  accentColor: string
  accentSoftColor: string
  logoUrl: string | null
}

export async function updateBrandSettings(input: BrandInput): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Non authentifié.' }
    if (!(await isUserAdmin(supabase, user.id))) return { ok: false, error: 'Réservé aux administrateurs.' }

    const brandName = (input.brandName ?? '').trim()
    if (!brandName) return { ok: false, error: 'Le nom de la plateforme est obligatoire.' }
    if (!HEX.test(input.accentColor)) return { ok: false, error: "Couleur d'accent invalide (format #RRGGBB)." }
    if (!HEX.test(input.accentSoftColor)) return { ok: false, error: 'Couleur secondaire invalide (format #RRGGBB).' }

    const { error } = await supabase.from('platform_settings').update({
      brand_name: brandName,
      tagline: (input.tagline ?? '').trim(),
      accent_color: input.accentColor,
      accent_soft_color: input.accentSoftColor,
      logo_url: input.logoUrl,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }).eq('id', true)
    if (error) {
      console.error('[updateBrandSettings] échec:', { code: error.code, message: error.message, details: error.details })
      return { ok: false, error: `Échec de l'enregistrement : ${error.message}` }
    }

    // Rafraîchit la marque partout (layout racine : variables CSS, métadonnées)
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (e) {
    console.error('[updateBrandSettings] exception:', e)
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `Échec de l'enregistrement : ${message}` }
  }
}
