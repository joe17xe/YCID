# Recette automatisée — profil Joe Abinader (administrateur)

> **Destiné à un agent Claude pilotant un navigateur.** La session est
> déjà connectée avec le compte administrateur. N'essaie pas de changer
> de compte.

## Ordre

Les tests **A1 à A5** doivent être exécutés **avant** les recettes de
Maria et Bérengère : ils vérifient les données dont dépendent les leurs.
Les tests **A6 à A14** peuvent se faire ensuite, en parallèle.

## Règles absolues

1. **N'invente aucun résultat.** Une étape non exécutée donne `BLOQUÉ`.
2. **Recopie les résultats SQL tels quels**, sans les résumer.
3. **Interdits, sans exception** :
   - supprimer un projet ;
   - **purger les fichiers orphelins** de l'écran Stockage — la
     suppression est définitive et sans retour ;
   - supprimer un compte autre que celui que tu crées en A6 ;
   - modifier le montant voté sur autre chose qu'un aller-retour
     immédiat (A12) ;
   - envoyer un vrai email.
4. **Deux tests DOIVENT échouer** — A7-2 et A11-3. Un refus y est le
   résultat attendu.
5. Certaines requêtes SQL s'exécutent dans le **SQL Editor Supabase**,
   pas dans l'application. Si tu n'y as pas accès, marque ces tests
   `BLOQUÉ — pas d'accès SQL` et signale-le : ce sont les plus
   importants.

---

## A1 — Les migrations sont passées

**SQL** :

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
    where table_name='email_settings')                                        as table_email_0040,
  (select count(*) from information_schema.columns
    where table_name='validations' and column_name='step')                     as col_step_0041;
```

**Attendu** : les **sept** compteurs valent `1`.

**Si un compteur vaut 0**, arrête-toi et signale-le : les tests suivants
mesureraient un état incomplet.

**À reporter** : les sept valeurs.

## A2 — Le modèle de rôles

**SQL** :

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
- `platform_role` ne vaut que `admin` ou `user` — **aucun `ycid`** ;
- `is_platform_admin` est vrai **uniquement** sur les `admin` ;
- Bérengère Ayoub : `user`, `can_manage_roadmap = true`, rattachée à
  **YCID** ;
- Maria Maroun : `user`, rattachée à au moins une organisation.

**Critère `KO`** : une ligne `ycid` subsiste, ou `is_platform_admin` est
vrai sur un compte `user`.

**À reporter** : le tableau complet, tel quel.

## A3 — La chaîne de validation

**SQL** :

```sql
select pr.name as projet,
       porteur.name as etape_1_porteur,
       coord.name   as etape_2_coordinateur
  from projects pr
  left join organizations porteur on porteur.id = pr.lead_org_id
  left join platform_settings s on s.id = true
  left join organizations coord on coord.id = s.coordinator_org_id
 order by pr.name;
```

**Attendu** : chaque projet a une **étape 1** renseignée, et une
**étape 2** valant YCID. Sur le projet Coordination, les deux colonnes
portent la même organisation — la chaîne s'y réduit alors à une étape,
c'est voulu.

**Critère `KO`** : `etape_1_porteur` vide sur un projet, ou
`etape_2_coordinateur` vide partout.

**À reporter** : le tableau complet.

## A4 — Aucune écriture ne repose sur la seule appartenance

**SQL** :

```sql
select tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public'
   and cmd <> 'SELECT'
   and coalesce(qual, '') || coalesce(with_check, '') like '%is_project_member%'
 order by tablename, policyname;
```

**Attendu** : **exactement une ligne**, `audit_log / Insert audit`.

**Critère `KO`** : toute autre ligne. Cela signifierait qu'un droit de
simple consultation permet d'écrire.

**À reporter** : la liste complète.

## A5 — Les rôles projet obsolètes ont disparu

**SQL** :

```sql
select role, count(*) from project_members group by role order by role;
```

**Attendu** : **aucune** ligne `validateur` ni `lecteur`.

**À reporter** : le tableau complet.

## A6 — Créer un compte

**Étapes** : **Administration ▸ Utilisateurs ▸ Nouvel utilisateur**.

**Attendu 1** : le menu **Rôle** ne propose que **Administrateur** et
**Utilisateur** — ni « YCID », ni « Responsable projet », ni
« Validateur ».

**Attendu 2** : le menu s'ouvre par défaut sur **Utilisateur**.

**Puis** : crée un compte `Test agent — à supprimer`, email
`test-agent-recette@example.invalid`, rôle Utilisateur, mot de passe de
12 caractères au moins. Coche une organisation. Enregistre.

**Attendu 3** : le compte apparaît dans la liste, avec l'organisation
cochée affichée sur sa ligne.

**Puis, obligatoire** : **supprime ce compte**.

**À reporter** : les options du menu Rôle, la valeur par défaut, et si
le cycle création/suppression a abouti.

## A7 — ⚠️ Le garde-fou du dernier responsable — DOIT ÉCHOUER

**Ce test vérifie une INTERDICTION.**

**Étapes** :

1. Ouvre un projet → onglet **Aperçu** → repère un membre dont le rôle
   n'est **pas** Responsable projet → change son rôle avec le menu
   déroulant, puis **remets-le immédiatement à sa valeur d'origine**.

**Attendu 1** : le changement est accepté, et le **Journal** (onglet
Journal du projet) porte une entrée « Rôle projet : X → Y ».

2. **⚠️ Sur un projet n'ayant qu'UN SEUL Responsable projet**, tente de
   rétrograder ce responsable.

**Attendu 2** : **refus**, avec un message indiquant qu'il s'agit du
dernier responsable.

**Verdict `OK`** = le refus a lieu.
**Verdict `KO`** = la rétrogradation est acceptée.

**À reporter** : le message de refus exact, et l'entrée de Journal
constatée.

## A8 — La file « À valider »

**Étapes** : menu **À valider**.

**Attendu** : une liste limitée aux organisations dont Joe est membre,
ou le message « Rien n'attend votre décision ». Si des éléments ne sont
pas encore actionnables, une phrase indique combien reviendront plus
tard.

**À reporter** : le nombre d'éléments et le texte affiché.

## A9 — Le recours administrateur

**À faire seulement si un devis est en attente d'une organisation dont
Joe n'est PAS membre.** Sinon : `BLOQUÉ — aucun cas disponible`.

**Étapes** : ouvrir ce devis via le trombone 📎 sur sa ligne
budgétaire.

**Attendu 1** : pas les boutons ordinaires, mais la mention **« vous
n'êtes pas membre »** et des boutons **« Valider à sa place… »**.

**Attendu 2** : cliquer ouvre un champ **motif**. Sans motif, la
confirmation est **refusée**.

**N'aboutis PAS la validation** sur un devis réel : contente-toi de
vérifier que le motif est exigé, puis annule.

**À reporter** : les libellés vus, et si l'absence de motif est bien
bloquante.

## A10 — Configuration de l'email

**Étapes** : **Administration ▸ Configuration ▸ Email**.

**Attendu** : un formulaire SMTP (serveur, port, identifiant, mot de
passe, expéditeur, adresse de l'application). Si un message demande
d'appliquer la migration 0040, c'est qu'elle manque — signale-le, ce
n'est pas une panne.

**Puis** : clique **« Tester la connexion »**.

**Attendu** : un résultat s'affiche et reste **daté** à l'écran. Le test
**n'envoie aucun message**.

**N'enregistre aucun identifiant** que tu aurais inventé.

**À reporter** : les champs présents, et le résultat exact du test.

## A11 — Stockage

**Étapes** : **Administration ▸ Stockage**.

**Attendu** : **trois** espaces listés — `documents`, `avatars`,
`branding` — y compris ceux qui sont vides.

**⚠️ NE PURGE RIEN.** Relève seulement le nombre d'orphelins.

**À reporter** : les trois espaces avec leur nombre de fichiers, et le
nombre d'orphelins.

## A12 — Modifier la fiche projet

**Étapes** : ouvre un projet → bouton **Modifier** en haut.

1. Change la **description**, enregistre, puis **remets le texte
   d'origine**.
2. Rouvre la fenêtre et modifie le **Montant voté**.

**Attendu** : un **avertissement apparaît avant l'enregistrement**,
signalant que le changement sera inscrit au Journal.

3. **Enregistre**, va à l'onglet **Journal**, puis **remets
   immédiatement le montant d'origine**.

**Attendu** : le Journal porte une entrée « MONTANT VOTÉ : ancien →
nouveau ».

**À reporter** : le texte de l'avertissement, l'entrée de Journal, et
confirmation que le montant d'origine est rétabli.

## A13 — Déposer une pièce au niveau projet

**Étapes** : un projet → onglet **Documents** → **Déposer une pièce**.

**Attendu 1** : le menu **Nature** propose Convention, Rapport, Étude,
Note, Justificatif — et **ne propose ni Devis ni Facture** (ceux-ci se
déposent sur une ligne budgétaire, pour rester dans le circuit de
validation).

**Attendu 2** : le menu **Phase** propose « Tout le projet ».

**Puis** : dépose un fichier en Nature **Convention**, phase « Tout le
projet ». Vérifie qu'il apparaît à l'inventaire. **Puis supprime-le.**

**À reporter** : la liste exacte des natures proposées.

## A14 — Le rapport IA sur les trois projets

**Étapes** : sur **chacun** des trois projets → **Rapport d'expert IA**
→ **Générer**.

**Attendu** : « Périmètre analysé : N phase(s) » avec **N > 0** sur les
trois.

**Critère `KO` déterminant** : N vaut 0 sur un projet.

**À reporter** : la valeur de N pour chacun des trois projets.

---

## Format du rapport final

| Test | Verdict | Observation |
|---|---|---|
| A1 | OK / KO / BLOQUÉ | … |
| … | | |

Puis, obligatoirement :

1. **Les résultats SQL bruts** de A1 à A5, recopiés sans résumé.
2. **Les écarts** : pour chaque `KO`, l'attendu, le constaté, le message
   exact.
3. **Ce que tu n'as pas pu faire**, et pourquoi.
4. **Confirmation de non-destruction** : aucun projet supprimé, aucun
   orphelin purgé, montant voté rétabli, compte de test supprimé.
