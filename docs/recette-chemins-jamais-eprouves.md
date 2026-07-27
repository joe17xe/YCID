# Recette — les trois chemins jamais éprouvés

Cette session ne rejoue pas la recette précédente. Elle vise **ce qui
existe dans le code et n'a jamais tourné en conditions réelles** :

1. l'**envoi d'un email** — aucun message n'est jamais parti ;
2. la **chaîne de validation à deux étapes** — la recette s'est faite sur
   la Coordination, où YCID est porteur *et* coordinateur, donc une seule
   étape ;
3. le **compteur de consommation IA** — la table existe, rien n'a encore
   été mesuré.

Plus les deux blocs budgétaires livrés depuis.

Comptez **1 heure**. Un testeur peut vous assister, mais les étapes
marquées 🔑 supposent le mot de passe SMTP ou un accès Supabase : gardez-les
pour vous.

## ⚠️ Ce qui envoie de vrais emails

L'étape 1 fait **réellement partir un message**. Avant de la lancer,
vérifiez qui est membre de l'organisation destinataire : tous ses
membres recevront le mail. La procédure ci-dessous est construite pour
que **vous seul** soyez destinataire.

## Ce qu'il ne faut pas faire

- Purger les orphelins de l'écran Stockage.
- Supprimer un projet, une organisation, un compte autre que ceux créés
  ici.
- Laisser le seuil de validation modifié en fin de session (étape 5).

---

# Préalable — l'état de la base

🔑 SQL Editor Supabase. Les **dix** compteurs doivent valoir `1`.

```sql
select
  (select count(*) from information_schema.columns
    where table_name='profiles' and column_name='can_manage_roadmap')            as c_0037,
  (select count(*) from pg_policies
    where tablename='indicator_measures' and policyname='Add measure')           as c_0038,
  (select count(*) from pg_policies
    where tablename='ai_reports' and policyname='Create ai reports')             as c_0039,
  (select count(*) from information_schema.tables
    where table_name='email_settings')                                          as c_0040,
  (select count(*) from information_schema.columns
    where table_name='validations' and column_name='step')                       as c_0041,
  (select count(*) from information_schema.columns
    where table_name='platform_settings' and column_name='coordinator_min_amount') as c_0042,
  (select count(*) from information_schema.tables
    where table_name='ai_usage')                                                as c_0043,
  (select count(*) from information_schema.columns
    where table_name='email_settings' and column_name='reply_to')               as c_0044,
  (select count(*) from pg_proc where proname='validation_chain_for_document')   as fn_chaine,
  (select count(*) from pg_proc where proname='storage_stats')                   as fn_stockage;
```

**Si un compteur vaut 0**, appliquez la migration correspondante avant de
continuer. Les étapes qui suivent la supposent en place.

---

# Étape 1 — L'envoi d'un email

## 1.1 🔑 Se rendre destinataire

Un devis notifie **les membres de l'organisation sollicitée**. Pour que
le mail vous arrive et à personne d'autre, rattachez-vous à YCID si ce
n'est pas déjà fait.

Vérifiez d'abord :

```sql
select p.full_name, p.email, coalesce(string_agg(o.name, ', '), '— aucune —') as orgs
  from profiles p
  left join memberships m on m.user_id = p.id
  left join organizations o on o.id = m.org_id
 where p.email = 'joe.abinader@gmail.com'
 group by p.id;
```

Si « — aucune — » : **Administration ▸ Utilisateurs ▸ votre compte ▸
Modifier**, cochez **YCID**, enregistrez.

Puis regardez qui d'autre est dans YCID — ces personnes recevront aussi
le message :

```sql
select p.full_name, p.email
  from memberships m
  join profiles p on p.id = m.user_id
  join organizations o on o.id = m.org_id
 where o.name = 'YCID';
```

## 1.2 🔑 Saisir la configuration SMTP

**Administration ▸ Configuration ▸ Email.**

| Champ | Valeur |
|---|---|
| Activer l'envoi d'emails | ✅ cocher |
| Serveur SMTP | `smtp.hostinger.com` |
| Port | `465` |
| Connexion chiffrée dès l'ouverture | ✅ cocher |
| Identifiant | `joe@ezrya.fr` |
| Mot de passe | le vôtre |
| Nom de l'expéditeur | `YCID Notifications` |
| Adresse de l'expéditeur | `cem.notif@ezrya.fr` |
| Adresse de réponse | `cem.notif@ezrya.fr` |
| Adresse de l'application | l'URL publique de Solid'Pilot |

Enregistrez.

## 1.3 Tester la connexion

Cliquez **« Tester la connexion »**.

**Attendu** : « Connexion au serveur réussie », et un encadré vert daté
plus bas.

**Ce test ne prouve PAS que vous pouvez expédier.** Il vérifie
l'authentification, pas le droit d'écrire sous l'adresse
`cem.notif@ezrya.fr` alors que vous vous authentifiez avec
`joe@ezrya.fr`. C'est l'étape suivante qui tranche.

## 1.4 ⭐ Le premier vrai message

1. Ouvrez **CEM Liban — Coordination et actions communes** ▸ onglet
   **Budget** ▸ n'importe quelle ligne ▸ trombone 📎.
2. **Déposer une pièce** : un fichier, Nature **Devis**, Montant `120`.

**Attendu à l'écran** : le devis apparaît « en attente », et l'organisation
sollicitée est **YCID**.

**Attendu dans votre boîte**, sous une minute :
- expéditeur **YCID Notifications** ;
- objet « Un devis attend votre décision — CEM Liban — Coordination… » ;
- un bouton **Voir le devis** qui ouvre la bonne page ;
- en répondant au message, le destinataire est `cem.notif@ezrya.fr`.

### Si aucun message n'arrive

Le plus probable est le refus de l'alias. Regardez les journaux du
serveur (`pm2 logs`) : une ligne `[notify-circuit] email non envoyé à …`
donne le message exact du serveur SMTP.

- « sender address rejected », « not owned by user » → Hostinger refuse
  l'expéditeur. Deux issues : authentifier directement
  `cem.notif@ezrya.fr`, ou autoriser l'alias chez Hostinger.
- rien du tout dans les journaux → la notification n'a pas été
  déclenchée ; c'est un autre problème, signalez-le.

**Vérifiez aussi les indésirables** : un premier envoi depuis un domaine
neuf y atterrit souvent.

## 1.5 La notification interne

Indépendamment de l'email, la cloche de l'application doit porter la
même notification. C'est le canal fiable : il ne dépend d'aucun tiers.

---

# Étape 2 — ⭐⭐ La chaîne à deux étapes

C'est le test le plus important de la session : ce chemin n'a **jamais**
été parcouru.

Sur la Coordination, YCID porte et coordonne — une seule étape. Il faut
donc une **Triade**.

## 2.1 Vérifier la chaîne attendue

🔑 SQL :

```sql
select pr.name as projet,
       porteur.name as etape_1,
       coord.name   as etape_2
  from projects pr
  left join organizations porteur on porteur.id = pr.lead_org_id
  left join platform_settings s on s.id = true
  left join organizations coord on coord.id = s.coordinator_org_id
 order by pr.name;
```

**Attendu** : Triade Villepreux → **LEY** puis **YCID**.

## 2.2 Déposer un devis sur la Triade

Ouvrez **CEM Liban — Triade Villepreux · Azour · LEY** ▸ **Budget** ▸ une
ligne ▸ trombone 📎 ▸ Nature **Devis**, Montant `900`.

**Attendu** : **deux** lignes d'état sous la pièce, numérotées **1** et
**2** — « 1 LEY », « 2 YCID ».

## 2.3 ⭐ Le second échelon est bloqué

Regardez la ligne **2 YCID**.

**Attendu** : la mention « **en attente — son tour viendra après
l'étape 1** », **sans aucun bouton**.

**C'est le cœur du test.** Vous êtes membre d'YCID et administrateur :
si un bouton Valider apparaît sur l'étape 2, l'ordre n'est pas opposable
et il faut me le dire immédiatement.

## 2.4 La file « À valider » masque l'inatteignable

Menu **À valider**.

**Attendu** : ce devis **n'apparaît pas**, mais une phrase indique
qu'« 1 autre vous reviendra une fois l'organisation porteuse
prononcée ».

## 2.5 Franchir l'étape 1

Vous n'êtes pas membre de LEY : c'est le chemin de recours qui s'ouvre.

Sur la ligne **1 LEY** :

**Attendu** : « vous n'êtes pas membre » et deux boutons **« Valider à sa
place… »**.

1. Cliquez **Valider à sa place…** → un champ **motif** s'ouvre.
2. Laissez le motif **vide** et tentez de confirmer.

**Attendu** : refus. *(Ce refus est un succès.)*

3. Saisissez `Test de recette — franchissement étape 1` et confirmez.

**Attendu** : l'étape 1 passe à « validé », et **l'étape 2 devient
actionnable** — les boutons Valider / Refuser apparaissent sur la ligne
YCID.

**Attendu par email** : un message « À votre tour : un devis attend votre
décision ». C'est la relance du second échelon, elle n'a jamais tourné.

## 2.6 ⭐ Franchir l'étape 2 et voir l'engagé bouger

1. Notez la valeur de **Engagé** sur la ligne budgétaire.
2. Validez l'étape **2 YCID**.

**Attendu** : Engagé augmente de **900 €**, et la pièce affiche
« Validé par les 2 organisations sollicitées — montant engagé ».

**Si Engagé ne bouge pas**, arrêtez-vous et signalez-le : c'est le cœur
du pilotage financier.

## 2.7 Le Journal

Onglet **Journal** du projet.

**Attendu** : une entrée portant « **AU NOM DE « Libanais en Yvelines »
(décideur non membre de cette organisation)** » et votre motif.

---

# Étape 3 — Le compteur de consommation IA

## 3.1 🔑 Saisir les tarifs

**Configuration ▸ Intelligence artificielle**, panneau du bas.

Relevez le tarif de votre modèle sur la page tarifaire de votre
fournisseur, saisissez prix entrée et prix sortie **par million de
jetons**, la devise, et **25** en budget mensuel.

## 3.2 Générer un rapport et voir le compteur bouger

1. Notez la valeur de « Jetons ce mois-ci ».
2. Sur un projet ▸ **Rapport d'expert IA** ▸ **Générer**.
3. Revenez sur Configuration ▸ Intelligence artificielle.

**Attendu** : les jetons ont augmenté, la ligne **rapport** apparaît dans
le tableau par fonction, et un coût estimé s'affiche.

**Attendu aussi** : l'en-tête du rapport indique « Périmètre analysé :
N phase(s) » avec **N > 0**.

## 3.3 La barre de budget

**Attendu** : une barre « X sur un budget de 25 € ». Elle passe à
l'orange à 80 %, au rouge au-delà — **sans jamais bloquer**.

---

# Étape 4 — Les deux blocs budgétaires

Onglet **Budget** d'un projet, entre les jauges et le tableau des lignes.

## 4.1 Répartition par financeur

**Attendu** : un tableau Prévu / Engagé / Payé / Reste à engager /
Consommation par financeur, une ligne « Non affecté » en dernier si des
lignes n'ont pas de financeur, et un **total en pied** identique à celui
des tuiles du haut.

## 4.2 Contributions en nature

**Attendu** : le **coût total du projet** (monétaire + nature) et la part
en nature en pourcentage ; le regroupement par organisation
contributrice ; une colonne **Justifiées** au format `n / m`.

Si des contributions n'ont aucune pièce, un bandeau orange les compte et
dit quelles pièces déposer.

**La question qui compte** : ce ratio « justifiées » vous paraît-il
tenable devant un contrôle du MEAE ? S'il affiche 0 sur 4, c'est un
chantier de collecte, pas un défaut du logiciel.

---

# Étape 5 — Le seuil de validation

## 5.1 Poser un seuil

**Configuration ▸ Validation** : mettez **500** en seuil, enregistrez.

**Attendu** : le bloc « Circuit obtenu » précise, pour chaque Triade,
« en dessous de 500 €, LEY seule ».

## 5.2 Vérifier l'effet

Sur la **Triade Villepreux**, déposez un devis de **300 €**.

**Attendu** : **une seule** étape — LEY. YCID n'est pas sollicitée.

Puis un devis de **800 €** : **deux** étapes.

## 5.3 ⚠️ Remettre à zéro

Remettez le seuil à **0** — ou à la valeur que vous décidez d'adopter.
Ne laissez pas 500 par inadvertance.

---

# Nettoyage

Supprimez les devis de test déposés aux étapes 1.4, 2.2 et 5.2 (trombone
📎 ▸ icône corbeille).

Laissez en place : les rattachements d'organisation, la configuration
SMTP, les tarifs IA.

---

# Ce que j'attends en retour

1. **L'email est-il arrivé** ? Si non, la ligne exacte des journaux.
2. **L'étape 2 était-elle bien bloquée** avant la validation de LEY ?
3. **De combien a bougé Engagé** en 2.6 ?
4. Le coût estimé affiché après un rapport, et le ratio « justifiées »
   des contributions en nature.
5. Tout écart, avec le numéro de l'étape.
