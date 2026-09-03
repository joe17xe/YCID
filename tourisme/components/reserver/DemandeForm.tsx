'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, ClipboardCopy, Mail, MessageCircle, Phone, Send } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { LOCALE_NAMES, LOCALES } from '@/lib/i18n-text'
import type { Locale } from '@/lib/types'

/* La demande part au kiosque — jamais ailleurs. Quand la base est là,
   elle s'inscrit au registre que les guides consultent ; quand elle ne
   l'est pas, elle emprunte le canal que le village a déjà : WhatsApp,
   l'e-mail, ou le téléphone. Dans tous les cas le visiteur repart avec
   le texte de sa demande, copiable. Rien ne se perd faute de serveur. */

/* « prete » : pas de registre derrière, la demande est rédigée et
   c'est au visiteur de choisir son canal. On ne prétend pas l'avoir
   reçue — on lui donne le texte et les moyens de l'envoyer. */
type Etat = 'saisie' | 'envoi' | 'envoyee' | 'prete' | 'erreur'

export default function DemandeForm({
  formuleId,
  formuleNom,
  territoireId,
  marque,
  tel,
  whatsapp,
  email,
  locale,
  aujourdhui,
  participantsDefaut,
}: {
  formuleId: string | null
  formuleNom: string
  territoireId: string | null
  marque: string
  tel: string | null
  whatsapp: string | null
  email: string | null
  locale: Locale
  /** Calculé côté serveur : « new Date() » au rendu casserait l'hydratation. */
  aujourdhui: string
  participantsDefaut: number
}) {
  const t = useTranslations('reserver')
  const [nom, setNom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [courriel, setCourriel] = useState('')
  const [date, setDate] = useState('')
  const [participants, setParticipants] = useState(String(participantsDefaut))
  const [langue, setLangue] = useState<Locale>(locale)
  const [message, setMessage] = useState('')
  const [etat, setEtat] = useState<Etat>('saisie')
  const [touche, setTouche] = useState(false)
  const [copie, setCopie] = useState(false)

  const nomVide = !nom.trim()
  const telVide = !telephone.trim()

  // Le récapitulatif : c'est lui qu'on envoie, qu'on copie, qu'on colle.
  const recap = [
    t('objet', { marque }),
    `${t('recapFormule')} : ${formuleNom}`,
    `${t('recapNom')} : ${nom.trim()}`,
    `${t('recapTel')} : ${telephone.trim()}`,
    date ? `${t('recapDate')} : ${date}` : null,
    participants ? `${t('recapPersonnes')} : ${participants}` : null,
    `${t('recapLangue')} : ${LOCALE_NAMES[langue]}`,
    message.trim() ? `${t('recapMessage')} : ${message.trim()}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const lienWhatsapp = whatsapp
    ? `https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(recap)}`
    : null
  const lienEmail = email
    ? `mailto:${email}?subject=${encodeURIComponent(t('objet', { marque }))}&body=${encodeURIComponent(recap)}`
    : null
  const lienTel = tel ? `tel:${tel.replace(/\s/g, '')}` : null

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    setTouche(true)
    if (nomVide || telVide) return
    const sb = supabaseBrowser()
    // Sans base, rien à enregistrer : on présente la demande rédigée et
    // ses canaux. Une navigation « tel: » automatique ne ferait rien du
    // tout sur un ordinateur — l'envoi paraîtrait avaler la demande.
    if (!sb || !territoireId) {
      setEtat('prete')
      return
    }
    setEtat('envoi')
    const { error } = await sb.from('demandes').insert({
      territoire_id: territoireId,
      formule_id: formuleId,
      formule_nom: formuleNom,
      nom: nom.trim(),
      telephone: telephone.trim(),
      email: courriel.trim() || null,
      date_souhaitee: date || null,
      participants: participants ? Number(participants) : null,
      langue,
      message: message.trim() || null,
    })
    setEtat(error ? 'erreur' : 'envoyee')
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(recap)
      setCopie(true)
    } catch {
      setCopie(false)
    }
  }

  /* Les canaux du village : proposés en secours après l'envoi, et en
     première ligne quand il n'y a pas de base derrière. */
  const canaux = (
    <div className="flex flex-wrap gap-[var(--s2)]">
      {lienWhatsapp ? (
        <a href={lienWhatsapp} target="_blank" rel="noopener" className="btn btn-surface btn-sm">
          <MessageCircle size={16} aria-hidden /> {t('parWhatsapp')}
        </a>
      ) : null}
      {lienEmail ? (
        <a href={lienEmail} className="btn btn-surface btn-sm">
          <Mail size={16} aria-hidden /> {t('parEmail')}
        </a>
      ) : null}
      {lienTel ? (
        <a href={lienTel} className="btn btn-surface btn-sm">
          <Phone size={16} aria-hidden /> {t('appelerKiosque')}
        </a>
      ) : null}
      <button type="button" onClick={copier} className="btn btn-surface btn-sm">
        {copie ? <Check size={16} aria-hidden /> : <ClipboardCopy size={16} aria-hidden />}
        {copie ? t('copie') : t('copier')}
      </button>
    </div>
  )

  if (etat === 'envoyee' || etat === 'prete') {
    const enregistree = etat === 'envoyee'
    return (
      <section className="card p-[var(--s4)]">
        <p className="flex items-center gap-2 text-[17px] font-bold text-[var(--pin)]">
          {enregistree ? <Check size={20} aria-hidden /> : <Send size={20} aria-hidden />}
          {t(enregistree ? 'envoyee' : 'prete')}
        </p>
        <p className="mt-1.5 text-[var(--t-small)] leading-relaxed text-[var(--encre-2)]">
          {t(enregistree ? 'envoyeeDetail' : 'preteDetail')}
        </p>
        <pre className="mono mt-[var(--s3)] whitespace-pre-wrap rounded-[var(--r-media)] bg-[var(--surface-2)] p-[var(--s3)] text-[12.5px] leading-relaxed text-[var(--encre-2)]">
          {recap}
        </pre>
        <div className="mt-[var(--s3)]">{canaux}</div>
      </section>
    )
  }

  return (
    <form noValidate onSubmit={envoyer} className="card space-y-[var(--s3)] p-[var(--s4)]">
      <h2 className="t-h3">{t('formTitre')}</h2>

      <div className="grid gap-[var(--s3)] sm:grid-cols-2">
        <div>
          <label className="champ-label" htmlFor="d-nom">
            {t('nom')}
          </label>
          <input
            id="d-nom"
            className="champ"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            autoComplete="name"
            required
            aria-invalid={touche && nomVide}
            aria-describedby={touche && nomVide ? 'd-nom-err' : undefined}
          />
          {touche && nomVide ? (
            <p id="d-nom-err" role="alert" className="champ-erreur">
              {t('champRequis')}
            </p>
          ) : null}
        </div>
        <div>
          <label className="champ-label" htmlFor="d-tel">
            {t('telephone')}
          </label>
          <input
            id="d-tel"
            type="tel"
            dir="ltr"
            className="champ mono"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            autoComplete="tel"
            inputMode="tel"
            required
            aria-invalid={touche && telVide}
            aria-describedby={touche && telVide ? 'd-tel-err' : undefined}
          />
          {touche && telVide ? (
            <p id="d-tel-err" role="alert" className="champ-erreur">
              {t('champRequis')}
            </p>
          ) : null}
        </div>
        <div>
          <label className="champ-label" htmlFor="d-date">
            {t('date')}
          </label>
          <input
            id="d-date"
            type="date"
            className="champ"
            value={date}
            min={aujourdhui}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="champ-label" htmlFor="d-nb">
            {t('combien')}
          </label>
          <input
            id="d-nb"
            type="number"
            className="champ mono"
            value={participants}
            min={1}
            max={200}
            inputMode="numeric"
            onChange={(e) => setParticipants(e.target.value)}
          />
        </div>
        <div>
          <label className="champ-label" htmlFor="d-langue">
            {t('langue')}
          </label>
          <select
            id="d-langue"
            className="champ"
            value={langue}
            onChange={(e) => setLangue(e.target.value as Locale)}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {LOCALE_NAMES[l]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="champ-label" htmlFor="d-email">
            {t('email')}
          </label>
          <input
            id="d-email"
            type="email"
            dir="ltr"
            className="champ"
            value={courriel}
            onChange={(e) => setCourriel(e.target.value)}
            autoComplete="email"
          />
        </div>
      </div>

      <div>
        <label className="champ-label" htmlFor="d-msg">
          {t('message')}
        </label>
        <textarea
          id="d-msg"
          className="champ"
          value={message}
          maxLength={2000}
          placeholder={t('messagePlaceholder')}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      {etat === 'erreur' ? (
        <div
          role="alert"
          className="rounded-e-[var(--r-media)] border-s-[3px] border-[var(--danger)] bg-[var(--danger-pale)] px-[var(--s3)] py-[var(--s2)] text-[var(--t-small)] leading-relaxed"
        >
          <p>{t('erreur')}</p>
          <pre className="mono mt-[var(--s2)] whitespace-pre-wrap text-[12.5px] leading-relaxed">
            {recap}
          </pre>
        </div>
      ) : null}

      <button type="submit" className="btn btn-pin w-full" disabled={etat === 'envoi'}>
        <Send size={18} aria-hidden />
        {etat === 'envoi' ? t('envoiEnCours') : t('envoyer')}
      </button>

      {canaux}

      <p className="text-[var(--t-micro)] leading-relaxed text-[var(--encre-3)]">{t('note')}</p>
    </form>
  )
}
