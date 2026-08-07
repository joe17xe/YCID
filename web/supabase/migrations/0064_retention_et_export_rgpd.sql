-- ============================================================
-- 0064 — La durée de conservation était une phrase, pas une règle ;
--        et le droit d'accès n'avait aucun moyen de s'exercer
-- ============================================================
-- Deux défauts distincts, une seule cause : la page
-- /confidentialite décrit une plateforme qui n'existe pas.
--
-- DÉFAUT 1 — « Les données projets sont conservées pendant
-- {legalRetention} ». `legal_retention` (0025) est une chaîne de texte
-- libre, saisie dans Administration ▸ Configuration ▸ Mentions légales
-- et simplement RÉAFFICHÉE. Aucune ligne de code, nulle part, ne lit
-- cette valeur pour supprimer quoi que ce soit. Un administrateur peut y
-- écrire « 30 jours » : rien ne s'effacera, et la page annoncera trente
-- jours à des personnes dont tout est gardé indéfiniment. L'article
-- 5.1.e du RGPD exige une limitation RÉELLE de la durée de conservation,
-- pas une durée affichée.
--
-- C'est la panne muette habituelle de ce dépôt — l'écran dit vrai sur le
-- papier et faux dans les faits — appliquée cette fois au juridique, où
-- l'écrit engage : c'est la personne concernée qui lit la page, et c'est
-- la CNIL qui la relira.
--
-- DÉFAUT 2 — « vous disposez de droits d'accès […] pour les exercer :
-- contactez l'éditeur ». L'éditeur contacté n'a AUCUN moyen de répondre.
-- Sortir ce que la plateforme détient sur une personne demandait
-- aujourd'hui une douzaine de requêtes écrites à la main dans le SQL
-- Editor, sur des tables que personne ne pense à énumérer — et le risque
-- garanti d'en oublier deux, ou d'en verser une qui contient les données
-- de quelqu'un d'autre.

-- ============================================================
-- PARTIE 1 — CONSERVATION
-- ============================================================

-- ------------------------------------------------------------
-- L'arbitrage : tout ne se purge pas de la même façon
-- ------------------------------------------------------------
-- Se tromper coûte cher DANS LES DEUX SENS, et c'est ce qui interdit un
-- réglage unique « conserver N mois » appliqué à toute la base.
--
-- CE QU'IL NE FAUT SURTOUT PAS PURGER :
--
--   · LE JOURNAL D'AUDIT. Il justifie de l'argent public devant le MEAE
--     et le Département, et le Product Owner vient de trancher : les
--     traces des décisions et des devis RESTENT. La 0060 va dans le même
--     sens — elle a retiré la clé étrangère de `audit_log.project_id`
--     précisément pour que le journal SURVIVE au projet supprimé. Poser
--     ici une purge automatique du journal reviendrait à défaire la 0060
--     par un autre chemin, quatre migrations plus loin. La ligne
--     `audit_log` existe donc dans la table de rétention, mais elle est
--     LIVRÉE DÉSACTIVÉE, et c'est la seule.
--   · LES DONNÉES PROJETS (tâches, budgets, pièces, indicateurs,
--     réunions, décisions). Même raison, et la même durée
--     d'obligation : un financement se justifie des années après sa
--     clôture. Elles ne figurent dans aucune catégorie ci-dessous — leur
--     effacement est une DÉCISION (clôture d'un programme, demande
--     d'effacement instruite), pas une échéance.
--
-- CE QUI N'A AUCUNE RAISON D'ÊTRE GARDÉ LONGTEMPS. Relevé de ce qui
-- existe RÉELLEMENT en base, table par table, plutôt que de la liste
-- habituelle qu'on récite :
--
--   · `notifications` (0001) — messages d'écran. Rien ne les efface
--     jamais, pas même une fois lus. Une notification lue a fini son
--     office ; une notification non lue depuis un an ne sera pas lue.
--   · `ai_usage` (0043) — un enregistrement par appel au modèle, avec
--     `user_id`. C'est un COMPTEUR DE DÉPENSE, et c'est ce qui le rend
--     particulier : supprimer les lignes fausserait le total « depuis
--     toujours » de l'écran Consommation. Traité à part, voir plus bas.
--   · `import_runs` (0012) — journal des imports CSV. `errors` est un
--     jsonb qui contient DES LIGNES DU FICHIER IMPORTÉ, donc
--     potentiellement des noms et des adresses.
--   · les traces d'envoi d'email — et ici le relevé corrige une idée
--     reçue : `email_send_trace` (0046) N'EST PAS UNE TABLE. Ce sont
--     quatre colonnes sur l'unique ligne de `email_settings`, réécrites
--     à chaque envoi. Rien ne s'y accumule, il n'y a donc RIEN à purger
--     au sens habituel. Il reste pourtant une donnée personnelle :
--     `last_send_to` conserve l'adresse email du dernier destinataire,
--     indéfiniment, longtemps après que la trace a cessé de servir à
--     diagnostiquer quoi que ce soit. C'est un effacement de champs, pas
--     une suppression de lignes.
--   · les SESSIONS. Elles vivent dans `auth.sessions` et
--     `auth.refresh_tokens`, gérées par GoTrue, qui applique déjà ses
--     propres expirations. Le schéma `auth` n'appartient pas à
--     l'application : une migration qui y toucherait serait défaite au
--     prochain déploiement de Supabase, et pourrait déconnecter tout le
--     monde entre-temps. AUCUNE catégorie n'est posée dessus, et c'est
--     délibéré — la page de confidentialité le dit en clair plutôt que
--     de laisser croire à un réglage qui n'existe pas.
--
-- CAS PARTICULIER, ET C'EST L'ARBITRAGE LE PLUS FIN DE CETTE MIGRATION :
-- `ai_usage` n'est PAS supprimé, il est DÉ-IDENTIFIÉ. Passé le délai,
-- `user_id` est mis à null et la ligne reste. Ce que le RGPD demande,
-- c'est que la donnée cesse d'être rattachable à une personne ; ce que
-- l'exploitation demande, c'est de savoir ce que le fournisseur d'IA a
-- coûté depuis le début. Les deux tiennent ensemble, à condition de ne
-- pas confondre « effacer la ligne » et « effacer la personne ». Une
-- suppression pure aurait fait rétrécir en silence le total « depuis
-- toujours » d'Administration ▸ Configuration ▸ IA — un compteur de
-- dépense qui baisse tout seul est pire qu'absent.

-- ------------------------------------------------------------
-- La table des durées
-- ------------------------------------------------------------
-- Ce qu'elle porte : une DURÉE et un INTERRUPTEUR, par catégorie.
--
-- Ce qu'elle ne porte PAS, et c'est le point : ni nom de table, ni
-- condition, ni fragment de SQL. La cible de chaque catégorie est écrite
-- DANS la fonction de purge, en dur. Une table de configuration qui
-- désignerait sa cible par un nom de table serait une injection SQL avec
-- formulaire d'administration fourni — et surtout, elle permettrait de
-- pointer la purge sur `audit_log` en modifiant un champ texte, sans
-- migration, sans relecture, sans que rien ne le signale. Le choix de ce
-- qui se purge est une décision de gouvernance : elle vit dans un
-- fichier versionné, pas dans une ligne modifiable depuis un écran.
create table if not exists retention_policies (
  category text primary key,
  label text not null,
  description text not null,
  -- Nombre de jours au-delà duquel la donnée est purgée. Zéro n'est pas
  -- accepté : « purger immédiatement » n'est pas une politique de
  -- conservation, c'est une erreur de saisie qui viderait la table au
  -- premier passage. Pour ne rien purger, on décoche `enabled`.
  retention_days int not null check (retention_days >= 30),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);

comment on table retention_policies is
  'Durées de conservation par catégorie de données (RGPD art. 5.1.e). '
  'La CIBLE de chaque catégorie est codée dans retention_purge(), jamais ici : '
  'cette table ne règle que la durée et l''activation.';

-- Lecture PUBLIQUE, comme `platform_settings` (0018). Ce n'est pas un
-- oubli de durcissement : une politique de conservation que seuls les
-- administrateurs peuvent lire ne peut pas être publiée aux personnes
-- qu'elle concerne, et la page /confidentialite est accessible sans
-- connexion. Une durée de conservation est faite pour être annoncée.
alter table retention_policies enable row level security;

drop policy if exists "Retention policies read" on retention_policies;
create policy "Retention policies read" on retention_policies
  for select using (true);

-- Écriture réservée aux administrateurs plateforme. Pas d'INSERT ni de
-- DELETE : la liste des catégories est fixée par cette migration, en
-- regard de la fonction de purge. Une catégorie ajoutée depuis un écran
-- ne correspondrait à aucun `when` de la fonction et ne purgerait rien
-- — une ligne qui promet et ne fait pas, exactement le défaut qu'on
-- corrige.
drop policy if exists "Retention policies write" on retention_policies;
create policy "Retention policies write" on retention_policies
  for update using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------
-- Les catégories, et pourquoi ces durées
-- ------------------------------------------------------------
-- `on conflict do nothing` : rejouer la migration ne réécrit PAS des
-- durées qu'un administrateur aurait ajustées entre-temps. C'est la
-- règle d'idempotence du dépôt appliquée à des données de configuration
-- — pour lesquelles « remettre la valeur d'origine » n'est pas neutre.
--
-- Durées volontairement PRUDENTES, c'est-à-dire longues : une purge trop
-- courte détruit sans retour, une purge trop longue se raccourcit d'un
-- clic. L'asymétrie commande.
insert into retention_policies (category, label, description, retention_days, enabled) values

  ('notifications_lues',
   'Notifications lues',
   'Messages affichés dans la cloche, une fois ouverts par leur destinataire. '
   'Décompté à partir de la date de lecture.',
   90, true),

  -- Plus longue que les lues, et à dessein : une notification non lue
  -- porte peut-être une information que la personne n'a pas encore vue.
  -- Un an écoulé, elle ne la verra plus.
  ('notifications_non_lues',
   'Notifications jamais ouvertes',
   'Messages de la cloche restés non lus. Décompté à partir de la date d''envoi.',
   365, true),

  -- 13 mois : de quoi comparer un exercice à son homologue de l'année
  -- précédente, plus une marge de clôture. En deçà, l'écran Consommation
  -- perdrait sa seule comparaison utile.
  ('ai_usage_identite',
   'Auteur des appels à l''intelligence artificielle',
   'Le rattachement d''un appel au modèle à la personne qui l''a déclenché. '
   'Seul l''identifiant de la personne est effacé : la ligne de consommation '
   'reste, pour que le suivi de la dépense conserve son historique complet.',
   400, true),

  -- SIX MOIS, arbitrage YCID. Deux ans avaient d'abord été retenus (un
  -- import peut être remis en cause lors d'un contrôle sur l'exercice
  -- précédent), mais `errors` est le seul endroit de la base où des
  -- lignes de fichier source sont recopiées telles quelles : c'est une
  -- COPIE de données personnelles hors des tables qui les hébergent, et
  -- la minimisation prime ici sur le confort de relecture. Passé ce
  -- délai, ce que l'import a produit se lit dans les tables et au
  -- journal d'audit — pas dans son compte rendu.
  ('import_runs',
   'Journal des imports de fichiers',
   'Compte rendu des imports CSV : nom du fichier, nombre de lignes créées ou '
   'ignorées, et le détail des lignes en erreur — qui reproduit des extraits du '
   'fichier importé, donc parfois des noms et des adresses.',
   180, true),

  ('email_trace',
   'Trace du dernier envoi d''email',
   'Adresse du dernier destinataire et réponse du relais, conservées pour '
   'diagnostiquer un envoi qui n''arrive pas. Passé le délai, l''adresse est '
   'effacée ; la date et le résultat de l''envoi restent.',
   180, true),

  -- LIVRÉE DÉSACTIVÉE. Voir l'arbitrage en tête de fichier : la durée
  -- figure ici pour être visible et discutable, pas pour être appliquée.
  -- Dix ans est la durée usuelle de conservation des pièces justifiant
  -- une subvention publique ; l'activer est une décision de gouvernance,
  -- prise en connaissance de ce qu'elle détruit.
  ('audit_log',
   'Journal d''audit',
   'Trace horodatée des actions sensibles : création et modification des lignes '
   'budgétaires, décisions de validation, suppressions. Cette catégorie est '
   'DÉSACTIVÉE : le journal justifie l''emploi de fonds publics devant le MEAE '
   'et le Département, et il est conservé pendant toute la durée de cette '
   'obligation.',
   3650, false)

on conflict (category) do nothing;

-- ------------------------------------------------------------
-- Le journal des purges
-- ------------------------------------------------------------
-- Sans lui, la purge est un bouton qui dit « fait » et dont on ne peut
-- rien prouver ensuite. Il répond à deux questions qu'on posera : « la
-- politique de conservation est-elle réellement appliquée ? » (un
-- contrôleur, ou la CNIL) et « où sont passées ces lignes ? » (un
-- exploitant, dans six mois).
create table if not exists retention_runs (
  id uuid primary key default uuid_generate_v4(),
  at timestamptz not null default now(),
  -- Null quand la purge est déclenchée par une planification SQL : il
  -- n'y a alors pas d'utilisateur. La colonne ne dit donc pas « inconnu »
  -- mais « personne » — `source` fait la différence.
  by_user uuid references profiles(id) on delete set null,
  source text not null default 'manuel' check (source in ('manuel', 'planifie')),
  dry_run boolean not null default false,
  -- Un objet par catégorie : { categorie, libelle, jours, operation,
  -- lignes }. En jsonb parce que la liste des catégories bouge de
  -- migration en migration, et qu'une trace doit garder la forme
  -- qu'elle avait le jour où elle a été écrite.
  results jsonb not null default '[]'::jsonb,
  total_affected int not null default 0
);

create index if not exists retention_runs_at_idx on retention_runs (at desc);

alter table retention_runs enable row level security;

-- Lecture réservée aux administrateurs : c'est une donnée
-- d'exploitation, comme la consommation d'IA (0043) et le stockage.
drop policy if exists "Admins read retention runs" on retention_runs;
create policy "Admins read retention runs" on retention_runs
  for select using (is_admin());

-- AUCUNE policy d'écriture, volontairement, et pour la même raison que
-- `ai_usage` (0043) : la seule écriture légitime vient de
-- `retention_purge()`, qui est `security definer` et n'est donc pas
-- soumise à la RLS. Un journal de purge que l'application peut écrire
-- depuis le navigateur n'est pas un journal.

-- ------------------------------------------------------------
-- L'aperçu : ce que la purge ferait, sans le faire
-- ------------------------------------------------------------
-- Fonction séparée de la purge, et non un paramètre `dry_run` de
-- celle-ci, pour une raison d'écran : l'aperçu est appelé à CHAQUE
-- affichage de la page Administration. S'il passait par la fonction de
-- purge, une erreur de signe dans un `if p_dry_run` deviendrait une
-- purge à l'ouverture d'un écran. Deux fonctions, dont une qui n'écrit
-- rien : le pire défaut possible n'a plus de chemin pour se produire.
--
-- `security definer` — nécessaire, et voici pourquoi, parce que ce dépôt
-- écrit ses fonctions en `security invoker` quand il le peut (0061) :
-- `ai_usage` n'a AUCUNE policy d'insertion ni de suppression, et
-- `notifications` porte « Own notifications ... using (user_id =
-- auth.uid()) » — un administrateur ne voit donc pas les notifications
-- des autres. Compter en `security invoker` rendrait zéro partout, et la
-- purge qui suit ne supprimerait rien en répondant « succès ». C'est
-- exactement le mensonge silencieux que la 0059 et la 0061 documentent.
--
-- Le privilège est borné par le premier geste du corps : `is_admin()`.
create or replace function public.retention_preview()
returns table (
  category text,
  label text,
  description text,
  retention_days int,
  enabled boolean,
  operation text,
  affected int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  r        retention_policies%rowtype;
  v_cut    timestamptz;
  v_count  int;
  v_op     text;
begin
  if not is_admin() then
    raise exception 'Réservé aux administrateurs de la plateforme.';
  end if;

  for r in select * from retention_policies order by category loop
    v_cut := now() - make_interval(days => r.retention_days);
    v_count := 0;

    case r.category
      when 'notifications_lues' then
        v_op := 'suppression';
        select count(*) into v_count from notifications
         where read_at is not null and read_at < v_cut;

      when 'notifications_non_lues' then
        v_op := 'suppression';
        select count(*) into v_count from notifications
         where read_at is null and created_at < v_cut;

      when 'ai_usage_identite' then
        v_op := 'dé-identification';
        select count(*) into v_count from ai_usage
         where user_id is not null and at < v_cut;

      when 'import_runs' then
        v_op := 'suppression';
        select count(*) into v_count from import_runs
         where at < v_cut;

      when 'email_trace' then
        v_op := 'effacement de champs';
        select count(*) into v_count from email_settings
         where last_send_at is not null and last_send_at < v_cut
           and (last_send_to is not null or last_send_error is not null);

      when 'audit_log' then
        v_op := 'suppression';
        select count(*) into v_count from audit_log
         where at < v_cut;

      else
        -- Une catégorie présente en table et absente ici ne purgerait
        -- rien tout en s'affichant comme active : on la NOMME plutôt que
        -- de la compter à zéro. Le cas ne peut survenir que si quelqu'un
        -- a inséré une ligne hors migration — ce qu'aucune policy ne
        -- permet aujourd'hui, et qui se verrait ainsi immédiatement.
        v_op := 'INCONNUE — aucune purge associée';
        v_count := 0;
    end case;

    category       := r.category;
    label          := r.label;
    description    := r.description;
    retention_days := r.retention_days;
    enabled        := r.enabled;
    operation      := v_op;
    -- Une catégorie décochée affiche ce qu'elle purgerait si on la
    -- cochait : c'est précisément le chiffre qu'il faut avoir sous les
    -- yeux AVANT de cocher.
    affected       := v_count;
    return next;
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- La purge
-- ------------------------------------------------------------
-- QUI PEUT L'APPELER. Deux appelants légitimes, et seulement deux :
--
--   · un administrateur plateforme, depuis l'écran — `is_admin()` ;
--   · une planification SQL (pg_cron), qui s'exécute sous `postgres` et
--     n'a AUCUN `auth.uid()` : `is_admin()` y rendrait faux.
--
-- D'où le test sur `session_user` et non sur `current_user` : dans une
-- fonction `security definer`, `current_user` vaut le PROPRIÉTAIRE de la
-- fonction — `postgres` — pour tout le monde, y compris pour un appel
-- anonyme. Le contrôle serait donc toujours vrai. `session_user`, lui,
-- garde l'identité de connexion : `authenticator` pour tout appel venu
-- de PostgREST (le rôle n'est que `set` ensuite, la session ne change
-- pas), `postgres` pour pg_cron. Un appel web ne peut donc pas se faire
-- passer pour la planification.
--
-- POURQUOI `security definer` MALGRÉ TOUT (mêmes raisons que l'aperçu,
-- en plus grave) : sans lui, `delete from notifications` sous l'identité
-- d'un administrateur ne supprimerait que SES notifications — « Own
-- notifications » (0001) filtre sur `user_id = auth.uid()` — et
-- répondrait « succès ». Un delete écarté par la RLS ne lève aucune
-- erreur : il touche zéro ligne. C'est la panne que la 0059 et la 0061
-- décrivent, ici appliquée à une obligation légale.
--
-- ET LA RLS SUR LE PROPRIÉTAIRE ? Vérifié plutôt que supposé, parce que
-- toute la purge en dépend : PostgreSQL n'applique PAS les policies au
-- propriétaire d'une table, sauf `alter table ... force row level
-- security`. Aucune migration de ce dépôt n'emploie `force` (relevé sur
-- les 55 fichiers). Les tables visées et cette fonction sont créées par
-- le même rôle dans le SQL Editor : la purge voit donc bien toutes les
-- lignes. Si un jour `force` était posé quelque part, la purge se
-- mettrait à ne rien supprimer EN SILENCE — d'où le contrôle final
-- ci-dessous, qui compare ce qui devait partir à ce qui est parti.
--
-- UN SEUL PARAMÈTRE, et pas de « qui appelle » déclaré par l'appelant.
-- La provenance (`manuel` / `planifie`) est DÉDUITE de la connexion, pas
-- reçue en argument : un paramètre `source` permettrait à une purge
-- lancée depuis l'écran de s'inscrire au journal comme planifiée, et le
-- journal cesserait de dire qui a effacé quoi. Une trace dont l'appelant
-- choisit le contenu n'est pas une trace.
create or replace function public.retention_purge(
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r         retention_policies%rowtype;
  v_cut     timestamptz;
  v_before  int;
  v_done    int;
  v_op      text;
  v_results jsonb := '[]'::jsonb;
  v_total   int := 0;
  v_source  text;
  v_user    uuid := auth.uid();
begin
  -- Ordre volontaire : on établit QUI appelle avant de regarder ce qu'il
  -- demande. Un appel non autorisé ne doit pas même lire la table des
  -- durées.
  if is_admin() then
    v_source := 'manuel';
  elsif session_user in ('postgres', 'supabase_admin') then
    -- Pas d'utilisateur derrière une planification : `by_user` restera
    -- nul, et c'est `source` qui portera le sens. Même branche pour un
    -- appel lancé à la main dans le SQL Editor : `auth.uid()` y est nul,
    -- il n'y a donc réellement personne à inscrire, et l'inscrire comme
    -- « manuel » sans auteur serait moins vrai que « planifie ».
    v_source := 'planifie';
    v_user := null;
  else
    raise exception 'Réservé aux administrateurs de la plateforme.';
  end if;

  for r in select * from retention_policies where enabled order by category loop
    v_cut := now() - make_interval(days => r.retention_days);
    v_before := 0;
    v_done := 0;

    case r.category
      when 'notifications_lues' then
        v_op := 'suppression';
        select count(*) into v_before from notifications
         where read_at is not null and read_at < v_cut;
        if not p_dry_run then
          delete from notifications where read_at is not null and read_at < v_cut;
          get diagnostics v_done = row_count;
        end if;

      when 'notifications_non_lues' then
        v_op := 'suppression';
        select count(*) into v_before from notifications
         where read_at is null and created_at < v_cut;
        if not p_dry_run then
          delete from notifications where read_at is null and created_at < v_cut;
          get diagnostics v_done = row_count;
        end if;

      when 'ai_usage_identite' then
        -- Dé-identification, pas suppression : voir l'arbitrage en tête
        -- de fichier. La ligne de dépense survit à la personne.
        v_op := 'dé-identification';
        select count(*) into v_before from ai_usage
         where user_id is not null and at < v_cut;
        if not p_dry_run then
          update ai_usage set user_id = null
           where user_id is not null and at < v_cut;
          get diagnostics v_done = row_count;
        end if;

      when 'import_runs' then
        v_op := 'suppression';
        select count(*) into v_before from import_runs where at < v_cut;
        if not p_dry_run then
          delete from import_runs where at < v_cut;
          get diagnostics v_done = row_count;
        end if;

      when 'email_trace' then
        -- L'adresse et le message du relais partent ; la DATE et le
        -- RÉSULTAT restent. Sans quoi l'écran Email afficherait « aucun
        -- envoi tenté » sur une plateforme qui écrit tous les jours —
        -- c'est-à-dire le vert trompeur que la 0046 est venue supprimer.
        v_op := 'effacement de champs';
        select count(*) into v_before from email_settings
         where last_send_at is not null and last_send_at < v_cut
           and (last_send_to is not null or last_send_error is not null);
        if not p_dry_run then
          update email_settings
             set last_send_to = null, last_send_error = null
           where last_send_at is not null and last_send_at < v_cut
             and (last_send_to is not null or last_send_error is not null);
          get diagnostics v_done = row_count;
        end if;

      when 'audit_log' then
        -- Atteignable UNIQUEMENT si un administrateur a délibérément
        -- coché cette catégorie : elle est livrée décochée, et la boucle
        -- ne parcourt que `where enabled`.
        v_op := 'suppression';
        select count(*) into v_before from audit_log where at < v_cut;
        if not p_dry_run then
          delete from audit_log where at < v_cut;
          get diagnostics v_done = row_count;
        end if;

      else
        raise exception
          'Catégorie de conservation « % » activée mais sans purge associée : '
          'elle serait annoncée aux personnes concernées sans rien effacer. '
          'Voir la migration 0064.', r.category;
    end case;

    -- Le contrôle qui rattrape une purge muette. Un `delete` ou un
    -- `update` écarté par la RLS ne lève pas d'erreur : il touche zéro
    -- ligne et répond « succès ». Sans cette comparaison, le jour où
    -- quelqu'un poserait `force row level security` sur `notifications`,
    -- l'écran continuerait d'annoncer une purge appliquée pendant que
    -- plus rien ne serait effacé. L'exception annule toute la
    -- transaction, catégories déjà traitées comprises : mieux vaut ne
    -- rien purger que de ne purger qu'à moitié en le taisant.
    if not p_dry_run and v_done <> v_before then
      raise exception
        'Purge incohérente sur « % » : % ligne(s) visée(s), % traitée(s). '
        'Cause probable : la sécurité au niveau ligne écarte silencieusement '
        'l''opération (force row level security posé sur la table, ou '
        'propriétaire différent). Rien n''a été purgé.',
        r.category, v_before, v_done;
    end if;

    v_results := v_results || jsonb_build_object(
      'categorie', r.category,
      'libelle',   r.label,
      'jours',     r.retention_days,
      'operation', v_op,
      'lignes',    case when p_dry_run then v_before else v_done end
    );
    v_total := v_total + case when p_dry_run then v_before else v_done end;
  end loop;

  -- Un essai à blanc ne s'inscrit pas au journal des purges : il n'a
  -- rien purgé, et une ligne « 0 supprimé » à chaque clic sur « Aperçu »
  -- noierait les vraies exécutions. Il rend son résultat, c'est tout.
  if p_dry_run then
    return jsonb_build_object('dry_run', true, 'total', v_total, 'categories', v_results);
  end if;

  insert into retention_runs (by_user, source, dry_run, results, total_affected)
  values (v_user, v_source, false, v_results, v_total);

  -- Trace au journal d'audit, en plus de `retention_runs`. Ce n'est pas
  -- un doublon : `retention_runs` porte le détail par catégorie et se lit
  -- depuis l'écran Administration ; `audit_log` est le registre où l'on
  -- va chercher « qu'est-ce qui a effacé des données, et sur ordre de
  -- qui ». Une purge qui n'apparaîtrait pas là serait la seule
  -- suppression de masse de l'application à ne pas y figurer.
  --
  -- Écrit seulement si quelque chose a bougé : une purge planifiée qui
  -- ne trouve rien à faire tourne tous les jours et remplirait le
  -- journal de bruit, au point de le rendre illisible — ce qui reviendrait
  -- à l'effacer par un autre moyen.
  if v_total > 0 then
    insert into audit_log (project_id, entity, entity_id, label, action, user_id, comment)
    values (
      null, 'retention', null, 'Purge des données',
      'supprime', v_user,
      case when v_source = 'planifie' then 'Purge planifiée — ' else 'Purge manuelle — ' end
      || v_total || ' ligne(s) : '
      || (select string_agg(e->>'libelle' || ' : ' || (e->>'lignes'), ' ; ')
            from jsonb_array_elements(v_results) e
           where (e->>'lignes')::int > 0)
    );
  end if;

  return jsonb_build_object('dry_run', false, 'total', v_total, 'categories', v_results);
end;
$$;

-- Même verrou que `document_has_decision` (0059) et `save_budget_line`
-- (0061), AVEC UNE LIGNE DE PLUS, et elle mérite son explication parce
-- qu'elle corrige une croyance répandue :
--
--   `revoke all ... from public` NE RETIRE PAS le droit à `anon`.
--
-- `public` est le pseudo-rôle « tout le monde par défaut » ; `anon` est
-- un rôle nommé, à qui Supabase accorde explicitement l'exécution des
-- fonctions du schéma `public` via `alter default privileges`. Vérifié
-- sur un cluster d'essai : après le seul `revoke ... from public`, l'ACL
-- de la fonction porte toujours `anon=X`. Le `revoke ... from anon`
-- ci-dessous est donc le geste qui compte, et non une redondance
-- rassurante.
--
-- Ce n'est pas la défense principale — le premier geste du corps de
-- chaque fonction est un contrôle d'identité, et un appel anonyme y est
-- refusé quoi qu'il arrive. C'est la seconde barrière : un visiteur non
-- connecté n'a aucune raison de pouvoir seulement ATTEINDRE la fonction
-- qui exporte les données d'une personne.
revoke all on function public.retention_preview() from public, anon;
grant execute on function public.retention_preview() to authenticated;
revoke all on function public.retention_purge(boolean) from public, anon;
grant execute on function public.retention_purge(boolean) to authenticated;

-- ------------------------------------------------------------
-- Comment la purge se déclenche — et pourquoi PAS automatiquement
-- ------------------------------------------------------------
-- L'application n'a AUCUN ordonnanceur : ni cron applicatif, ni file de
-- travaux, ni route appelée de l'extérieur. Deux voies étaient donc
-- ouvertes.
--
-- (A) PLANIFIER DANS LA MIGRATION, avec `create extension pg_cron` suivi
--     de `cron.schedule(...)`. Écarté, et pas par prudence de façade :
--     `pg_cron` n'est pas installé par défaut sur un projet Supabase, il
--     s'active depuis le tableau de bord, et il ne fonctionne que sur la
--     base `postgres`. Un `create extension` qui échoue dans le SQL
--     Editor fait échouer LA MIGRATION ENTIÈRE — table des durées,
--     fonctions et export compris. On perdrait tout l'outillage pour
--     avoir voulu poser la planification au même endroit. Et il y a pire
--     que l'échec : une planification posée dans une migration s'exécute
--     ensuite sans que personne ne l'ait jamais vue tourner.
--
-- (B) OUTILLER LA PURGE, LA DÉCLENCHER À LA MAIN, ET DOCUMENTER LA
--     PLANIFICATION. RETENU. La purge s'exécute depuis Administration ▸
--     Configuration ▸ Données personnelles : aperçu du nombre de lignes
--     visées, puis exécution. La date de la dernière exécution est
--     affichée sur ce même écran, et l'écran RÉCLAME quand elle date de
--     plus de trente jours — c'est ce rappel qui empêche l'outil de
--     devenir la même promesse non tenue que la phrase qu'il remplace.
--
-- CE QUE (B) COÛTE, ET IL FAUT L'ÉCRIRE : une purge manuelle qu'on
-- n'exécute jamais ne vaut pas mieux qu'une durée affichée. C'est
-- pourquoi la page /confidentialite ne promet PAS une purge automatique.
-- Elle annonce les durées, dit qu'elles sont appliquées par une purge
-- exécutée depuis l'administration, et cesse d'annoncer autre chose. La
-- planification ci-dessous fait passer de « appliquée quand on y pense »
-- à « appliquée toutes les nuits » ; tant qu'elle n'est pas posée,
-- l'écran le montre.
--
-- POUR PLANIFIER — à exécuter UNE FOIS, à la main, après avoir activé
-- l'extension `pg_cron` depuis Supabase ▸ Database ▸ Extensions. Hors
-- migration, délibérément : c'est un geste d'exploitation, il se fait en
-- connaissance de cause et se défait de la même façon.
--
--   select cron.schedule(
--     'purge-retention-solidpilot',
--     '30 3 * * *',                       -- toutes les nuits à 03 h 30 UTC
--     $cron$ select public.retention_purge(false); $cron$
--   );
--
-- Le travail s'exécute sous `postgres` : `session_user` vaut alors
-- `postgres`, la fonction l'accepte, `by_user` reste nul et `source`
-- vaut « planifie ». Les exécutions se relisent dans `cron.job_run_details`
-- ET dans `retention_runs` — la seconde table dit ce qui a été purgé, la
-- première dit si le travail a seulement démarré.
--
-- Pour arrêter la planification :
--
--   select cron.unschedule('purge-retention-solidpilot');

-- ============================================================
-- PARTIE 2 — EXPORT DES DONNÉES D'UNE PERSONNE (art. 15 et 20)
-- ============================================================
--
-- ------------------------------------------------------------
-- Qui peut l'obtenir : l'administrateur, pas la personne elle-même
-- ------------------------------------------------------------
-- L'autre choix — un bouton « Télécharger mes données » dans les
-- Préférences — est courant et séduisant. Il est écarté ici pour une
-- raison qui tient au CONTENU de l'export, pas au confort :
--
--   · l'export ne peut pas être intégralement expurgé par du code. Une
--     décision de COPIL désigne la personne et son texte a été rédigé
--     par quelqu'un d'autre ; un libellé de journal peut nommer un tiers
--     dans un cas qu'on n'a pas anticipé. L'article 15.4 du RGPD dit
--     exactement cela : le droit d'obtenir une copie ne doit pas porter
--     atteinte aux droits des tiers. Les règles posées ci-dessous
--     couvrent les cas connus ; une RELECTURE HUMAINE couvre les autres.
--     Un téléchargement en libre-service supprime cette relecture ;
--   · l'application ne sait pas re-vérifier une identité. Une demande
--     d'exercice de droits s'accompagne normalement d'une vérification,
--     et c'est le responsable de traitement qui la fait ;
--   · une demande d'accès arrive par email, à l'adresse de contact des
--     mentions légales, et c'est YCID qui doit y répondre dans le mois.
--     L'outil doit servir CETTE personne-là — celle qui rédige la
--     réponse — plutôt que d'ajouter un bouton de plus dans un écran de
--     préférences.
--
-- Conséquence assumée : la personne concernée ne se sert pas elle-même.
-- La page /confidentialite le dit dans ces termes — « adressez votre
-- demande à … » — au lieu de laisser croire à un libre-service.
--
-- ------------------------------------------------------------
-- Le piège : ne pas déverser les données d'AUTRUI
-- ------------------------------------------------------------
-- Un projet contient les noms de tous ses membres. Une requête naïve
-- « tout ce qui touche à cette personne » ramène donc l'annuaire du
-- projet, la liste des membres de son organisation, et l'identité de qui
-- a décidé quoi à son sujet. Trois règles, appliquées partout :
--
--   1. AUCUNE LISTE D'AUTRES PERSONNES. On exporte le RÔLE de la
--      personne dans un projet ou une organisation, jamais la
--      composition de l'un ou de l'autre. Les organisations et les
--      projets sont nommés — ce sont des entités, pas des personnes.
--   2. AUCUN TEXTE LIBRE RÉDIGÉ PAR UN TIERS À SON SUJET, sauf quand la
--      ligne perdrait tout sens sans lui. Concrètement : les
--      descriptions et commentaires des tâches assignées sont EXCLUS
--      (l'assignation se comprend par son titre et son échéance) ; le
--      compte rendu d'une réunion et sa liste de participants sont
--      EXCLUS ; le texte d'une décision de COPIL est INCLUS, parce que
--      « une décision vous désigne, échéance le 30/04 » sans son énoncé
--      n'est pas une information, c'est une devinette.
--   3. AUCUNE IDENTITÉ DE TIERS DANS LE JOURNAL. Deux directions à
--      traiter, et elles ne se ressemblent pas :
--        · ce que la personne a FAIT (`audit_log.user_id`) : le libellé
--          peut nommer quelqu'un d'autre — « Rôle projet : contributeur
--          → chef_projet » sur la ligne d'un collègue porte son nom en
--          `label` (projets/[id]/actions.ts). Le libellé est donc
--          remplacé par « (une autre personne) » dès que `entity_id`
--          désigne un profil qui n'est pas le sien ;
--        · ce qu'on a fait SUR elle (`audit_log.entity_id`) : l'auteur
--          est un tiers. Le fait est exporté, `user_id` ne l'est pas.
create or replace function public.export_person_data(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_out jsonb;
begin
  if not is_admin() then
    raise exception 'Réservé aux administrateurs de la plateforme.';
  end if;
  if p_user_id is null then
    raise exception 'Personne non précisée.';
  end if;
  if not exists (select 1 from profiles where id = p_user_id) then
    raise exception 'Compte introuvable.';
  end if;

  select jsonb_build_object(

    'export', jsonb_build_object(
      'genere_le', now(),
      'genere_par', (select email from profiles where id = auth.uid()),
      'personne_id', p_user_id,
      'fondement', 'RGPD, articles 15 (droit d''accès) et 20 (portabilité).',
      'portee',
        'Données à caractère personnel concernant cette personne, détenues par la '
        'plateforme Solid''Pilot. Les données des AUTRES personnes en sont exclues : '
        'aucune liste de membres, aucun texte rédigé par un tiers à son sujet sauf '
        'quand la ligne serait incompréhensible sans lui, aucune identité de tiers '
        'dans le journal.',
      'avertissement',
        'À relire avant remise. Certains textes exportés (décisions de COPIL, '
        'commentaires de validation) ont été rédigés par des personnes et peuvent, '
        'dans un cas non anticipé, en nommer d''autres.',
      'non_inclus',
        'Le contenu des pièces déposées (fichiers du stockage) n''est pas repris ici : '
        'il est remis séparément si la demande le couvre.'
    ),

    'profil', (
      select to_jsonb(x) from (
        select p.id, p.email, p.full_name, p.avatar_url,
               p.platform_role, p.active, p.can_manage_roadmap,
               p.tour_seen_at, p.created_at
          from profiles p where p.id = p_user_id
      ) x
    ),

    -- Le NOM de l'organisation, jamais ses membres.
    'organisations', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'organisation', o.name, 'type', o.type, 'pays', o.country,
               'role', m.role) order by o.name), '[]'::jsonb)
        from memberships m join organizations o on o.id = m.org_id
       where m.user_id = p_user_id
    ),

    -- Le RÔLE dans le projet, jamais l'annuaire du projet.
    'projets', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'projet', pr.name, 'pays', pr.country, 'statut', pr.status,
               'role_projet', pm.role) order by pr.name), '[]'::jsonb)
        from project_members pm join projects pr on pr.id = pm.project_id
       where pm.user_id = p_user_id
    ),

    'projets_crees', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'projet', pr.name, 'cree_le', pr.created_at) order by pr.created_at), '[]'::jsonb)
        from projects pr where pr.created_by = p_user_id
    ),

    -- Sans `description` ni `comment` : ces textes sont écrits par
    -- l'équipe et peuvent porter sur d'autres personnes. Le titre,
    -- l'échéance et l'avancement suffisent à décrire une assignation.
    'taches_assignees', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'projet', pr.name, 'phase', ph.name, 'tache', t.title,
               'statut', t.status, 'avancement', t.progress,
               'debut', t.start_date, 'echeance', t.end_date,
               'creee_le', t.created_at) order by t.created_at), '[]'::jsonb)
        from tasks t
        join phases ph on ph.id = t.phase_id
        join projects pr on pr.id = ph.project_id
       where t.assignee_id = p_user_id
    ),

    'taches_creees', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'projet', pr.name, 'tache', t.title, 'statut', t.status,
               'creee_le', t.created_at) order by t.created_at), '[]'::jsonb)
        from tasks t
        join phases ph on ph.id = t.phase_id
        join projects pr on pr.id = ph.project_id
       where t.created_by = p_user_id
    ),

    'depots', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'projet', pr.name, 'fichier', d.filename, 'type', d.type,
               'montant', d.amount, 'depose_le', d.uploaded_at) order by d.uploaded_at), '[]'::jsonb)
        from documents d left join projects pr on pr.id = d.project_id
       where d.uploaded_by = p_user_id
    ),

    -- Le commentaire est de sa main : c'est la motivation qu'elle a
    -- écrite en validant ou en refusant.
    'decisions_de_validation', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'piece', d.filename, 'organisation_sollicitee', o.name,
               'decision', v.decision, 'decide_le', v.decided_at,
               'commentaire', v.comment) order by v.decided_at), '[]'::jsonb)
        from validations v
        join documents d on d.id = v.document_id
        left join organizations o on o.id = v.org_id
       where v.decided_by = p_user_id
    ),

    -- `text` inclus : voir la règle 2 en tête de fonction.
    'decisions_copil_a_sa_charge', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'projet', pr.name, 'decision', dc.text, 'echeance', dc.due_date,
               'statut', dc.status, 'prise_le', dc.created_at) order by dc.created_at), '[]'::jsonb)
        from decisions dc join projects pr on pr.id = dc.project_id
       where dc.owner_user_id = p_user_id
    ),

    -- Ni `attendees` (liste de personnes) ni `minutes` (compte rendu
    -- portant sur tout le monde).
    'reunions_creees', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'projet', pr.name, 'reunion', mt.title, 'type', mt.kind,
               'date', mt.date) order by mt.date), '[]'::jsonb)
        from meetings mt join projects pr on pr.id = mt.project_id
       where mt.created_by = p_user_id
    ),

    'mesures_saisies', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'projet', pr.name, 'indicateur', i.name, 'periode', im.period,
               'valeur', im.value, 'commentaire', im.comment,
               'saisie_le', im.at) order by im.at), '[]'::jsonb)
        from indicator_measures im
        join indicators i on i.id = im.indicator_id
        join projects pr on pr.id = i.project_id
       where im.entered_by = p_user_id
    ),

    -- Sans `contents` : les contenus de campagne sont une production
    -- collective destinée à publication, pas une donnée personnelle.
    'campagnes_de_communication', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'projet', pr.name, 'campagne', cc.title, 'statut', cc.status,
               'lien', case when cc.responsible_id = p_user_id then 'responsable' else 'créateur' end,
               'creee_le', cc.created_at) order by cc.created_at), '[]'::jsonb)
        from comm_campaigns cc join projects pr on pr.id = cc.project_id
       where cc.responsible_id = p_user_id or cc.created_by = p_user_id
    ),

    -- Le contenu du rapport n'est pas repris : c'est de la donnée
    -- projet, produite par le modèle, pas une donnée sur la personne.
    -- Le FAIT qu'elle en ait déclenché la génération, si.
    'rapports_ia_demandes', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'projet', pr.name, 'modele', ar.model, 'demande_le', ar.created_at)
               order by ar.created_at), '[]'::jsonb)
        from ai_reports ar join projects pr on pr.id = ar.project_id
       where ar.created_by = p_user_id
    ),

    'roadmap_idees', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'titre', ia.title, 'description', ia.description, 'statut', ia.status,
               'proposee_le', ia.created_at) order by ia.created_at), '[]'::jsonb)
        from ideas ia where ia.author_id = p_user_id
    ),

    'roadmap_votes', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'idee', ia.title, 'vote_le', iv.at) order by iv.at), '[]'::jsonb)
        from idea_votes iv join ideas ia on ia.id = iv.idea_id
       where iv.user_id = p_user_id
    ),

    'roadmap_commentaires', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'idee', ia.title, 'commentaire', ic.body,
               'ecrit_le', ic.created_at) order by ic.created_at), '[]'::jsonb)
        from idea_comments ic join ideas ia on ia.id = ic.idea_id
       where ic.author_id = p_user_id
    ),

    -- Sans `errors` : ce jsonb reproduit des lignes du fichier importé,
    -- qui décrivent des tiers.
    'imports', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'type', ir.kind, 'fichier', ir.filename, 'crees', ir.created_count,
               'ignores', ir.skipped_count, 'resultat', ir.status,
               'le', ir.at) order by ir.at), '[]'::jsonb)
        from import_runs ir where ir.by_user = p_user_id
    ),

    'avis_de_revue', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'objet', rv.entity, 'etat', rv.state, 'commentaire', rv.comment,
               'le', rv.updated_at) order by rv.updated_at), '[]'::jsonb)
        from reviews rv where rv.updated_by = p_user_id
    ),

    -- `payload` inclus : c'est le message qui lui a été présenté à
    -- l'écran. Le lui restituer ne lui apprend rien qu'elle n'ait déjà
    -- reçu.
    'notifications_recues', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'type', n.type, 'contenu', n.payload, 'recue_le', n.created_at,
               'lue_le', n.read_at) order by n.created_at), '[]'::jsonb)
        from notifications n where n.user_id = p_user_id
    ),

    'appels_intelligence_artificielle', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'le', au.at, 'fonction', au.feature, 'modele', au.model,
               'jetons', au.total_tokens, 'abouti', au.ok) order by au.at), '[]'::jsonb)
        from ai_usage au where au.user_id = p_user_id
    ),

    -- Ce que la personne a fait. `label` masqué dès qu'il désigne un
    -- AUTRE profil : c'est là que le nom d'un collègue se serait glissé.
    'journal_de_ses_actions', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'le', al.at, 'projet', pr.name, 'objet', al.entity,
               'libelle', case
                 when al.entity_id is not null
                  and al.entity_id <> p_user_id
                  and exists (select 1 from profiles pf where pf.id = al.entity_id)
                 then '(une autre personne)'
                 else al.label end,
               'action', al.action, 'detail', al.comment) order by al.at), '[]'::jsonb)
        from audit_log al left join projects pr on pr.id = al.project_id
       where al.user_id = p_user_id
    ),

    -- Ce qu'on a fait SUR elle. `user_id` — l'auteur — n'est pas
    -- exporté : c'est un tiers.
    'journal_la_concernant', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'le', al.at, 'projet', pr.name, 'objet', al.entity,
               'action', al.action, 'detail', al.comment) order by al.at), '[]'::jsonb)
        from audit_log al left join projects pr on pr.id = al.project_id
       where al.entity_id = p_user_id
         and al.user_id is distinct from p_user_id
    )

  ) into v_out;

  -- L'export d'une personne EST une consultation de ses données
  -- personnelles : elle se trace, comme tout ce qui touche à une
  -- personne dans cette application. `entity_id` porte l'identifiant de
  -- la personne exportée — c'est ce qui la fera apparaître, plus tard,
  -- dans son propre `journal_la_concernant`.
  insert into audit_log (project_id, entity, entity_id, label, action, user_id, comment)
  values (null, 'personne', p_user_id,
          (select full_name from profiles where id = p_user_id),
          'archive', auth.uid(),
          'Export RGPD des données personnelles (art. 15 et 20)');

  return v_out;
end;
$$;

revoke all on function public.export_person_data(uuid) from public, anon;
grant execute on function public.export_person_data(uuid) to authenticated;

-- ============================================================
-- Ce que cette migration NE fait pas
-- ============================================================
-- · ELLE NE PURGE RIEN À L'APPLICATION. Poser la migration ne supprime
--   aucune ligne : elle installe des durées, un aperçu et un bouton. Le
--   premier passage sur une base en service trouvera des notifications
--   de plusieurs mois et des imports de plus de deux ans — c'est
--   attendu, et c'est justement pourquoi l'aperçu existe : on regarde
--   les chiffres AVANT d'exécuter.
-- · ELLE NE TOUCHE PAS À `legal_retention` (0025). Ce champ de texte
--   libre reste, et garde un sens : il énonce l'engagement d'archivage
--   d'YCID sur les données PROJETS — celles qu'on ne purge pas — devant
--   ses financeurs. Ce qui change, c'est la page qui l'affiche : elle
--   cesse de le présenter comme une durée que le logiciel applique.
-- · ELLE NE PURGE PAS `ai_reports`, `comm_campaigns`, ni aucune donnée
--   projet. Voir l'arbitrage : ce sont des livrables, pas des journaux.
-- · ELLE NE TOUCHE PAS AU SCHÉMA `auth`. Les sessions et jetons de
--   rafraîchissement relèvent de GoTrue, qui a ses propres expirations.
-- · ELLE NE SUPPRIME AUCUN COMPTE. Désactiver ou effacer une personne
--   est une opération distincte, qui se décide au cas par cas et se
--   traite depuis Administration ▸ Utilisateurs.
-- · L'ÉCRAN CONSOMMATION D'IA N'EST PAS ADAPTÉ. `getAiUsageSummary()`
--   (lib/ai-usage.ts) affiche un total « depuis toujours » compté sur
--   TOUTES les lignes d'`ai_usage`. La dé-identification retenue ici ne
--   supprimant aucune ligne, ce total reste juste — c'est même l'une des
--   raisons du choix. Aucune adaptation n'est donc nécessaire, et ce
--   paragraphe existe pour que la prochaine personne tentée de passer
--   cette catégorie en « suppression » sache ce qu'elle casserait.

-- ============================================================
-- Ordre de déploiement
-- ============================================================
-- Cette migration s'applique AVANT le déploiement applicatif qui
-- l'accompagne. Dans l'intervalle inverse — application déployée,
-- migration non appliquée — l'écran Données personnelles affiche
-- « Appliquez la migration 0064 » et la page /confidentialite retombe
-- sur son texte sans tableau de durées : elle n'annonce alors AUCUNE
-- durée appliquée, ce qui est exactement vrai tant que la migration
-- n'est pas là.
--
-- Si `PGRST202` apparaît sur `retention_preview`, `retention_purge` ou
-- `export_person_data` APRÈS application, le cache de schéma de
-- PostgREST n'a pas été rafraîchi :
-- `notify pgrst, 'reload schema';` ou un redémarrage de l'API depuis le
-- tableau de bord Supabase.

-- ============================================================
-- Contrôle
-- ============================================================
-- 1. Les deux tables et les trois fonctions sont en place, et les
--    fonctions en `security definer` avec un `search_path` fixé :
--
--      select p.proname, p.prosecdef, p.proconfig
--        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname = 'public'
--         and p.proname in ('retention_preview','retention_purge','export_person_data');
--
--    Attendu : trois lignes, `prosecdef` à true, `proconfig` contenant
--    « search_path=public ». Un `prosecdef` à false rendrait la purge
--    muette — elle ne verrait ni les notifications des autres, ni
--    `ai_usage`, et répondrait « 0 ligne » sans erreur.
--
-- 2. La catégorie `audit_log` est bien DÉSACTIVÉE. C'est le contrôle qui
--    compte le plus : une activation par mégarde détruirait la piste
--    d'audit.
--
--      select category, retention_days, enabled from retention_policies order by category;
--
--    Attendu : six lignes, `audit_log` avec `enabled` à false.
--
-- 3. L'aperçu répond, sous un compte administrateur :
--
--      select * from retention_preview();
--
--    Attendu : une ligne par catégorie, avec le nombre de lignes visées.
--    Une erreur « Réservé aux administrateurs » sur un compte qui EST
--    administrateur signale un `platform_role` non posé (voir 0037).
--
-- 4. L'essai à blanc ne détruit rien et n'inscrit rien :
--
--      select retention_purge(true);
--      select count(*) from retention_runs;
--
--    Attendu : un objet `{"dry_run": true, "total": …}`, et un compte de
--    `retention_runs` INCHANGÉ. Une ligne de plus voudrait dire que
--    l'essai à blanc écrit — donc qu'il n'est pas à blanc.
--
-- 5. La purge réelle, puis sa trace, aux deux endroits :
--
--      select retention_purge(false);
--      select at, source, total_affected, results from retention_runs order by at desc limit 1;
--      select at, entity, label, action, comment from audit_log
--       where entity = 'retention' order by at desc limit 1;
--
--    Attendu : le même total dans les trois. Une ligne dans
--    `retention_runs` sans ligne correspondante dans `audit_log` signifie
--    que la purge n'a rien trouvé à faire (total nul) — c'est normal.
--
-- 6. L'export, et le contrôle du piège. Sur une personne membre d'un
--    projet qui compte plusieurs membres :
--
--      select export_person_data('<identifiant de la personne>');
--
--    Attendu : un objet dont chaque section ne parle que d'elle. Les
--    trois vérifications qui comptent, dans cet ordre :
--      · `projets` ne contient QUE son rôle, aucune liste de membres ;
--      · `journal_de_ses_actions` ne porte aucun nom de collègue —
--        chercher « (une autre personne) » sur une base où elle a changé
--        le rôle de quelqu'un ;
--      · `journal_la_concernant` ne contient aucune clé nommant l'auteur
--        de l'action.
--
--    Puis vérifier que l'export lui-même s'est tracé :
--
--      select at, entity, label, action, comment from audit_log
--       where entity = 'personne' order by at desc limit 1;
