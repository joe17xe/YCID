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

6. Faites de même pour **Maria Maroun** avec son organisation réelle.

**Attention** : décocher toutes les organisations d'un compte lui retire
la vue sur les projets correspondants. C'est l'effet recherché, mais il
est immédiat.

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

## A7. ⭐ Validation au nom d'une autre organisation

Le vrai correctif du problème remonté hier : Bérengère a validé un devis
qui relevait de LEY.

1. Ouvrez un devis en attente dont l'organisation sollicitée **n'est pas
   la vôtre** ▸ trombone 📎.

**Attendu** : pas les boutons ordinaires, mais la mention que vous n'êtes
pas membre et deux boutons **« Valider à sa place… »**.

2. Cliquez : un champ **motif obligatoire** s'ouvre. Sans motif, refusé.
3. Validez avec un motif de test.

**Attendu** : au **Journal**, la trace porte **« AU NOM DE « … »
(décideur non membre de cette organisation) »** et votre motif.

4. Contrôle en base :

```sql
select v.id, o.name as sollicitee, v.status,
       validation_decided_outside_org(v.id) as hors_organisation
  from validations v join organizations o on o.id = v.org_id
 order by v.created_at desc limit 10;
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

**A1 → A2 → A3 d'abord.** Tant que les rattachements ne sont pas posés,
les tests de Bérengère et Maria mesurent une donnée manquante, pas le
logiciel. Une fois A3 fait, envoyez-leur leurs protocoles et enchaînez
A4 → A10 pendant qu'elles testent.

## Ce que je veux en retour

Le numéro du test, ce que vous avez vu, et pour A1/A2 le **résultat brut
des requêtes** — c'est là que se lisent les reprises ratées.
