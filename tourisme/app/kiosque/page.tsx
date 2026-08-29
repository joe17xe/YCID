import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { getParcours, getTerritoire } from '@/lib/content'
import { tx } from '@/lib/i18n-text'
import { formatDuree, formatKm } from '@/lib/geo'
import KiosqueClient from '@/components/KiosqueClient'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('kiosque')
  return { title: t('titre') }
}

// La même app, en grand, sur la tablette de la place du village :
// trois langues d'entrée, une seule sortie — le QR. Verrouiller la
// tablette sur cette URL (Fully Kiosk / Accès guidé), le reste suit.
export default async function PageKiosque() {
  const [territoire, parcours, locale, td] = await Promise.all([
    getTerritoire(),
    getParcours(),
    getLocale(),
    getTranslations('commun.difficulte'),
  ])
  const marchables = parcours.filter((p) => !p.acces_guide && p.statut === 'publie')
  // Rotation quotidienne volontaire : l'heure du serveur fait tourner le
  // parcours mis en avant — impureté assumée, page dynamique.
  // eslint-disable-next-line react-hooks/purity
  const jour = Math.floor(Date.now() / 86400000)
  const duJour = marchables[jour % Math.max(1, marchables.length)] ?? parcours[0]

  return (
    <KiosqueClient
      locale={locale}
      langueDefaut={territoire.langue_defaut}
      nomTerritoire={tx(territoire.nom, locale)}
      bienvenues={{
        ar: `أهلاً بكم في ${tx(territoire.nom, 'ar')}`,
        fr: `Bienvenue à ${tx(territoire.nom, 'fr')}`,
        en: `Welcome to ${tx(territoire.nom, 'en')}`,
      }}
      photo={territoire.photo_accueil ?? '/photos/panorama-crete.jpg'}
      parcoursDuJour={{
        slug: duJour.slug,
        nom: tx(duJour.nom, locale),
        meta: `${formatKm(duJour.distance_m, locale)}${
          duJour.denivele_pos_m != null ? ` · +${duJour.denivele_pos_m} m` : ''
        } · ${formatDuree(duJour.duree_min_minutes, duJour.duree_max_minutes, locale)} · ${td(duJour.difficulte)}`,
      }}
      contactTel={territoire.contact_tel ?? null}
    />
  )
}
