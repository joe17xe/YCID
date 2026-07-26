# Tests Solid'Pilot — Joe Abinader (administrateur)

Vos tests ne recoupent pas ceux de Bérengère et Maria. Elles vérifient
qu'elles ont *ce qu'il leur faut* ; vous vérifiez que **ce qu'elles n'ont
plus est bien parti**, et que les outils construits hier fonctionnent.

Comptez **40 minutes**. À faire **avant** de leur envoyer leurs
protocoles : si A1 ou A2 échoue, leurs tests n'ont pas de sens.

## Préalable — les trois migrations

Vérifiez dans Supabase que **0035, 0036 et 0037** sont passées. Sinon
rien de ce qui suit n'est testable.

```sql
select
  to_regclass('public.profiles') is not null                                as ok,
  (select count(*) from information_schema.columns
    where table_name='profiles' and column_name='can_manage_roadmap')       as col_0037,
  (select count(*) from pg_proc where proname='storage_stats')              as fn_0035,
  (select count(*) from pg_proc where proname='validation_decided_outside_org') as fn_0036;
```

Les trois compteurs doivent valoir 1.

---

## A1. ⭐⭐ La bascule des rôles a bien eu lieu

C'est le test dont dépendent tous les autres.

```sql
select p.full_name, p.email, p.platform_role, p.is_platform_admin,
       p.can_manage_roadmap,
       coalesce(string_agg(o.name, ', ' order by o.name), '— aucune —') as organisations
  from profiles p
  left join memberships m on m.user_id = p.id
  left join organizations o on o.id = m.org_id
 group by p.id
 order by p.platform_role, p.full_name;
```

**Attendu** :

- `platform_role` ne vaut plus que **`admin`** ou **`user`**. Plus aucune
  ligne à `ycid`. S'il en reste une, la 0037 n'est pas passée.
- `is_platform_admin` est **true uniquement** sur les lignes `admin`.
  C'était le piège de fond : cette colonne valait « pas un utilisateur
  ordinaire », pas « administrateur ».
- **Bérengère Ayoub** : `user`, `can_manage_roadmap = true`.
- **Maria Maroun** : `user`, `can_manage_roadmap = false`.
- **Vous** : `admin`.

Si Bérengère n'a pas `can_manage_roadmap`, posez-le — la reprise
automatique de la 0037 ne trouve que les comptes encore marqués `ycid` :

```sql
update profiles set can_manage_roadmap = true where email = 'bayoub@yvelines.fr';
```

## A2. ⭐⭐ Le périmètre passe par l'organisation

Le rôle global ne porte plus le périmètre. Si personne n'est rattaché à
une organisation, **Bérengère ne verra plus qu'un projet ou aucun** — et
elle vous le signalera comme un défaut alors que c'est une donnée
manquante.

La colonne `organisations` de la requête A1 doit être renseignée pour
Bérengère (**YCID**) et pour Maria (ses organisations réelles). Si elle
affiche « — aucune — » partout, faites A3 **avant** d'envoyer les
protocoles.

Contrôle croisé — les trois projets doivent être rattachés à YCID :

```sql
select pr.name, o.name as organisation, po.role
  from project_organizations po
  join projects pr on pr.id = po.project_id
  join organizations o on o.id = po.org_id
 order by pr.name, o.name;
```

**Vérifié le 26/07 : c'est le cas.** YCID n'est `porteur` que sur la
Coordination et `financeur` sur les deux Triades — sans conséquence,
`is_project_member()` joint `project_organizations` sans filtrer sur le
rôle. Financeur, porteur ou observateur donnent la même visibilité.

### A2 bis. Les deux sources de vérité du « porteur »

Le repli de validation (0031) désigne l'organisation porteuse par
`projects.lead_org_id`, alors que l'écran lit le rôle `porteur` de
`project_organizations`. Si les deux divergent, un devis sans financeur
part chez la mauvaise organisation, **sans erreur visible**.

```sql
select pr.name,
       lead.name as lead_org_id,
       po_porteur.name as role_porteur,
       case when lead.id is distinct from po_porteur.id
            then '⚠️ DIVERGENCE' else 'ok' end as verdict
  from projects pr
  left join organizations lead on lead.id = pr.lead_org_id
  left join lateral (
    select o.id, o.name from project_organizations po
      join organizations o on o.id = po.org_id
     where po.project_id = pr.id and po.role = 'porteur' limit 1
  ) po_porteur on true
 order by pr.name;
```

**Attendu** : trois `ok` — Coordination → YCID, Triade Jouy → Comité de
Jumelage, Triade Villepreux → LEY.

## A3. ⭐⭐ Rattacher une personne à son organisation — l'écran neuf

C'est la fonction construite hier soir ; elle n'a jamais été utilisée.

1. **Administration ▸ Utilisateurs**.

**Attendu** : chaque ligne affiche désormais ses **organisations**. La
plupart sont vides — c'est le problème que cet écran corrige.

2. Ouvrez **Bérengère Ayoub** ▸ **Modifier**.

**Attendu** : sous le mot de passe, un bloc **Organisations** avec une
case par organisation, puis, sous « Compte actif », une case **Arbitrage
de la roadmap** — déjà cochée pour elle.

3. Cochez **YCID** → **Enregistrer**.

**Attendu** : retour à la liste, « YCID » apparaît sur sa ligne.

4. Vérifiez en base que le lien existe vraiment :

```sql
select p.full_name, o.name
  from memberships m
  join profiles p on p.id = m.user_id
  join organizations o on o.id = m.org_id
 order by p.full_name;
```

5. Rouvrez sa fiche : la case doit être **restée cochée**. (Le formulaire
   relit les rattachements ; s'il revient vide, l'enregistrement n'a pas
   pris et il faut me le dire.)

6. Faites de même pour **Maria Maroun**, en cochant **LEY** — et rien
   d'autre.

Ce choix n'est pas neutre : l'organisation cochée décide de ce qu'elle
verra, et son protocole (M2) attend **2 projets**.

| Organisation cochée | Projets visibles |
|---|---|
| **LEY** | Coordination + Triade Villepreux = **2** ✅ |
| YCID | les **3** ❌ M2 échoue, et elle hérite du périmètre programme |
| Commune de Villepreux | Coordination + Triade Villepreux = 2 ✅ |

LEY tombe juste sans intervention : porteuse de la Triade Villepreux,
partenaire de la Coordination, absente de la Triade Jouy.

**Attention** : décocher toutes les organisations d'un compte lui retire
la vue sur les projets correspondants. C'est l'effet recherché, mais il
est immédiat.

**Ce que ce rattachement ne fait pas** : `observateur` et `beneficiaire`
sont des libellés, pas des droits. Un compte rattaché à la Municipalité
d'Azour — `observateur` sur la Coordination — aurait la **même vue
complète** qu'un partenaire, budget et pièces compris. Théorique tant
que ces organisations n'ont pas de compte ; à arbitrer avant d'en ouvrir
côté libanais.

## A4. ⭐ Créer un compte — la valeur par défaut

1. **Utilisateurs ▸ Nouvel utilisateur**.

**Attendu** : le menu **Rôle** ne propose plus que **Administrateur** et
**Utilisateur** — ni « YCID », ni « Responsable projet ». Et il s'ouvre
sur **Utilisateur**, pas sur Administrateur.

2. Lisez le texte sous le menu : il doit dire que le périmètre se règle
   par les organisations, pas par le rôle.

3. Créez « Test Admin — à supprimer », rôle Utilisateur, une organisation
   cochée. Puis supprimez-le depuis la liste.

## A5. « Modifier » ne s'affiche plus sur un administrateur inaccessible

Sur la liste, une ligne **Administrateur** que vous n'avez pas le droit
de toucher ne doit plus proposer « Modifier ». Le serveur refusait déjà
l'enregistrement, mais le bouton restait offert — sur un écran de
gestion de comptes, ça se lit comme une faille alors que le verrou tient.

Sur **votre propre compte**, « Modifier » reste normal.

## A6. ⭐ Doublon de tâche et suppression

Vous avez créé deux tâches identiques par erreur, sans pouvoir les
supprimer. Les deux manques sont comblés.

1. Projet ▸ **Budget** ▸ une ligne ▸ **« Créer la tâche »**.
2. Recommencez **immédiatement** sur la même ligne.

**Attendu** : le second essai est refusé avec « Une tâche « … » existe
déjà dans cette phase ». Pas de second exemplaire.

3. Onglet **Tâches** : sur une tâche de test, un bouton de
   **suppression** existe désormais. Supprimez les doublons restants
   d'hier.

**Attendu** : la tâche disparaît, la répartition budgétaire qui la
visait aussi, et le tout est tracé au Journal.

## A6 bis. ⭐⭐ Préparer la chaîne de validation

**À faire avant d'envoyer son protocole à Maria.** Le circuit devis →
validé → engagé se joue à trois : Maria dépose, Bérengère décide, vous
constatez. Encore faut-il que le devis parte vers une organisation où
quelqu'un siège.

Un devis rattaché à une ligne part **automatiquement** vers le financeur
de cette ligne (`saveDocument` appelle `submitForValidation` dès que la
nature est « devis »). Si ce financeur est le CD78 ou le MEAE, personne
ne pourra statuer : ces organisations n'ont pas de compte. Le devis
resterait bloqué et B6 tomberait à plat.

1. Trouvez sur la **Coordination** une ligne financée par **YCID** :

```sql
select bl.poste, bl.amount, o.name as financeur
  from budget_lines bl
  left join organizations o on o.id = bl.funder_org_id
  join phases ph on ph.id = bl.phase_id
  join projects pr on pr.id = ph.project_id
 where pr.name like 'CEM Liban — Coordination%'
 order by o.name nulls first, bl.poste;
```

2. **S'il n'y en a aucune**, posez YCID comme financeur sur une ligne —
   c'est de toute façon l'organisation porteuse de ce projet :

```sql
update budget_lines
   set funder_org_id = (select id from organizations where name = 'YCID')
 where id = '<id de la ligne choisie>';
```

3. **Communiquez le nom exact de cette ligne à Maria et à Bérengère.**
   Leurs deux protocoles disent « la ligne indiquée par Joe ».

**Ordre d'exécution** : Maria fait M8a (dépôt du devis) → vous prévenez
Bérengère → elle fait B6 (validation) → « Engagé » passe à 300 €.

Une ligne sans financeur **du tout** n'est pas un cas d'erreur : le
devis part alors vers l'organisation porteuse, YCID ici. Le repli est
ordonné (règles → financeur → porteuse) depuis la 0031.

## A7. ⭐ Validation au nom d'une autre organisation

Le vrai correctif du problème remonté hier : Bérengère a validé un devis
qui relevait de LEY.

**Vous êtes le seul à pouvoir tester ce chemin** : le bloc « Valider à
sa place… » ne s'affiche que pour un compte `admin` non membre de
l'organisation sollicitée. Bérengère, redevenue `user`, ne voit plus
rien du tout sur une ligne hors de son organisation — c'est ce qu'elle
vérifie en B6.

1. Ouvrez un devis en attente dont l'organisation sollicitée **n'est pas
   la vôtre** ▸ trombone 📎. Une ligne financée par le **CD78** ou le
   **MEAE** convient : ces organisations n'ont aucun compte, c'est
   exactement le cas que le recours est censé débloquer.

**Attendu** : pas les boutons ordinaires, mais la mention que vous n'êtes
pas membre et deux boutons **« Valider à sa place… »**.

2. Cliquez : un champ **motif obligatoire** s'ouvre. Sans motif, refusé.
3. Validez avec un motif de test.

**Attendu** : au **Journal**, la trace porte **« AU NOM DE « … »
(décideur non membre de cette organisation) »** et votre motif.

4. Contrôle en base :

```sql
select d.filename, o.name as sollicitee, v.decision,
       pr.full_name as decideur, v.comment,
       validation_decided_outside_org(v.id) as hors_organisation
  from validations v
  join organizations o on o.id = v.org_id
  join documents d on d.id = v.document_id
  left join profiles pr on pr.id = v.decided_by
 order by v.decided_at desc nulls last
 limit 10;
```

**Attendu** : `hors_organisation = true` sur la vôtre.

5. **Seul un compte `admin` doit pouvoir faire ça.** C'est ce que Bérengère
   vérifie en B6 de son côté : elle doit voir la porte, sans pouvoir la
   franchir sur un devis réel.

## A8. Stockage — l'inventaire complet

1. **Administration ▸ Stockage**.

**Attendu** : les **trois** espaces — `documents`, `avatars`, `branding`
— même vides. Avant la 0035 un espace sans fichier disparaissait
purement de l'inventaire, ce qui est le pire défaut possible pour un
écran d'inventaire.

2. Regardez la répartition par projet et la liste des **orphelins**.

**Ne purgez rien aujourd'hui** : la suppression est définitive et sans
retour. Dites-moi seulement combien d'orphelins sont listés.

## A9. Votre menu a survécu

Vous seul devez encore voir la section **Administration** complète :
Utilisateurs, Accès & rôles, Stockage, Configuration.

Ouvrez les quatre. Aucune ne doit renvoyer vers le tableau de bord.

C'est le contrepoint exact de M1 et B1 : ce qu'elles ne doivent plus
voir, vous devez continuer à le voir.

## A10. Le rapport IA compte encore ses phases

Un défaut silencieux nous a échappé une journée entière : le rapport se
générait « sur 0 phase » sans la moindre erreur.

1. Sur chacun des **trois** projets ▸ **Rapport d'expert IA** ▸ **Générer**.

**Attendu** : en en-tête, « Périmètre analysé : N phase(s) », **N > 0**
partout.

Si un projet affiche 0, ne cherchez pas plus loin, dites-le-moi : c'est
la même famille de panne.

---

## Ordre conseillé

**A1 → A2 → A2 bis → A3 → A6 bis, avant tout envoi.** Tant que les
rattachements ne sont pas posés, les tests de Bérengère et Maria
mesurent une donnée manquante, pas le logiciel ; et sans A6 bis, le
devis de Maria partira vers une organisation où personne ne siège.

Ensuite seulement : envoyez leurs protocoles, et enchaînez A4 → A10
pendant qu'elles testent.

La chaîne à trois se déroule dans cet ordre, et il n'est pas
interchangeable :

| # | Qui | Test | Effet |
|---|---|---|---|
| 1 | Vous | A6 bis | une ligne financée par YCID est désignée |
| 2 | Maria | M8a | dépôt du devis → « en attente », Engagé reste à 0 € |
| 3 | Bérengère | B6 | validation → **Engagé passe à 300 €** |
| 4 | Maria | M8b | facture, paiement, annulation |
| 5 | Vous | A7 | le recours administrateur, sur une **autre** ligne |

Si l'étape 3 ne fait pas bouger « Engagé », c'est le cœur du pilotage
financier qui ne fonctionne pas — signalez-le avant tout le reste.

## Ce que je veux en retour

Le numéro du test, ce que vous avez vu, et pour A1/A2 le **résultat brut
des requêtes** — c'est là que se lisent les reprises ratées.
