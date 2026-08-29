'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { notifyPeople, membersOfOrgs, programmeDirectors } from '@/lib/notify-circuit'
import { fmtEur, financialsFor, type DocLike } from '@/lib/budget'
import { rolesWith } from '@/lib/rbac'

// ============================================================
// 0069 — Versé par l'un, reçu par l'autre
// ============================================================
// Le droit est arbitré EN BASE (fonctions `security definer` de la
// 0069) : ces actions ne le recopient pas, elles appellent et
// rapportent. Une policy assez large pour laisser LEY écrire la date de
// réception la laisserait aussi réécrire le montant de la promesse —
// d'où le passage par des fonctions qui n'écrivent que ce qu'elles
// doivent.

function frDate(d: string): string {
  const [y, m, j] = d.split('-')
  return `${j}/${m}/${y}`
}

// ------------------------------------------------------------
// Côté payeur : le virement est parti
// ------------------------------------------------------------
export async function declareFundingPayment(input: {
  projectId: string; callId: string; paidOn: string; reference?: string
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }

  const { error } = await supabase.rpc('declare_funding_payment', {
    p_call_id: input.callId, p_paid_on: input.paidOn, p_ref: input.reference ?? null,
  })
  if (error) return { ok: false, error: error.message }

  const { data: call } = await supabase.from('funding_calls')
    .select('year, amount, payer_org_id, beneficiary_org_id')
    .eq('id', input.callId).eq('project_id', input.projectId).maybeSingle()
  if (!call) return { ok: true }

  const { data: orgs } = await supabase.from('organizations').select('id, name')
    .in('id', [call.payer_org_id, call.beneficiary_org_id].filter((x): x is string => !!x))
  const orgName = (oid: string | null) => (orgs ?? []).find(o => o.id === oid)?.name ?? 'une organisation'
  const { data: project } = await supabase.from('projects').select('name').eq('id', input.projectId).maybeSingle()

  await supabase.from('audit_log').insert({
    project_id: input.projectId, entity: 'funding_call', entity_id: input.callId,
    label: `${call.year} · ${orgName(call.payer_org_id)} · ${fmtEur(call.amount)} — virement émis le ${frDate(input.paidOn)}`,
    action: 'modifie', user_id: user.id,
    comment: input.reference?.trim() ? `Référence : ${input.reference.trim()}` : null,
  })

  // C'est au BÉNÉFICIAIRE que la nouvelle est utile : c'est lui qui doit
  // aller regarder son compte, puis confirmer. Sans ce message, il
  // attend sans savoir qu'il attend.
  const holder = call.beneficiary_org_id ?? call.payer_org_id
  const recipients = (await membersOfOrgs([holder])).filter(id => id !== user.id)
  if (recipients.length) {
    await notifyPeople(recipients, {
      type: 'funding_paid',
      title: `${orgName(call.payer_org_id)} a émis un virement de ${fmtEur(call.amount)}`,
      body: [
        `Projet : ${project?.name ?? 'projet'} (${call.year})`,
        `Virement émis le ${frDate(input.paidOn)}${input.reference?.trim() ? ` — référence ${input.reference.trim()}` : ''}.`,
        '',
        'Dès que la somme est créditée sur votre compte, confirmez la réception dans l’onglet Budget, section « Appels de fonds ». Joignez l’avis de virement : c’est ce qui rend la confirmation opposable.',
      ],
      path: `/projets/${input.projectId}?tab=budget`,
      linkLabel: 'Confirmer la réception',
    })
  }

  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}

// ------------------------------------------------------------
// Côté bénéficiaire : c'est arrivé
// ------------------------------------------------------------
// Et c'est ici que se joue le « cela doit déclencher une action » : rien
// d'automatique sur l'argent — aucun paiement ne se déclenche seul —
// mais une information adressée à ceux qui décaissent, avec la LISTE des
// lignes que cette enveloppe finance et ce qu'il reste à régler dessus.
export async function confirmFundingReceipt(input: {
  projectId: string; callId: string; receivedOn: string
}): Promise<{ ok: boolean; error?: string; onBehalf?: boolean; unlocked?: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }

  const { data: rpc, error } = await supabase.rpc('confirm_funding_receipt', {
    p_call_id: input.callId, p_received_on: input.receivedOn,
  })
  if (error) return { ok: false, error: error.message }
  const onBehalf = !!(rpc as { on_behalf?: boolean } | null)?.on_behalf

  const { data: call } = await supabase.from('funding_calls')
    .select('year, amount, payer_org_id, beneficiary_org_id')
    .eq('id', input.callId).eq('project_id', input.projectId).maybeSingle()
  if (!call) return { ok: true, onBehalf }

  const { data: orgs } = await supabase.from('organizations').select('id, name')
  const orgName = (oid: string | null) => (orgs ?? []).find(o => o.id === oid)?.name ?? 'une organisation'
  const { data: project } = await supabase.from('projects').select('name').eq('id', input.projectId).maybeSingle()
  const { data: me } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
  const holderName = orgName(call.beneficiary_org_id ?? call.payer_org_id)

  await supabase.from('audit_log').insert({
    project_id: input.projectId, entity: 'funding_call', entity_id: input.callId,
    label: `${call.year} · ${orgName(call.payer_org_id)} · ${fmtEur(call.amount)} — réception confirmée le ${frDate(input.receivedOn)}`,
    action: 'modifie', user_id: user.id,
    comment: onBehalf
      ? `Confirmée AU NOM DE « ${holderName} » (l'auteur n'est pas membre de cette organisation)`
      : `Confirmée par « ${holderName} »`,
  })

  // Les lignes que cette enveloppe finance — même clé que la
  // comparaison promesse ↔ budget de la 0066 : financeur + année, hors
  // valorisation. On lit leur reste à payer par les pièces déjà
  // déposées, avec le même calcul que l'écran Budget : une seconde
  // arithmétique du réalisé finirait par diverger de la première.
  const { data: lines } = await supabase.from('budget_lines')
    .select('id, poste, planned_amount, documents(id, type, amount, paid, validations(decision))')
    .eq('project_id', input.projectId)
    .eq('funder_org_id', call.payer_org_id)
    .eq('year', call.year)
    .eq('is_valorisation', false)
    .order('poste')

  const details = (lines ?? []).map(l => {
    const fin = financialsFor(Number(l.planned_amount) || 0, (l.documents ?? []) as DocLike[])
    return { poste: l.poste as string, planned: fin.planned, remaining: fin.remainingToPay }
  })
  const resteAPayer = details.reduce((s, d) => s + d.remaining, 0)

  // Ceux qui décaissent : les mains du budget, plus la direction du
  // programme. Le payeur est prévenu à part — c'est un accusé de
  // réception, pas une consigne de dépense.
  const { data: managers } = await supabase.from('project_members')
    .select('user_id, role').eq('project_id', input.projectId)
    // Ceux qui tiennent le budget, au sens de la matrice : la liste ne
    // se recopie pas ici, elle se demande (check:rbac).
    .in('role', rolesWith('budget.manage'))
  const directors = await programmeDirectors(input.projectId)
  const doers = [...new Set([...(managers ?? []).map(m => m.user_id as string), ...directors])]
    .filter(id => id !== user.id)

  if (doers.length) {
    await notifyPeople(doers, {
      type: 'funding_received',
      title: `${fmtEur(call.amount)} reçus de ${orgName(call.payer_org_id)} — ${details.length} ligne${details.length > 1 ? 's' : ''} finançable${details.length > 1 ? 's' : ''}`,
      body: [
        `Projet : ${project?.name ?? 'projet'} (${call.year})`,
        `${holderName} a confirmé la réception le ${frDate(input.receivedOn)}${onBehalf ? ` (saisie par ${me?.full_name ?? 'un administrateur'}, au nom de l'organisation)` : ''}.`,
        '',
        details.length
          ? `Ce que cette enveloppe finance au budget ${call.year} — reste à régler ${fmtEur(resteAPayer)} :`
          : `Aucune ligne budgétaire ${call.year} n'est rattachée à ce financeur : le versement est encaissé, mais rien ne dit encore ce qu'il finance.`,
        ...details.map(d => `· ${d.poste} — prévu ${fmtEur(d.planned)}, reste à régler ${fmtEur(d.remaining)}`),
        '',
        'Le règlement se constate pièce par pièce : déposez la facture sur sa ligne budgétaire, puis marquez-la payée.',
      ],
      path: `/projets/${input.projectId}?tab=budget`,
      linkLabel: 'Ouvrir le budget',
    })
  }

  // Accusé de réception au payeur : c'est ce qui clôt la boucle et rend
  // les relances inutiles.
  if (call.beneficiary_org_id) {
    const payers = (await membersOfOrgs([call.payer_org_id])).filter(id => id !== user.id)
    if (payers.length) {
      await notifyPeople(payers, {
        type: 'funding_received_ack',
        title: `${holderName} confirme avoir reçu vos ${fmtEur(call.amount)}`,
        body: [
          `Projet : ${project?.name ?? 'projet'} (${call.year})`,
          `Réception confirmée le ${frDate(input.receivedOn)}.`,
        ],
        path: `/projets/${input.projectId}?tab=budget`,
        linkLabel: 'Voir les appels de fonds',
      })
    }
  }

  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true, onBehalf, unlocked: details.length }
}

export async function revokeFundingReceipt(input: {
  projectId: string; callId: string
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }

  const { error } = await supabase.rpc('revoke_funding_receipt', { p_call_id: input.callId })
  if (error) return { ok: false, error: error.message }

  const { data: call } = await supabase.from('funding_calls')
    .select('year, amount, payer_org_id').eq('id', input.callId).eq('project_id', input.projectId).maybeSingle()
  const { data: org } = await supabase.from('organizations').select('name')
    .eq('id', call?.payer_org_id ?? '').maybeSingle()
  await supabase.from('audit_log').insert({
    project_id: input.projectId, entity: 'funding_call', entity_id: input.callId,
    label: `${call?.year ?? ''} · ${org?.name ?? 'organisation'} · ${fmtEur(call?.amount ?? 0)} — confirmation de réception RETIRÉE`,
    action: 'modifie', user_id: user.id,
  })
  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}
