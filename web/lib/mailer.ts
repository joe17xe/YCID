import nodemailer from 'nodemailer'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// ============================================================
// Envoi d'emails — configuration en base, jamais en dur
// ============================================================
// Serveur uniquement : ce module lit un mot de passe SMTP et ne doit
// JAMAIS être importé côté client.
//
// Principe directeur, hérité de notify.ts : l'envoi ne bloque jamais
// l'action métier. Un serveur SMTP injoignable ne doit pas empêcher de
// valider un devis. L'échec se trace, il ne remonte pas.
//
// Le corollaire, lui, a été appris à nos dépens : un échec silencieux
// n'est pas acceptable non plus. `email_settings.last_test_*` conserve
// donc le résultat du dernier essai, et l'écran d'administration
// l'affiche. Sans quoi un mot de passe changé ne se découvrirait que le
// jour où quelqu'un s'étonne de n'avoir rien reçu.

export interface EmailSettings {
  enabled: boolean
  host: string | null
  port: number
  secure: boolean
  username: string | null
  password: string | null
  from_name: string
  from_email: string | null
  site_url: string | null
}

function adminDb() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function getEmailSettings(): Promise<EmailSettings | null> {
  const db = adminDb()
  if (!db) return null
  const { data } = await db.from('email_settings')
    .select('enabled, host, port, secure, username, password, from_name, from_email, site_url')
    .eq('id', true).maybeSingle()
  return (data as EmailSettings | null) ?? null
}

// Une configuration incomplète vaut « pas configuré ». Tenter l'envoi
// sans serveur ni expéditeur ne produirait qu'une exception par message.
export function isUsable(s: EmailSettings | null): s is EmailSettings {
  return !!s && s.enabled && !!s.host && !!s.from_email
}

function transportFor(s: EmailSettings) {
  return nodemailer.createTransport({
    host: s.host!,
    port: s.port,
    secure: s.secure,
    // Un relais interne sans authentification est légitime : on
    // n'impose pas d'identifiants.
    auth: s.username ? { user: s.username, pass: s.password ?? '' } : undefined,
  })
}

export interface Mail {
  to: string
  subject: string
  // Texte d'abord : c'est ce que lit un client de messagerie dégradé, et
  // ce qui passe le mieux les filtres. Le HTML n'en est que la mise en
  // forme.
  text: string
  html?: string
}

// Retourne un message d'erreur, ou null si l'envoi a réussi. Ne lève
// jamais : l'appelant décide quoi faire du résultat, il n'a pas à s'en
// protéger.
export async function sendMail(mail: Mail): Promise<string | null> {
  try {
    const s = await getEmailSettings()
    if (!isUsable(s)) return 'Envoi désactivé ou incomplet — aucun email envoyé.'
    await transportFor(s).sendMail({
      from: `"${s.from_name}" <${s.from_email}>`,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    })
    return null
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[sendMail] échec:', msg)
    return msg
  }
}

// Vérifie la connexion SANS écrire à personne : `verify()` ouvre la
// session et s'authentifie, puis referme. C'est ce que doit faire le
// bouton « Tester » — envoyer un vrai message pour tester suppose de
// choisir un destinataire, donc d'écrire à quelqu'un pour rien.
export async function verifyEmailSettings(): Promise<string | null> {
  try {
    const s = await getEmailSettings()
    if (!s?.enabled) return 'Envoi désactivé.'
    if (!s.host) return 'Serveur SMTP non renseigné.'
    if (!s.from_email) return 'Adresse d’expéditeur non renseignée.'
    await transportFor(s).verify()
    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

// ------------------------------------------------------------
// Mise en forme
// ------------------------------------------------------------
const escape = (s: string) => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

// Gabarit unique : un titre, un corps, un lien. Assez pour tout ce que
// l'application a à dire, et une seule chose à corriger si l'affichage
// déraille dans un client de messagerie.
export function renderMail(title: string, body: string[], link?: { href: string; label: string }): { text: string; html: string } {
  const text = [title, '', ...body, link ? `\n${link.label} : ${link.href}` : ''].join('\n')
  const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#17211D;line-height:1.55;max-width:560px">
  <h2 style="font-size:17px;margin:0 0 14px">${escape(title)}</h2>
  ${body.map(p => `<p style="margin:0 0 10px;font-size:14px">${escape(p)}</p>`).join('')}
  ${link ? `<p style="margin:20px 0 0"><a href="${escape(link.href)}" style="background:#0E6B5C;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px;display:inline-block">${escape(link.label)}</a></p>` : ''}
  <p style="margin:24px 0 0;font-size:12px;color:#66716B">Message automatique de Solid'Pilot. Vous le recevez parce qu'une action vous attend sur un projet dont vous êtes membre.</p>
</div>`.trim()
  return { text, html }
}

// État du dernier essai, pour l'écran d'administration. Séparé de
// getEmailSettings() : celui-ci ramène un mot de passe et n'a rien à
// faire près d'un composant client.
export async function getEmailTestStatus(): Promise<{ last_test_at: string | null; last_test_ok: boolean | null; last_test_error: string | null } | null> {
  const db = adminDb()
  if (!db) return null
  const { data } = await db.from('email_settings')
    .select('last_test_at, last_test_ok, last_test_error').eq('id', true).maybeSingle()
  return data ?? null
}
