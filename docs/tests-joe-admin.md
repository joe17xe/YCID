# Tests Solid'Pilot — Joe Abinader (administrateur)

Vos tests ne recoupent pas ceux de Bérengère et Maria. Elles vérifient
qu'elles ont *ce qu'il leur faut* ; vous vérifiez que **ce qu'elles n'ont
plus est bien parti**, que la reprise de données a eu lieu, et que ce qui
a été construit cette semaine tient.

Comptez **50 minutes**. À faire **avant** de leur envoyer leurs
protocoles : A1 à A3 conditionnent les leurs.

## Préalable — les migrations

Une seule requête. Les six compteurs doivent valoir **1**.

```sql
select
  (select count(*) from information_schema.columns
    where table_name='profiles' and column_name='can_manage_roadmap')          as col_roadmap_0037,
  (select count(*) from pg_proc where proname='storage_stats')                 as fn_storage_0035,
  (select count(*) from pg_proc where proname='validation_decided_outside_org')as fn_outside_0036,
  (select count(*) from pg_policies
    where tablename='indicator_measures' and policyname='Add measure')         as policy_measure_0038,
  (select count(*) from pg_policies
    where tablename='ai_reports' and policyname='Create ai reports')           as policy_report_0039,
  (select count(*) from information_schema.tables
    where table_name='email_settings')                                        as table_email_0040;
```

Si `table_email_0040` vaut 0, appliquez la **0040** avant A9.

---

## A1. ⭐⭐ La bascule des rôles

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

- `platform_role` ne vaut que **`admin`** ou **`user`** — plus aucun
  `ycid` ;
- `is_platform_admin` vrai **uniquement** sur les `admin`. C'était le
  piège de fond : cette colonne signifiait « pas un utilisateur
  ordinaire », pas « administrateur » ;
- **Bérengère** : `user`, `can_manage_roadmap = true`, rattachée à YCID ;
- **Maria** : `user`, `can_manage_roadmap = false` ;
- **vous** : `admin`.

⚠️ La reprise automatique de la 0037 avait accordé l'arbitrage de la
roadmap à **tous** les anciens comptes « ycid ». Si Maria ou Jordan
l'ont encore et que ce n'est pas voulu :

```sql
update profiles set can_manage_roadmap = false
 where email in ('mariamaroun10@gmail.com', 'jmorice@yvelines.fr');
```

## A2. ⭐⭐ Le périmètre passe par l'organisation

La colonne `organisations` de A1 doit être renseignée pour tous ceux qui
doivent voir des projets. Vide = ils ne verront que les projets dont ils
sont membres déclarés.

Deux contrôles de cohérence :

```sql
-- Les trois projets doivent être rattachés à YCID (vérifié le 26/07 : OK)
select pr.name, o.name as organisation, po.role
  from project_organizations po
  join projects pr on pr.id = po.project_id
  join organizations o on o.id = po.org_id
 order by pr.name, o.name;

-- Les deux sources de vérité du « porteur » doivent concorder : le repli
-- de validation (0031) lit projects.lead_org_id, l'écran lit le rôle
-- « porteur ». Une divergence enverrait un devis sans financeur à la
-- mauvaise organisation, SANS erreur visible. Attendu : trois « ok ».
select pr.name,
       lead.name as lead_org_id, po_porteur.name as role_porteur,
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

## A3. ⭐ Rattacher une personne à son organisation

1. **Administration ▸ Utilisateurs** : chaque ligne affiche ses
   organisations.
2. Ouvrez un compte ▸ **Modifier** : bloc **Organisations** (cases à
   cocher) et, plus bas, **Arbitrage de la roadmap**.
3. Cochez, enregistrez, rouvrez la fiche : la case doit être **restée
   cochée**.

**Attention au choix**, il décide de ce que la personne voit. Pour
**Maria**, cocher **LEY** donne exactement ses 2 projets ; cocher YCID
lui en donnerait 3 et ferait échouer son propre M2.

**Ce que le rattachement ne fait pas** : `observateur` et `bénéficiaire`
sont des libellés, pas des droits. Un compte rattaché à la Municipalité
d'Azour aurait la même vue complète qu'un partenaire. Théorique tant que
ces organisations n'ont pas de compte ; à arbitrer avant d'en ouvrir côté
libanais.

## A4. ⭐ Créer un compte — les rôles ont changé

1. **Utilisateurs ▸ Nouvel utilisateur**.

**Attendu** : le menu **Rôle** ne propose que **Administrateur** et
**Utilisateur**, et s'ouvre sur **Utilisateur** — plus sur
Administrateur, ce qui était le défaut jusqu'à cette semaine.

2. Le texte sous le menu doit dire que le périmètre se règle par les
   organisations, pas par le rôle.
3. Créez « Test Admin — à supprimer », puis supprimez-le.

## A5. Les rôles projet : cinq, plus sept

Ouvrez un projet ▸ **Aperçu** ▸ le sélecteur de rôle d'un membre.

**Attendu** : Responsable projet · PM, Référent Mairie, Responsable
financier, Contributeur · Terrain, **Auditeur**. Plus de « Validateur »
ni de « Lecteur ».

```sql
-- Attendu : aucune ligne
select role, count(*) from project_members
 where role in ('validateur','lecteur') group by role;
```

## A6. ⭐ Changer le rôle d'un membre, et le garde-fou

Nouveau cette semaine : le rôle se change **sur place**, sans retirer
puis rajouter la personne.

1. Aperçu ▸ sur un membre, changez le rôle avec le sélecteur.

**Attendu** : le changement prend, et le **Journal** porte
« Rôle projet : X → Y ».

2. Sur un projet à **un seul** responsable, essayez de le rétrograder.

**Attendu** : refus — « ce compte est le dernier responsable projet ».
Le même garde-fou qu'au retrait : sans lui, on contournerait par le rôle
ce qu'on interdit par le retrait.

## A7. ⭐⭐ Préparer la chaîne de validation

**À faire avant d'envoyer son protocole à Maria.** Le circuit se joue à
trois : Maria dépose, Bérengère décide, vous constatez.

Un devis part **automatiquement** vers le financeur de sa ligne. Si ce
financeur est le CD78 ou le MEAE — qui n'ont aucun compte — personne ne
pourra statuer, et B6 tombera à plat.

```sql
select bl.poste, bl.amount, o.name as financeur
  from budget_lines bl
  left join organizations o on o.id = bl.funder_org_id
  join phases ph on ph.id = bl.phase_id
  join projects pr on pr.id = ph.project_id
 where pr.name like 'CEM Liban — Coordination%'
 order by o.name nulls first, bl.poste;
```

S'il n'existe aucune ligne financée par YCID :

```sql
update budget_lines set funder_org_id = (select id from organizations where name = 'YCID')
 where id = '<id de la ligne choisie>';
```

**Communiquez le nom exact de cette ligne à Maria et Bérengère** — leurs
protocoles disent « la ligne indiquée par Joe ».

## A8. ⭐ L'unanimité et la file « À valider »

Nouveau cette semaine, et c'est le changement le plus structurant.

1. Menu **À valider** (deuxième entrée).

**Attendu** : ce que doivent trancher **vos** organisations. Vide si
rien n'attend. Pas de vue globale, même pour vous : votre recours existe
mais se prend sur la ligne, avec le montant sous les yeux.

2. Après le dépôt de Maria (M8a), la ligne doit y apparaître pour
   Bérengère.
3. Sur un devis soumis à **plusieurs** organisations, la ligne
   budgétaire affiche « en attente de N organisations sur M ».

**Attendu** : « Engagé » ne bouge **que** lorsque toutes ont validé. Un
seul refus rejette.

## A9. Le recours administrateur

**Vous êtes le seul à pouvoir tester ce chemin** : le bloc « Valider à
sa place… » n'apparaît que pour un compte `admin` non membre de
l'organisation sollicitée.

1. Un devis en attente d'une organisation **qui n'est pas la vôtre** ▸
   trombone 📎. Une ligne financée par le CD78 ou le MEAE convient.

**Attendu** : pas les boutons ordinaires, mais « vous n'êtes pas
membre » et **« Valider à sa place… »**.

2. Cliquez : **motif obligatoire**. Sans motif, refusé.
3. Validez avec un motif de test.

**Attendu** : au Journal, « **AU NOM DE** « … » (décideur non membre de
cette organisation) » et votre motif.

```sql
select d.filename, o.name as sollicitee, v.decision,
       pr.full_name as decideur, v.comment,
       validation_decided_outside_org(v.id) as hors_organisation
  from validations v
  join organizations o on o.id = v.org_id
  join documents d on d.id = v.document_id
  left join profiles pr on pr.id = v.decided_by
 order by v.decided_at desc nulls last limit 10;
```

## A10. Configuration ▸ Email

1. **Administration ▸ Configuration ▸ Email**.

**Attendu** : le formulaire SMTP. Si un message vous demande d'appliquer
la 0040, c'est qu'elle manque — ce n'est pas une panne.

2. Renseignez serveur, port, expéditeur, et **l'adresse de
   l'application** (sans elle, les emails annoncent qu'une décision
   attend sans donner le lien).
3. **Tester la connexion**.

**Attendu** : le résultat s'affiche et reste **daté** à l'écran. Le test
n'envoie **aucun message** — il ouvre la session, s'authentifie, et
referme.

**Sans identifiants SMTP**, tout fonctionne en dégradé : les
notifications restent visibles dans l'application. Dites-le-moi, ce n'est
pas bloquant pour la recette.

## A11. ⭐ Modifier la fiche projet et le montant voté

Nouveau : rien ne permettait de corriger un projet après sa création.

1. Sur un projet ▸ bouton **Modifier** (en haut).
2. Changez la description → Enregistrer.
3. Rouvrez et changez le **Montant voté**.

**Attendu** : un avertissement apparaît **avant** l'enregistrement, et
le Journal porte « MONTANT VOTÉ : ancien → nouveau ». « Projet modifié »
ne suffirait pas devant un financeur qui demande pourquoi l'enveloppe a
bougé.

4. Remettez la valeur d'origine.

## A12. Déposer la convention

Nouveau : la pièce fondatrice n'avait aucun point de dépôt.

1. Projet ▸ onglet **Documents** ▸ **Déposer une pièce**.
2. Nature **Convention**, phase « Tout le projet » ▸ Déposez.

**Attendu** : la pièce apparaît à l'inventaire, rattachée au projet et à
aucune tâche. Devis et factures ne sont **pas** proposés ici — ils
restent sur leur ligne pour demeurer dans le circuit de validation.

## A13. Stockage et menu

1. **Administration ▸ Stockage** : les **trois** espaces —
   `documents`, `avatars`, `branding` — même vides.

**Ne purgez rien.** Dites-moi seulement combien d'orphelins sont listés.

2. Vous seul devez voir la section **Administration** complète.
   Ouvrez les quatre écrans : aucun ne doit renvoyer au tableau de bord.

## A14. Le rapport IA compte encore ses phases

Deux pannes muettes ont déjà touché ce rapport.

1. Sur chacun des **trois** projets ▸ **Rapport d'expert IA** ▸
   **Générer**.

**Attendu** : « Périmètre analysé : N phase(s) », **N > 0** partout.

2. Vérifiez que la section décisions n'est pas vide si le projet en a.
   La requête sous-jacente était fausse depuis l'origine — corrigée
   cette semaine.

---

## Ordre conseillé

**A1 → A2 → A3 → A7, avant tout envoi.** Puis leurs protocoles partent,
et vous enchaînez A4 → A14 pendant qu'elles testent.

La chaîne à trois, dans cet ordre :

| # | Qui | Test | Effet |
|---|---|---|---|
| 1 | Vous | A7 | une ligne financée par YCID est désignée |
| 2 | Maria | M8a | dépôt du devis → « en attente », Engagé reste à 0 € |
| 3 | Bérengère | B6 | validation → **Engagé passe à 300 €** |
| 4 | Maria | M8b | facture, paiement, annulation |
| 5 | Vous | A9 | le recours administrateur, sur une **autre** ligne |

Si l'étape 3 ne fait pas bouger « Engagé », c'est le cœur du pilotage
financier qui ne fonctionne pas — signalez-le avant tout le reste.

## Ce que j'attends

Le numéro du test, ce que vous avez vu, et pour A1/A2 le **résultat brut
des requêtes** — c'est là que se lisent les reprises ratées.
