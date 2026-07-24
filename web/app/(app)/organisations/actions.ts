'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canManageOrgChannels } from '@/lib/permissions'
import type { MediaChannelKind, MediaChannelLanguage } from '@/lib/types'
import { MEDIA_CHANNEL_KINDS, MEDIA_CHANNEL_LANGUAGES } from '@/lib/constants'

type ActionResult = { ok: boolean; error?: string }

export interface MediaChannelInput {
  kind: MediaChannelKind
  name: string
  url?: string
  language: MediaChannelLanguage
  tone?: string
  audience?: string
  signature?: string
  active?: boolean
}

function validateChannel(input: MediaChannelInput): string | null {
  if (!MEDIA_CHANNEL_KINDS[input.kind]) return 'Type de canal invalide.'
  if (!(input.name ?? '').trim()) return 'Le nom du canal est obligatoire.'
  if (!MEDIA_CHANNEL_LANGUAGES[input.language]) return 'Langue invalide.'
  const url = (input.url ?? '').trim()
  if (url && !/^https?:\/\/.+/.test(url)) return "L'URL doit commencer par http:// ou https://."
  return null
}

function channelRow(input: MediaChannelInput) {
  return {
    kind: input.kind,
    name: input.name.trim(),
    url: (input.url ?? '').trim() || null,
    language: input.language,
    tone: (input.tone ?? '').trim(),
    audience: (input.audience ?? '').trim(),
    signature: (input.signature ?? '').trim(),
    active: input.active ?? true,
  }
}

export async function createMediaChannel(orgId: string, input: MediaChannelInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }

  const allowed = await canManageOrgChannels(supabase, user.id, orgId)
  if (!allowed) return { ok: false, error: "Action réservée aux administrateurs de l'organisation." }

  const invalid = validateChannel(input)
  if (invalid) return { ok: false, error: invalid }

  const { error } = await supabase.from('org_media_channels').insert({ org_id: orgId, ...channelRow(input) })
  if (error) return { ok: false, error: `Échec de la création : ${error.message}` }

  revalidatePath('/organisations')
  return { ok: true }
}

export async function updateMediaChannel(channelId: string, input: MediaChannelInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }

  const { data: channel } = await supabase
    .from('org_media_channels').select('org_id').eq('id', channelId).maybeSingle()
  if (!channel) return { ok: false, error: 'Canal introuvable.' }

  const allowed = await canManageOrgChannels(supabase, user.id, String(channel.org_id))
  if (!allowed) return { ok: false, error: "Action réservée aux administrateurs de l'organisation." }

  const invalid = validateChannel(input)
  if (invalid) return { ok: false, error: invalid }

  const { error } = await supabase.from('org_media_channels').update(channelRow(input)).eq('id', channelId)
  if (error) return { ok: false, error: `Échec de la modification : ${error.message}` }

  revalidatePath('/organisations')
  return { ok: true }
}

export async function deleteMediaChannel(channelId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }

  const { data: channel } = await supabase
    .from('org_media_channels').select('org_id').eq('id', channelId).maybeSingle()
  if (!channel) return { ok: false, error: 'Canal introuvable.' }

  const allowed = await canManageOrgChannels(supabase, user.id, String(channel.org_id))
  if (!allowed) return { ok: false, error: "Action réservée aux administrateurs de l'organisation." }

  const { error } = await supabase.from('org_media_channels').delete().eq('id', channelId)
  if (error) return { ok: false, error: `Échec de la suppression : ${error.message}` }

  revalidatePath('/organisations')
  return { ok: true }
}
