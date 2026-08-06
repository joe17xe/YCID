export const dynamic = 'force-dynamic'
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { getPlatformSettings, getRetentionPolicies, formatRetentionDays } from "@/lib/settings"
import { getAiConfigPublic, AI_PROVIDERS } from "@/lib/ai-settings"

// Page publique (accessible sans connexion).
// ⚠️ Gabarit à valider par YCID — ceci n'est pas un avis juridique.
// Le fournisseur IA est nommé dynamiquement : c'est un sous-traitant au
// sens du RGPD, il doit figurer dans la liste (rapport de test, point 21).
//
// RÈGLE DE CETTE PAGE, posée par la 0056 : elle ne décrit QUE ce que le
// code fait. Toute phrase qui décrivait un comportement inexistant a été
// retirée ou remplacée par ce qui existe réellement — parce que c'est la
// personne concernée qui lit cette page, et la CNIL qui la relira.
//
// Deux phrases sont tombées à ce titre :
//   · « Les données projets sont conservées pendant {legalRetention} » —
//     `legal_retention` est un texte libre saisi en administration ;
//     RIEN ne le lisait pour purger quoi que ce soit. Il est désormais
//     présenté pour ce qu'il est : l'engagement d'archivage d'YCID sur
//     les données qu'on ne purge PAS, à côté du tableau des durées que
//     la plateforme applique vraiment ;
//   · « puis désactivés ou supprimés » (à propos des comptes) — aucune
//     désactivation ni suppression automatique n'existe. La page dit
//     maintenant qui les fait, et sur quel geste.
export default async function ConfidentialitePage() {
  const [s, ai, retention] = await Promise.all([
    getPlatformSettings(), getAiConfigPublic(), getRetentionPolicies(),
  ])
  // `null` = migration 0056 non appliquée. La section n'annonce alors
  // AUCUNE durée : ne rien promettre est la seule chose vraie tant que
  // rien ne purge. C'est la règle du dépôt — soit on livre, soit on
  // retire la phrase — appliquée au repli et pas seulement au cas
  // nominal.
  const purgees = (retention ?? []).filter(r => r.enabled)
  const aiProvider = ai.hasKey
    ? (AI_PROVIDERS[ai.provider]?.label ?? "fournisseur compatible API OpenAI")
    : "aucun (fonctions IA désactivées)"
  const h2 = { fontFamily: "var(--font-sora)", color: "#17211D" }
  const p = { color: "#66716B" }
  return (
    <div className="min-h-screen py-10 px-4" style={{ background: "#F5F6F4" }}>
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-1 text-sm mb-6" style={{ color: "#66716B" }}>
          <ChevronLeft size={16} /> Retour à l&apos;accueil
        </Link>
        <div className="bg-white rounded-2xl border p-8 space-y-6" style={{ borderColor: "#E3E6E2" }}>
          <h1 className="text-2xl font-bold" style={h2}>Politique de confidentialité</h1>
          <p className="text-sm" style={p}>
            {s.brandName} traite des données personnelles dans le cadre du pilotage de
            projets de solidarité internationale soutenus par YCID. Cette page décrit
            quelles données sont traitées, pourquoi, et vos droits (RGPD).
          </p>

          <section className="space-y-2">
            <h2 className="font-semibold" style={h2}>Responsable de traitement</h2>
            <p className="text-sm" style={p}>
              {s.legalEntity}{s.legalAddress ? `, ${s.legalAddress}` : ''}.
              {s.legalEmail ? ` Contact : ${s.legalEmail}.` : ''}
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold" style={h2}>Données collectées</h2>
            <ul className="text-sm list-disc pl-5 space-y-1" style={p}>
              <li><strong>Compte utilisateur</strong> : nom, adresse email, photo de profil (facultative), rôle sur la plateforme.</li>
              <li><strong>Données projets</strong> : tâches, budgets, indicateurs, réunions, décisions, documents importés — saisis par les organisations partenaires.</li>
              <li><strong>Journal d&apos;activité</strong> : certaines actions sensibles (ex. modification d&apos;une tâche terminée) sont tracées à des fins d&apos;audit.</li>
              {/* Ajoutés par la 0056 : la section « Durée de
                  conservation » annonce des durées pour ces données ;
                  les taire ici ferait annoncer la conservation de
                  quelque chose dont on n'a jamais dit qu'on le
                  collectait. */}
              <li><strong>Notifications</strong> : les messages qui vous sont adressés dans l&apos;application, et la date à laquelle vous les avez ouverts.</li>
              <li><strong>Journal technique</strong> : les appels aux fonctions d&apos;intelligence artificielle et les imports de fichiers, avec le compte à l&apos;origine de l&apos;opération.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold" style={h2}>Finalités et base légale</h2>
            <p className="text-sm" style={p}>
              Les données sont traitées pour le suivi et le pilotage des projets
              financés (exécution de la relation entre YCID et les organisations
              partenaires, intérêt légitime de suivi des fonds publics). Elles ne sont
              ni vendues, ni utilisées à des fins publicitaires.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold" style={h2}>Intelligence artificielle</h2>
            <p className="text-sm" style={p}>
              Certaines fonctions (rapport d&apos;expertise, propositions de contenus de
              communication) transmettent des <strong>données de projet</strong> — phases,
              tâches, budgets, indicateurs, et le cas échéant des noms de personnes
              associées à ces tâches — au fournisseur d&apos;intelligence artificielle
              <strong> {aiProvider}</strong>, pour la seule durée du traitement de la
              requête. Ces données ne servent pas à entraîner de modèle.
            </p>
            <p className="text-sm" style={p}>
              Tout contenu ainsi produit est <strong>signalé comme généré par
              intelligence artificielle</strong> et soumis à une validation humaine avant
              publication. Aucune décision produisant des effets juridiques n&apos;est
              prise sur le seul fondement d&apos;un traitement automatisé.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold" style={h2}>Cookies</h2>
            <p className="text-sm" style={p}>
              La plateforme utilise uniquement des cookies <strong>strictement
              nécessaires</strong> : session d&apos;authentification et préférence de langue.
              Aucun cookie publicitaire ou de mesure d&apos;audience tierce — c&apos;est
              pourquoi aucun bandeau de consentement n&apos;est requis.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold" style={h2}>Durée de conservation</h2>
            <p className="text-sm" style={p}>
              Toutes les données ne suivent pas le même régime, et cette page les
              distingue parce que la plateforme les distingue.
            </p>

            {purgees.length > 0 && (
              <>
                <p className="text-sm" style={p}>
                  <strong>Ce qui est effacé au terme d&apos;une durée.</strong> Les données
                  ci-dessous n&apos;ont pas de raison d&apos;être conservées durablement.
                  Une purge, exécutée depuis l&apos;administration de la plateforme, les
                  supprime — ou en retire ce qui permet de vous identifier — une fois le
                  délai écoulé. Les durées affichées sont celles que la plateforme
                  applique, lues dans sa propre configuration :
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm table-cards tc-560">
                    <thead>
                      <tr className="text-left" style={{ color: "#66716B" }}>
                        <th className="py-2 pr-3 font-semibold">Données</th>
                        <th className="py-2 font-semibold">Conservées</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purgees.map(r => (
                        <tr key={r.category} className="border-t align-top" style={{ borderColor: "#E3E6E2" }}>
                          <td className="py-2 pr-3" data-primary>
                            <span style={{ color: "#17211D" }}>{r.label}</span>
                            <span className="block text-xs mt-0.5" style={p}>{r.description}</span>
                          </td>
                          <td className="py-2" data-label="Conservées" style={p}>
                            {formatRetentionDays(r.retentionDays)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <p className="text-sm" style={p}>
              <strong>Ce qui n&apos;est pas effacé automatiquement.</strong> Les données
              des projets — tâches, budgets, pièces justificatives, indicateurs, réunions,
              décisions — et le <strong>journal d&apos;audit</strong> ne font l&apos;objet
              d&apos;aucune purge programmée. Ils servent à justifier l&apos;emploi de fonds
              publics devant les financeurs (ministère de l&apos;Europe et des Affaires
              étrangères, Département des Yvelines), parfois plusieurs années après la
              clôture d&apos;un projet ; les effacer au bout d&apos;un délai détruirait la
              pièce que YCID doit pouvoir produire.
              {s.legalRetention
                ? <> YCID s&apos;engage à les archiver pendant <strong>{s.legalRetention}</strong> ; leur
                  suppression fait alors l&apos;objet d&apos;une décision, pas d&apos;une échéance
                  automatique.</>
                : <> Leur suppression fait l&apos;objet d&apos;une décision, pas d&apos;une
                  échéance automatique.</>}
            </p>

            <p className="text-sm" style={p}>
              <strong>Votre compte.</strong> Il est conservé pendant la durée de votre
              participation aux projets. Il n&apos;est ni désactivé ni supprimé
              automatiquement : c&apos;est un administrateur de la plateforme qui le fait,
              à la demande de votre organisation ou à la vôtre.
            </p>

            <p className="text-sm" style={p}>
              <strong>Vos sessions de connexion.</strong> Elles sont gérées par notre
              prestataire d&apos;authentification (Supabase), qui applique ses propres
              délais d&apos;expiration. Se déconnecter y met fin immédiatement.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold" style={h2}>Vos droits</h2>
            <p className="text-sm" style={p}>
              Conformément au RGPD, vous disposez de droits d&apos;accès, de rectification,
              d&apos;effacement, de limitation et d&apos;opposition.
            </p>
            <p className="text-sm" style={p}>
              <strong>Accès et portabilité (articles 15 et 20).</strong> Sur demande
              adressée à {s.legalEmail || "l'éditeur"}, la plateforme produit un fichier
              lisible par machine (format JSON) reprenant ce qu&apos;elle détient sur vous :
              profil, organisations et projets auxquels vous appartenez avec vos rôles,
              tâches qui vous sont assignées, pièces que vous avez déposées, décisions que
              vous avez rendues, et les entrées de journal qui vous concernent. Ce fichier
              est établi par un administrateur, après vérification de votre identité : il
              n&apos;est pas en libre-service, précisément parce qu&apos;il est relu avant
              remise pour ne pas transmettre au passage des informations concernant
              d&apos;autres personnes.
            </p>
            <p className="text-sm" style={p}>
              <strong>Rectification.</strong> Vous modifiez vous-même votre nom, votre
              photo et votre mot de passe dans vos Préférences. Pour le reste — rôles,
              appartenance à une organisation, effacement — adressez votre demande
              à {s.legalEmail || "l'éditeur"}.
            </p>
            <p className="text-sm" style={p}>
              En cas de difficulté, vous pouvez saisir la CNIL (cnil.fr).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold" style={h2}>Sous-traitants</h2>
            <p className="text-sm" style={p}>
              Hébergement applicatif : Hostinger International Ltd. Base de données et
              authentification : Supabase Inc. Génération de contenus par intelligence
              artificielle : {aiProvider}. Ces prestataires agissent comme sous-traitants
              au sens du RGPD.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
