'use client'
import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { gpx as gpxToGeoJson } from '@tmcw/togeojson'
import { CircleCheck, LoaderCircle, LogOut, Upload } from 'lucide-react'
import { parseCoordonnees, supabaseBrowser } from '@/lib/supabase-browser'
import type { I18nText } from '@/lib/types'
import { tx } from '@/lib/i18n-text'

/* Le back-office léger : le numéro du kiosque, l'état d'accès, les
   statuts, les coordonnées et les traces — tout ce qui fait vivre la
   carte sans toucher au code. RLS au pouvoir : seuls les éditeurs du
   territoire (table territoire_editeurs) peuvent écrire. */

type TerritoireRow = {
  id: string
  slug: string
  marque: string | null
  contact_tel: string | null
  contact_whatsapp: string | null
  contact_email: string | null
  etat_acces: { niveau: string; message: I18nText; date: string } | null
}
type ParcoursRow = {
  id: string
  slug: string
  nom: I18nText
  statut: string
  trace_statut: string
  distance_m: number | null
  denivele_pos_m: number | null
  denivele_neg_m: number | null
  version: number
  a_une_trace: boolean
  trace_longueur_m: number | null
}
type PoiRow = {
  id: string
  slug: string
  nom: I18nText
  type: string
  panneau_no: number | null
  statut: string
  lon: number
  lat: number
}

export default function AdminClient({ territoireSlug }: { territoireSlug: string }) {
  const sb = supabaseBrowser()
  const [session, setSession] = useState<Session | null>(null)
  const [pret, setPret] = useState(false)
  const [email, setEmail] = useState('')
  const [info, setInfo] = useState<string | null>(null)
  const [territoire, setTerritoire] = useState<TerritoireRow | null>(null)
  const [parcours, setParcours] = useState<ParcoursRow[]>([])
  const [pois, setPois] = useState<PoiRow[]>([])

  useEffect(() => {
    if (!sb) return
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setPret(true)
    })
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [sb])

  const charger = useCallback(async () => {
    if (!sb) return
    const { data: t } = await sb
      .from('territoires')
      .select('id, slug, marque, contact_tel, contact_whatsapp, contact_email, etat_acces')
      .eq('slug', territoireSlug)
      .single()
    if (t) {
      const terr = t as TerritoireRow
      setTerritoire(terr)
      const [{ data: ps }, { data: os }] = await Promise.all([
        sb.from('admin_parcours').select('*').eq('territoire_id', terr.id).order('slug'),
        sb.from('admin_pois').select('*').eq('territoire_id', terr.id).order('ordre'),
      ])
      setParcours((ps ?? []) as ParcoursRow[])
      setPois((os ?? []) as PoiRow[])
    }
  }, [sb, territoireSlug])

  useEffect(() => {
    if (!session) return
    queueMicrotask(() => {
      void charger()
    })
  }, [session, charger])

  if (!sb) return null

  if (!pret)
    return (
      <main className="grid min-h-screen place-items-center">
        <LoaderCircle className="animate-spin text-[var(--encre-3)]" aria-label="Chargement" />
      </main>
    )

  if (!session)
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-[24px] font-extrabold">Administration</h1>
        <p className="mt-2 text-[14px] text-[var(--encre-2)]">
          Recevez un lien de connexion par e-mail. L&rsquo;accès en écriture est réservé aux
          éditeurs du territoire.
        </p>
        <form
          className="mt-5 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            const { error } = await sb.auth.signInWithOtp({
              email,
              options: { emailRedirectTo: window.location.href },
            })
            setInfo(error ? `Erreur : ${error.message}` : 'Lien envoyé — vérifiez votre boîte mail.')
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.org"
            className="w-full rounded-xl border border-[var(--ligne)] bg-[var(--surface)] px-4 py-3"
          />
          <button type="submit" className="btn btn-pin w-full">Recevoir le lien</button>
        </form>
        {info ? <p className="mt-3 text-[13.5px] text-[var(--encre-2)]">{info}</p> : null}
      </main>
    )

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-extrabold">Administration</h1>
          <p className="text-[13px] text-[var(--encre-2)]">{session.user.email} · territoire « {territoireSlug} »</p>
        </div>
        <button onClick={() => sb.auth.signOut()} className="btn btn-surface !min-h-[40px] !py-2 text-[13px]">
          <LogOut size={15} aria-hidden /> Quitter
        </button>
      </header>
      {info ? (
        <p className="rounded-xl bg-[var(--vert-pale)] px-4 py-2.5 text-[13.5px] font-semibold text-[var(--pin)]">{info}</p>
      ) : null}

      {territoire ? (
        <SectionTerritoire territoire={territoire} onSaved={(m) => { setInfo(m); charger() }} />
      ) : (
        <p className="text-[14px] text-[var(--encre-2)]">
          Territoire illisible — votre compte n&rsquo;est probablement pas encore éditeur
          (table <code className="mono">territoire_editeurs</code>, voir le guide de déploiement).
        </p>
      )}
      {territoire ? <SectionParcours parcours={parcours} onSaved={(m) => { setInfo(m); charger() }} /> : null}
      {territoire ? <SectionPois pois={pois} onSaved={(m) => { setInfo(m); charger() }} /> : null}
    </main>
  )
}

/* ————— Territoire : numéro du kiosque, contacts, état d'accès ————— */
function SectionTerritoire({ territoire, onSaved }: { territoire: TerritoireRow; onSaved: (m: string) => void }) {
  const sb = supabaseBrowser()!
  const [form, setForm] = useState({
    marque: territoire.marque ?? '',
    contact_tel: territoire.contact_tel ?? '',
    contact_whatsapp: territoire.contact_whatsapp ?? '',
    contact_email: territoire.contact_email ?? '',
    niveau: territoire.etat_acces?.niveau ?? 'ouvert',
    msg_fr: territoire.etat_acces?.message?.fr ?? '',
    msg_ar: territoire.etat_acces?.message?.ar ?? '',
    msg_en: territoire.etat_acces?.message?.en ?? '',
  })
  const champ = (k: keyof typeof form, label: string, dir?: 'rtl') => (
    <label className="block text-[13px] font-semibold">
      {label}
      <input
        dir={dir}
        value={form[k]}
        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
        className="mt-1 w-full rounded-xl border border-[var(--ligne)] bg-[var(--surface)] px-3 py-2.5 font-normal"
      />
    </label>
  )
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-[17px] font-bold">Territoire</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {champ('marque', 'Marque (nom affiché)')}
        {champ('contact_tel', 'Numéro d’information (kiosque)')}
        {champ('contact_whatsapp', 'WhatsApp')}
        {champ('contact_email', 'E-mail')}
      </div>
      <h3 className="pt-1 text-[14px] font-bold">Bandeau « état d’accès » (daté du jour à l’enregistrement)</h3>
      <label className="block text-[13px] font-semibold">
        Niveau
        <select
          value={form.niveau}
          onChange={(e) => setForm({ ...form, niveau: e.target.value })}
          className="mt-1 w-full rounded-xl border border-[var(--ligne)] bg-[var(--surface)] px-3 py-2.5 font-normal"
        >
          <option value="ouvert">Sentiers ouverts</option>
          <option value="prudence">Prudence</option>
          <option value="ferme">Accès fermé</option>
        </select>
      </label>
      {champ('msg_fr', 'Message (français)')}
      {champ('msg_ar', 'Message (arabe)', 'rtl')}
      {champ('msg_en', 'Message (anglais)')}
      <button
        className="btn btn-pin"
        onClick={async () => {
          const { error } = await sb
            .from('territoires')
            .update({
              marque: form.marque || null,
              contact_tel: form.contact_tel || null,
              contact_whatsapp: form.contact_whatsapp || null,
              contact_email: form.contact_email || null,
              etat_acces: {
                niveau: form.niveau,
                message: { fr: form.msg_fr, ar: form.msg_ar, en: form.msg_en },
                date: new Date().toISOString().slice(0, 10),
              },
            })
            .eq('id', territoire.id)
          onSaved(error ? `Erreur : ${error.message}` : 'Territoire enregistré.')
        }}
      >
        <CircleCheck size={17} aria-hidden /> Enregistrer le territoire
      </button>
    </section>
  )
}

/* ————— Parcours : statuts, chiffres officiels, import GPX ————— */
function SectionParcours({ parcours, onSaved }: { parcours: ParcoursRow[]; onSaved: (m: string) => void }) {
  const sb = supabaseBrowser()!
  return (
    <section className="space-y-3">
      <h2 className="text-[17px] font-bold">Parcours</h2>
      {parcours.map((p) => (
        <LigneParcours key={p.id} p={p} sb={sb} onSaved={onSaved} />
      ))}
    </section>
  )
}

function LigneParcours({
  p,
  sb,
  onSaved,
}: {
  p: ParcoursRow
  sb: NonNullable<ReturnType<typeof supabaseBrowser>>
  onSaved: (m: string) => void
}) {
  const [statut, setStatut] = useState(p.statut)
  const [traceStatut, setTraceStatut] = useState(p.trace_statut)
  const [dist, setDist] = useState(p.distance_m?.toString() ?? '')
  const [dPos, setDPos] = useState(p.denivele_pos_m?.toString() ?? '')
  const [dNeg, setDNeg] = useState(p.denivele_neg_m?.toString() ?? '')
  const [gpxInfo, setGpxInfo] = useState<string | null>(null)

  const importerGpx = async (file: File) => {
    try {
      const xml = new DOMParser().parseFromString(await file.text(), 'text/xml')
      const fc = gpxToGeoJson(xml)
      const coords: [number, number][] = []
      for (const f of fc.features) {
        const g = f.geometry
        if (g?.type === 'LineString') {
          for (const c of g.coordinates) coords.push([c[0], c[1]])
        } else if (g?.type === 'MultiLineString') {
          for (const seg of g.coordinates) for (const c of seg) coords.push([c[0], c[1]])
        }
      }
      if (coords.length < 2) {
        setGpxInfo('Aucune trace lisible dans ce fichier.')
        return
      }
      const { error } = await sb.rpc('admin_set_trace', {
        p_id: p.id,
        p_geojson: { type: 'LineString', coordinates: coords },
        p_statut: traceStatut,
      })
      setGpxInfo(
        error
          ? `Erreur : ${error.message}`
          : `Trace importée (${coords.length} points). Vérifiez la carte avant de publier.`,
      )
      if (!error) onSaved(`Trace de « ${tx(p.nom, 'fr')} » remplacée — le pack hors-ligne se re-téléchargera.`)
    } catch {
      setGpxInfo('Fichier illisible — exportez un GPX ou un KML converti en GPX.')
    }
  }

  return (
    <div className="card space-y-2.5 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[15px] font-bold">{tx(p.nom, 'fr')}</p>
        <p className="mono text-[11.5px] text-[var(--encre-3)]">
          v{p.version}
          {p.a_une_trace && p.trace_longueur_m != null ? ` · trace ${(p.trace_longueur_m / 1000).toFixed(1)} km` : ' · sans trace'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <label className="text-[12px] font-semibold">
          Statut
          <select value={statut} onChange={(e) => setStatut(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--ligne)] bg-[var(--surface)] px-2 py-2 font-normal">
            <option value="brouillon">Brouillon</option>
            <option value="publie">Publié</option>
            <option value="ferme">Fermé temporairement</option>
          </select>
        </label>
        <label className="text-[12px] font-semibold">
          Trace
          <select value={traceStatut} onChange={(e) => setTraceStatut(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--ligne)] bg-[var(--surface)] px-2 py-2 font-normal">
            <option value="provisoire">Provisoire</option>
            <option value="verifie">Vérifiée terrain</option>
          </select>
        </label>
        <label className="text-[12px] font-semibold">
          Distance (m)
          <input inputMode="numeric" value={dist} onChange={(e) => setDist(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--ligne)] bg-[var(--surface)] px-2 py-2 font-normal" />
        </label>
        <label className="text-[12px] font-semibold">
          D+ (m)
          <input inputMode="numeric" value={dPos} onChange={(e) => setDPos(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--ligne)] bg-[var(--surface)] px-2 py-2 font-normal" />
        </label>
        <label className="text-[12px] font-semibold">
          D− (m)
          <input inputMode="numeric" value={dNeg} onChange={(e) => setDNeg(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--ligne)] bg-[var(--surface)] px-2 py-2 font-normal" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          className="btn btn-pin !min-h-[40px] !py-2 text-[13px]"
          onClick={async () => {
            const { error } = await sb
              .from('parcours')
              .update({
                statut,
                trace_statut: traceStatut,
                distance_m: dist ? Number(dist) : null,
                denivele_pos_m: dPos ? Number(dPos) : null,
                denivele_neg_m: dNeg ? Number(dNeg) : null,
              })
              .eq('id', p.id)
            onSaved(error ? `Erreur : ${error.message}` : `« ${tx(p.nom, 'fr')} » enregistré.`)
          }}
        >
          <CircleCheck size={15} aria-hidden /> Enregistrer
        </button>
        <label className="btn btn-surface !min-h-[40px] cursor-pointer !py-2 text-[13px]">
          <Upload size={15} aria-hidden /> Importer un GPX
          <input
            type="file"
            accept=".gpx,application/gpx+xml"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && importerGpx(e.target.files[0])}
          />
        </label>
        {gpxInfo ? <span className="text-[12.5px] text-[var(--encre-2)]">{gpxInfo}</span> : null}
      </div>
    </div>
  )
}

/* ————— POI : coordonnées collées, n° de panneau, statut ————— */
function SectionPois({ pois, onSaved }: { pois: PoiRow[]; onSaved: (m: string) => void }) {
  const sb = supabaseBrowser()!
  return (
    <section className="space-y-3">
      <h2 className="text-[17px] font-bold">Points d’intérêt</h2>
      <p className="text-[12.5px] text-[var(--encre-2)]">
        Coordonnées au format Google Maps (« 33.5342, 35.5648 ») — l’ordre est détecté, et tout
        point hors du Liban est refusé.
      </p>
      {pois.map((o) => (
        <LignePoi key={o.id} o={o} sb={sb} onSaved={onSaved} />
      ))}
    </section>
  )
}

function LignePoi({
  o,
  sb,
  onSaved,
}: {
  o: PoiRow
  sb: NonNullable<ReturnType<typeof supabaseBrowser>>
  onSaved: (m: string) => void
}) {
  const [coords, setCoords] = useState(`${o.lat.toFixed(5)}, ${o.lon.toFixed(5)}`)
  const [panneau, setPanneau] = useState(o.panneau_no?.toString() ?? '')
  const [statut, setStatut] = useState(o.statut)
  const [err, setErr] = useState<string | null>(null)
  return (
    <div className="card flex flex-wrap items-end gap-2.5 p-3.5">
      <p className="w-full text-[14px] font-bold sm:w-auto sm:flex-1">
        {tx(o.nom, 'fr')} <span className="mono text-[11px] font-normal text-[var(--encre-3)]">({o.type})</span>
      </p>
      <label className="text-[12px] font-semibold">
        lat, lng
        <input value={coords} onChange={(e) => setCoords(e.target.value)} className="mono mt-1 w-44 rounded-lg border border-[var(--ligne)] bg-[var(--surface)] px-2 py-2 font-normal" />
      </label>
      <label className="text-[12px] font-semibold">
        Panneau
        <input inputMode="numeric" value={panneau} onChange={(e) => setPanneau(e.target.value)} className="mt-1 w-20 rounded-lg border border-[var(--ligne)] bg-[var(--surface)] px-2 py-2 font-normal" />
      </label>
      <label className="text-[12px] font-semibold">
        Statut
        <select value={statut} onChange={(e) => setStatut(e.target.value)} className="mt-1 rounded-lg border border-[var(--ligne)] bg-[var(--surface)] px-2 py-2 font-normal">
          <option value="brouillon">Brouillon</option>
          <option value="publie">Publié</option>
        </select>
      </label>
      <button
        className="btn btn-pin !min-h-[40px] !py-2 text-[13px]"
        onClick={async () => {
          const c = parseCoordonnees(coords)
          if (!c) {
            setErr('Coordonnées invalides ou hors du Liban.')
            return
          }
          setErr(null)
          const [r1, r2] = await Promise.all([
            sb.rpc('admin_set_poi_geom', { p_id: o.id, p_lon: c.lon, p_lat: c.lat }),
            sb.from('pois').update({ panneau_no: panneau ? Number(panneau) : null, statut }).eq('id', o.id),
          ])
          const error = r1.error ?? r2.error
          onSaved(error ? `Erreur : ${error.message}` : `« ${tx(o.nom, 'fr')} » enregistré.`)
        }}
      >
        <CircleCheck size={15} aria-hidden /> OK
      </button>
      {err ? <span className="w-full text-[12.5px] font-semibold text-[var(--danger)]">{err}</span> : null}
    </div>
  )
}
