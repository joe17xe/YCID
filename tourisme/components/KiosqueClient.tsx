'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import QRCode from 'qrcode'
import { useTranslations } from 'next-intl'
import { Phone, RotateCcw } from 'lucide-react'
import type { Locale } from '@/lib/types'
import { LOCALE_NAMES, LOCALES } from '@/lib/i18n-text'

const INACTIVITE_S = 120

function poserLangueEtRecharger(l: string) {
  document.cookie = `VA_LOCALE=${l}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
  window.location.reload()
}

export default function KiosqueClient({
  locale,
  langueDefaut,
  nomTerritoire,
  bienvenues,
  photo,
  parcoursDuJour,
  contactTel,
}: {
  locale: string
  langueDefaut: Locale
  nomTerritoire: string
  bienvenues: { ar: string; fr: string; en: string }
  photo: string
  parcoursDuJour: { slug: string; nom: string; meta: string }
  contactTel: string | null
}) {
  const t = useTranslations('kiosque')
  const [qr, setQr] = useState<string | null>(null)
  const [resteS, setResteS] = useState(INACTIVITE_S)
  const dernierGeste = useRef(0)

  // Le QR emmène la fiche du jour, dans la langue de l'écran
  useEffect(() => {
    const url = `${window.location.origin}/parcours/${parcoursDuJour.slug}?lang=${locale}`
    QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: '#1d2a21', light: '#ffffff' } })
      .then(setQr)
      .catch(() => {})
  }, [parcoursDuJour.slug, locale])

  // Toute interaction remet le compteur ; à zéro, retour à la langue
  // par défaut — la purge de session du pattern kiosque.
  useEffect(() => {
    dernierGeste.current = Date.now()
    const toucher = () => {
      dernierGeste.current = Date.now()
    }
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart', 'scroll']
    events.forEach((e) => window.addEventListener(e, toucher, { passive: true }))
    const timer = window.setInterval(() => {
      const ecoule = Math.floor((Date.now() - dernierGeste.current) / 1000)
      const reste = INACTIVITE_S - ecoule
      setResteS(reste > 0 ? reste : 0)
      if (reste <= 0) {
        dernierGeste.current = Date.now()
        poserLangueEtRecharger(langueDefaut)
      }
    }, 1000)
    return () => {
      events.forEach((e) => window.removeEventListener(e, toucher))
      window.clearInterval(timer)
    }
  }, [langueDefaut])

  return (
    <div data-kiosque className="fixed inset-0 flex flex-col bg-[var(--fond)] lg:flex-row">
      {/* Panneau vert : bienvenue + langues */}
      <section className="relative flex flex-1 flex-col justify-between overflow-hidden bg-[var(--pin-fort)] p-8 text-[#f6f4ea] lg:p-12">
        <Image src={photo} alt="" fill className="object-cover opacity-25" sizes="60vw" priority />
        <div className="relative">
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] opacity-85">
            {t('titre')} · {nomTerritoire}
          </p>
          <p lang="ar" dir="rtl" className="mt-8 text-[34px] font-bold leading-snug lg:text-[42px]">
            {bienvenues.ar}
          </p>
          <p lang="fr" className="titres mt-1 text-[32px] font-extrabold leading-tight lg:text-[40px]">
            {bienvenues.fr}
          </p>
          <p lang="en" className="mt-1 text-[22px] font-semibold opacity-90 lg:text-[26px]">
            {bienvenues.en}
          </p>
        </div>
        <div className="relative">
          <p className="mb-3 text-[14px] font-semibold opacity-85">{t('choisirLangue')}</p>
          <div className="flex gap-3">
            {LOCALES.map((l) => (
              <button
                key={l}
                lang={l}
                onClick={() => poserLangueEtRecharger(l)}
                className={
                  'min-h-[64px] flex-1 rounded-[var(--r-card)] px-4 text-[19px] font-bold transition-opacity active:opacity-80 ' +
                  (l === locale
                    ? 'bg-[#f6f4ea] text-[var(--pin-fort)]'
                    : 'border border-[#f6f4ea]/40 bg-[#f6f4ea]/12 text-[#f6f4ea]')
                }
              >
                {LOCALE_NAMES[l]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Colonne pratique : parcours du jour, QR, numéro */}
      <section className="flex w-full flex-col justify-center gap-4 p-6 lg:w-[440px] lg:p-8">
        <div className="card p-[var(--s4)]">
          <p className="eyebrow">{t('parcoursDuJour')}</p>
          <p className="mt-1 text-[19px] font-bold leading-snug">{parcoursDuJour.nom}</p>
          <p className="mono mt-1.5 text-[13px] text-[var(--encre-2)]">{parcoursDuJour.meta}</p>
        </div>
        <div className="card flex items-center gap-4 p-[var(--s4)]">
          <div className="grid h-[132px] w-[132px] shrink-0 place-items-center overflow-hidden rounded-[var(--r-media)] bg-white">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL générée localement
              <img src={qr} alt="QR code" width={124} height={124} />
            ) : null}
          </div>
          <div>
            <p className="text-[16px] font-bold leading-snug">{t('emportez')}</p>
            <p className="mt-1 text-[12.5px] leading-snug text-[var(--encre-2)]">{t('scannez')}</p>
          </div>
        </div>
        <div className="card flex items-center justify-between gap-3 p-[var(--s3)]">
          <p className="text-[13px] leading-snug text-[var(--encre-2)]">
            {contactTel ? t('renseignement') : t('renseignementSansTel')}
          </p>
          {contactTel ? (
            <p className="mono flex items-center gap-2 text-[16px] font-bold text-[var(--pin)]">
              <Phone size={17} aria-hidden /> <span dir="ltr">{contactTel}</span>
            </p>
          ) : null}
        </div>
        <p className="flex items-center justify-center gap-2 text-center text-[11.5px] text-[var(--encre-3)]">
          <RotateCcw size={13} aria-hidden />
          {t('inactivite', { secondes: resteS })}
        </p>
      </section>
    </div>
  )
}
