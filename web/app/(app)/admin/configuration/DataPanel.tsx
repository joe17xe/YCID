"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Check, Eraser, FileDown, Search, Timer } from "lucide-react"
import {
  updateRetentionPolicy, runRetentionPurge, searchPeople, exportPersonData,
  type RetentionRow, type RetentionRun, type PersonHit,
} from "@/app/(app)/admin/configuration/settings-actions"
// Depuis `lib/retention.ts` et NON `lib/settings.ts` : ce dernier
// importe le client Supabase serveur, qui ne peut pas entrer dans un
// paquet client (voir l'en-tête de lib/retention.ts).
import { formatRetentionDays } from "@/lib/retention"

// ============================================================
// Données personnelles (0064) — conservation, purge, export RGPD
// ============================================================
// L'écran qui rend vraie la page /confidentialite. Deux blocs :
//
//   · la politique de conservation, avec le nombre de lignes que chaque
//     catégorie purgerait MAINTENANT. Ce chiffre est le cœur de l'écran :
//     une durée sans son effet se règle à l'aveugle, exactement comme le
//     circuit de validation avant la 0042 ;
//
// Ce que cet écran NE montre PAS, et il faut le dire : le détail par
// catégorie de chaque purge PASSÉE. Il vit dans `retention_runs.results`
// (jsonb) et ne se lit qu'au SQL Editor. Le tableau des dernières purges
// n'en donne que le total — assez pour répondre « la politique est-elle
// appliquée ? », qui est la question qu'on pose.
//   · l'export des données d'une personne, pour répondre à une demande
//     d'accès.

const border = { borderColor: "#E3E6E2" }
const inputCls = "px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"

// Au-delà de trente jours sans purge, l'écran RÉCLAME. C'est ce rappel
// qui empêche l'outillage de redevenir la promesse non tenue qu'il
// remplace : une purge manuelle qu'on n'exécute jamais ne vaut pas mieux
// qu'une durée affichée.
const RAPPEL_JOURS = 30

function joursDepuis(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

function dateFr(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })
}

export default function DataPanel({ rows, runs, lastRunAt }: {
  rows: RetentionRow[]; runs: RetentionRun[]; lastRunAt: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [done, setDone] = useState("")
  // Brouillon d'édition par catégorie : on ne réécrit pas `rows`, qui
  // vient du serveur et redeviendra la vérité au prochain refresh.
  const [draft, setDraft] = useState<Record<string, { days: string; enabled: boolean }>>(
    Object.fromEntries(rows.map(r => [r.category, { days: String(r.retentionDays), enabled: r.enabled }]))
  )

  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<PersonHit[] | null>(null)

  const enPeril = rows.filter(r => r.enabled).reduce((n, r) => n + r.affected, 0)
  const retard = lastRunAt ? joursDepuis(lastRunAt) : null

  function save(cat: string) {
    const d = draft[cat]
    if (!d) return
    setError(""); setDone("")
    startTransition(async () => {
      const res = await updateRetentionPolicy({
        category: cat, retentionDays: Number(d.days), enabled: d.enabled,
      })
      if (!res.ok) setError(res.error ?? "Enregistrement impossible.")
      else { setDone("Durée enregistrée — la page Politique de confidentialité est à jour."); router.refresh() }
    })
  }

  function apercu() {
    setError(""); setDone("")
    startTransition(async () => {
      const res = await runRetentionPurge(true)
      if (!res.ok) { setError(res.error ?? "Aperçu impossible."); return }
      const detail = (res.categories ?? []).filter(c => c.lignes > 0)
        .map(c => `${c.libelle} : ${c.lignes}`).join(" ; ")
      setDone(res.total
        ? `Aperçu — ${res.total} ligne(s) seraient traitées. ${detail}`
        : "Aperçu — rien à purger : aucune donnée n'a dépassé sa durée de conservation.")
    })
  }

  function purger() {
    // La confirmation nomme ce qui part ET ce qui reste : c'est la
    // seconde information qui manque toujours au moment où l'on clique.
    if (!window.confirm(
      `Purger définitivement les données ayant dépassé leur durée de conservation ?\n\n`
      + `${enPeril} ligne(s) sont concernées d'après l'aperçu.\n\n`
      + `Ne sont PAS concernés : les données projets, et le journal d'audit `
      + `tant que sa catégorie reste décochée.\n\n`
      + `Cette opération est irréversible.`
    )) return
    setError(""); setDone("")
    startTransition(async () => {
      const res = await runRetentionPurge(false)
      if (!res.ok) { setError(res.error ?? "Purge impossible."); return }
      setDone(res.total
        ? `Purge exécutée — ${res.total} ligne(s) traitées. La trace est au journal d'audit.`
        : "Purge exécutée — aucune ligne n'avait dépassé sa durée de conservation.")
      router.refresh()
    })
  }

  function chercher(e: React.FormEvent) {
    e.preventDefault()
    setError(""); setDone("")
    startTransition(async () => {
      const res = await searchPeople(query)
      if (!res.ok) { setError(res.error ?? "Recherche impossible."); return }
      setHits(res.people ?? [])
    })
  }

  function exporter(p: PersonHit) {
    setError(""); setDone("")
    startTransition(async () => {
      const res = await exportPersonData(p.id)
      if (!res.ok || !res.json) { setError(res.error ?? "Export impossible."); return }
      // Le fichier ne transite par aucun serveur de fichiers : il est
      // construit dans le navigateur à partir de la réponse et
      // téléchargé. Rien n'est déposé sur le stockage, où il faudrait
      // ensuite penser à l'effacer.
      const url = URL.createObjectURL(new Blob([res.json], { type: "application/json" }))
      const a = document.createElement("a")
      a.href = url; a.download = res.filename ?? "export.json"
      a.click()
      URL.revokeObjectURL(url)
      setDone(`Export de ${p.fullName} téléchargé. À RELIRE avant remise : il peut contenir des textes rédigés par des tiers.`)
    })
  }

  return (
    <div className="space-y-6">

      {/* ---------------------------------------------------------- */}
      {/* Conservation                                                */}
      {/* ---------------------------------------------------------- */}
      <section className="bg-white rounded-2xl border overflow-hidden" style={border}>
        <div className="px-4 py-3 border-b" style={border}>
          <h2 className="font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
            <Timer size={16} aria-hidden="true" /> Durées de conservation
          </h2>
          <p className="text-xs mt-1" style={{ color: "#66716B" }}>
            Ces durées sont publiées sur la page <strong>Politique de confidentialité</strong> et
            appliquées par la purge ci-dessous. Les données projets et le journal d&apos;audit
            n&apos;y figurent pas : ils sont conservés pour justifier l&apos;emploi des fonds publics.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm table-cards tc-760">
            <thead>
              <tr className="text-left" style={{ color: "#66716B" }}>
                <th className="px-4 py-2 font-semibold">Catégorie</th>
                <th className="px-4 py-2 font-semibold">Opération</th>
                <th className="px-4 py-2 font-semibold">Durée</th>
                <th className="px-4 py-2 font-semibold">Concernées</th>
                <th className="px-4 py-2 font-semibold">Appliquée</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const d = draft[r.category] ?? { days: String(r.retentionDays), enabled: r.enabled }
                const modifie = Number(d.days) !== r.retentionDays || d.enabled !== r.enabled
                return (
                  <tr key={r.category} className="border-t" style={border}>
                    <td className="px-4 py-3" data-primary>
                      <div className="font-medium" style={{ color: "#17211D" }}>{r.label}</div>
                      <div className="text-xs mt-0.5" style={{ color: "#66716B" }}>{r.description}</div>
                    </td>
                    <td className="px-4 py-3" data-label="Opération" style={{ color: "#66716B" }}>{r.operation}</td>
                    <td className="px-4 py-3" data-label="Durée">
                      <span className="inline-flex items-center gap-2">
                        <input type="number" min={30} max={7300} value={d.days} aria-label={`Durée en jours — ${r.label}`}
                          onChange={e => setDraft(s => ({ ...s, [r.category]: { ...d, days: e.target.value } }))}
                          className={`${inputCls} w-24`} style={border} />
                        <span className="text-xs" style={{ color: "#66716B" }}>
                          j — {formatRetentionDays(Number(d.days) || r.retentionDays)}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3" data-label="Concernées"
                      style={{ color: r.affected ? "#B4690E" : "#66716B" }}>
                      {r.affected}
                    </td>
                    <td className="px-4 py-3" data-label="Appliquée">
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={d.enabled}
                          onChange={e => setDraft(s => ({ ...s, [r.category]: { ...d, enabled: e.target.checked } }))} />
                        <span className="text-xs" style={{ color: "#66716B" }}>
                          {d.enabled ? "oui" : "non"}
                        </span>
                      </label>
                    </td>
                    <td className="px-4 py-3" data-label="">
                      <button type="button" onClick={() => save(r.category)} disabled={pending || !modifie}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold border"
                        style={{ ...border, color: modifie ? "var(--brand-accent,#0E6B5C)" : "#9AA4A0" }}>
                        Enregistrer
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Le journal d'audit est le seul réglage dont l'activation
            détruit une pièce justificative : il est signalé à part, et
            non noyé dans le tableau. */}
        {rows.some(r => r.category === "audit_log" && (draft["audit_log"]?.enabled ?? r.enabled)) && (
          <p className="text-sm px-4 py-3 flex items-start gap-2 border-t" style={{ ...border, background: "#F6E7E5", color: "#A3342C" }}>
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>
              La purge du <strong>journal d&apos;audit</strong> est activée. Ce journal justifie
              l&apos;emploi des fonds publics devant le MEAE et le Département, et il est la seule
              trace de ce qui a été supprimé. Sa purge est livrée désactivée : ne la laissez
              active que si cette conséquence a été arbitrée.
            </span>
          </p>
        )}
      </section>

      {/* ---------------------------------------------------------- */}
      {/* Purge                                                       */}
      {/* ---------------------------------------------------------- */}
      <section className="bg-white rounded-2xl border p-4 space-y-3" style={border}>
        <h2 className="font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
          <Eraser size={16} aria-hidden="true" /> Exécuter la purge
        </h2>
        <p className="text-xs" style={{ color: "#66716B" }}>
          L&apos;application n&apos;a pas d&apos;ordonnanceur : la purge se déclenche ici.
          Elle peut être planifiée toutes les nuits par <code>pg_cron</code> — la marche à
          suivre est écrite dans la migration <code>0064_retention_et_export_rgpd.sql</code>.
        </p>

        {/* Le rappel qui empêche l'outil de devenir une promesse de
            plus. Il ne se ferme pas : il disparaît quand la purge a été
            exécutée. */}
        {(retard === null || retard >= RAPPEL_JOURS) && (
          <p className="text-sm rounded-lg px-3 py-2 flex items-start gap-2" style={{ background: "#F7EDDD", color: "#B4690E" }}>
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>
              {retard === null
                ? "La purge n'a jamais été exécutée. Tant qu'elle ne l'est pas, les durées publiées sur la page Politique de confidentialité ne sont appliquées par personne."
                : `Dernière purge il y a ${retard} jours. Au-delà de ${RAPPEL_JOURS} jours, les durées publiées cessent de décrire ce que fait réellement la plateforme.`}
            </span>
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={apercu} disabled={pending}
            className="px-4 py-2 rounded-xl text-sm font-semibold border" style={{ ...border, color: "#17211D" }}>
            Aperçu — sans rien supprimer
          </button>
          <button type="button" onClick={purger} disabled={pending || !enPeril}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
            style={{ background: enPeril ? "#A3342C" : "#9AA4A0", opacity: pending ? 0.7 : 1 }}>
            <Eraser size={15} aria-hidden="true" /> Purger {enPeril ? `(${enPeril})` : ""}
          </button>
        </div>

        {runs.length > 0 && (
          <div className="overflow-x-auto pt-2">
            <table className="w-full text-sm table-cards tc-560">
              <thead>
                <tr className="text-left" style={{ color: "#66716B" }}>
                  <th className="px-2 py-2 font-semibold">Dernières purges</th>
                  <th className="px-2 py-2 font-semibold">Déclenchée par</th>
                  <th className="px-2 py-2 font-semibold">Lignes</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r, i) => (
                  <tr key={i} className="border-t" style={border}>
                    <td className="px-2 py-2" data-primary style={{ color: "#17211D" }}>{dateFr(r.at)}</td>
                    <td className="px-2 py-2" data-label="Déclenchée par" style={{ color: "#66716B" }}>
                      {r.source === "planifie" ? "Planification" : (r.byUser ?? "Administrateur")}
                    </td>
                    <td className="px-2 py-2" data-label="Lignes" style={{ color: "#66716B" }}>{r.totalAffected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------- */}
      {/* Export RGPD                                                 */}
      {/* ---------------------------------------------------------- */}
      <section className="bg-white rounded-2xl border p-4 space-y-3" style={border}>
        <h2 className="font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
          <FileDown size={16} aria-hidden="true" /> Exercice du droit d&apos;accès
        </h2>
        <p className="text-xs" style={{ color: "#66716B" }}>
          Produit un fichier JSON de ce que la plateforme détient sur une personne
          (RGPD, articles 15 et 20). Les données des autres personnes en sont écartées :
          aucune liste de membres, aucun compte rendu de réunion, et les libellés de
          journal désignant un tiers sont masqués. <strong>Relisez le fichier avant de le
          transmettre</strong> — certains textes ont été rédigés par des personnes et
          peuvent en nommer d&apos;autres. Chaque export est tracé au journal d&apos;audit.
        </p>

        <form onSubmit={chercher} className="flex flex-wrap gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Nom ou adresse email"
            aria-label="Rechercher une personne" className={`${inputCls} flex-1 min-w-[12rem]`} style={border} />
          <button type="submit" disabled={pending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
            style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending ? 0.7 : 1 }}>
            <Search size={15} aria-hidden="true" /> Chercher
          </button>
        </form>

        {hits !== null && (
          hits.length === 0
            ? <p className="text-sm" style={{ color: "#66716B" }}>Aucun compte ne correspond.</p>
            : (
              <ul className="divide-y" style={{ borderColor: "#E3E6E2" }}>
                {hits.map(p => (
                  <li key={p.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm">
                      <span style={{ color: "#17211D" }}>{p.fullName}</span>{" "}
                      <span style={{ color: "#66716B" }}>— {p.email}</span>
                    </span>
                    <button type="button" onClick={() => exporter(p)} disabled={pending}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border"
                      style={{ ...border, color: "var(--brand-accent,#0E6B5C)" }}>
                      <FileDown size={14} aria-hidden="true" /> Exporter
                    </button>
                  </li>
                ))}
              </ul>
            )
        )}
      </section>

      {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
      {done && (
        <p className="text-sm rounded-lg px-3 py-2 flex items-start gap-2"
          style={{ background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }}>
          <Check size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" /> <span>{done}</span>
        </p>
      )}
    </div>
  )
}
