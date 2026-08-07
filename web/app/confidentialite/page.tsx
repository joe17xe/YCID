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
  // Destination des données confiées au modèle (RGPD art. 13.1.f). Lue
  // dans AI_PROVIDERS, la même table que celle qui s'affiche sous la
  // liste déroulante d'Admin ▸ Configuration ▸ IA : l'administrateur qui
  // CHOISIT et la personne qui LIT voient la même phrase, faute de quoi
  // le choix pourrait changer sans que cette page bouge.
  //
  // Repli sur « autre » quand le fournisseur n'est pas dans la table —
  // configuration par les variables LLM_* du serveur, où `provider` vaut
  // « autre » : sa fiche dit précisément que la destination dépend de
  // l'URL saisie et que l'application ne peut pas la qualifier. C'est le
  // seul repli honnête ; en inventer un rendrait cette page fausse
  // exactement dans le cas où elle est le moins vérifiable.
  const aiFiche = AI_PROVIDERS[ai.provider] ?? AI_PROVIDERS.autre
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
              tâches, budgets, indicateurs, réunions, décisions — au fournisseur
              d&apos;intelligence artificielle <strong>{aiProvider}</strong>, pour la
              seule durée du traitement de la requête.
            </p>
            {/* Ce paragraphe remplace « et le cas échéant des noms de
                personnes associées à ces tâches ». La phrase décrivait
                une requête qui demandait bien `assignee_id` — mais ne
                s'en servait nulle part : la page annonçait donc un
                transfert qui n'avait pas lieu, tout en laissant croire
                que le sujet avait été traité. La colonne est retirée de
                la requête, et `scripts/check-anonymat-digest.mjs` fait
                échouer la vérification si une colonne de personne y
                revient. La phrase ci-dessous ne tient que par ce
                contrôle : c'est lui qui la rend vraie demain.

                Le texte libre est dit dans le même souffle, et pas dans
                une note de bas de page : c'est là que se trouve le
                risque réel, et le taire aurait fait de la première
                moitié du paragraphe une demi-vérité — la forme d'erreur
                que cette page s'interdit. */}
            <p className="text-sm" style={p}>
              <strong>Aucun champ vous identifiant n&apos;est transmis</strong> : ni nom,
              ni adresse électronique, ni identifiant de compte, ni liste des personnes
              présentes à une réunion. Les seuls noms transmis sont ceux des
              <strong> organisations</strong> partenaires, financeurs et contributrices.
              En revanche, les champs de <strong>texte libre</strong> — description du
              projet, intitulés de phases et de tâches, comptes rendus de réunion,
              décisions, consignes saisies au moment de la génération — partent
              <strong> tels qu&apos;ils ont été écrits</strong> : s&apos;ils citent une
              personne, cette mention part avec eux. La plateforme ne les filtre pas,
              parce qu&apos;un compte rendu amputé produirait un rapport faux, remis à un
              financeur public.
            </p>
            {/* Les deux paragraphes suivants ne parlent que s'il y a un
                fournisseur : sans clé configurée, aucune requête ne part
                et décrire une destination serait décrire un transfert
                qui n'a pas lieu.

                Le second remplace « Ces données ne servent pas à
                entraîner de modèle ». La plateforme n'en sait rien et ne
                peut rien y faire : cela dépend de l'offre souscrite
                auprès du fournisseur — et certaines offres gratuites,
                dont les modèles « :free » d'OpenRouter proposés par
                défaut dans la configuration, ne l'excluent pas. Une page
                de confidentialité qui promet à la place d'un contrat est
                exactement ce que la 0056 a entrepris de retirer d'ici. */}
            {ai.hasKey && (
              <>
                <p className="text-sm" style={p}>
                  <strong>Où partent ces données.</strong> Elles sont traitées
                  en <strong>{aiFiche.zone}</strong>. {aiFiche.transfert}
                </p>
                <p className="text-sm" style={p}>
                  Ce que le fournisseur fait ensuite de ces données — en particulier leur
                  réutilisation pour entraîner ses propres modèles — dépend des conditions
                  souscrites auprès de lui par {s.legalEntity}, que la plateforme
                  elle-même ne peut ni imposer ni vérifier.
                </p>
              </>
            )}
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
              artificielle : {aiProvider}{ai.hasKey ? ` (${aiFiche.zone})` : ''}. Ces
              prestataires agissent comme sous-traitants au sens du RGPD.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
