-- ============================================================
-- 0055 — On promettait l'effacement à des personnes, et la base le refusait
-- ============================================================
-- `app/confidentialite/page.tsx` annonce, en toutes lettres, à qui vient
-- lire ses droits :
--
--   « Conformément au RGPD, vous disposez de droits d'accès, de
--     rectification, D'EFFACEMENT, de limitation et d'opposition. »
--
-- Cette phrase n'est pas tenable en l'état, et il ne s'agit pas d'un
-- défaut d'écran : c'est le schéma qui s'y oppose. La 0001 a posé
--
--   audit_log.user_id uuid references profiles(id)          (l. 218)
--
-- SANS action de suppression, donc en `no action`. La même forme se
-- répète partout où l'application enregistre QUI a fait quelque chose :
-- `validations.decided_by`, `documents.uploaded_by`, `tasks.assignee_id`,
-- `tasks.created_by`, `reviews.updated_by`, `meetings.created_by`,
-- `decisions.owner_user_id`, `indicator_values.entered_by`,
-- `projects.created_by`, `organizations.created_by`,
-- `import_runs.by_user`, `ideas.author_id`, `idea_comments.author_id`.
--
-- Conséquence, vérifiable en une ligne de SQL : supprimer le compte
-- d'une personne AYANT AGI est rejeté par PostgreSQL —
--
--   update or delete on table "profiles" violates foreign key
--   constraint "audit_log_user_id_fkey" on table "audit_log"   (23503)
--
-- et l'écran Administration ▸ Utilisateurs, dont le bouton « Supprimer »
-- passe par `auth.admin.deleteUser` (le profil part alors en cascade
-- depuis `auth.users`), rend une erreur de service opaque. Le bouton
-- n'est donc PAS mort seulement dans les cas exotiques : il est mort
-- pour tout compte qui a validé, déposé, créé ou commenté quoi que ce
-- soit — c'est-à-dire pour tous ceux dont l'effacement se demande.
--
-- Une promesse d'effacement que le système ne peut pas tenir est le pire
-- des deux mondes : juridiquement exposée, et techniquement bloquée le
-- jour où quelqu'un la demande — au guichet, devant une personne qui a
-- écrit pour faire valoir un droit.

-- ------------------------------------------------------------
-- Ce qu'on ne peut pas faire, et pourquoi
-- ------------------------------------------------------------
-- La contrainte produit est tranchée, et elle ne se discute pas ici :
--
--   « Concernant les décisions, les devis, on en garde une trace. »
--
-- L'application justifie de l'argent public devant le MEAE et le
-- Département. Qui a validé un devis, qui a refusé une dépense, qui a
-- déposé une facture : cela FAIT PARTIE de la pièce justificative. Un
-- dossier où la décision subsiste sans son décideur ne vaut rien devant
-- un contrôleur, et un dossier où la décision disparaît avec son
-- décideur vaut moins encore.
--
-- Trois gestes étaient possibles.
--
-- (1) PASSER LES CLÉS EN `on delete set null`, puis supprimer la ligne
--     `profiles`. C'est le geste réflexe. Il déprend la suppression, et
--     il coûte exactement ce que le Product Owner refuse : la validation
--     reste, son auteur devient `null`. Or `null` ne veut pas dire
--     « une personne effacée » — il veut dire « on ne sait pas », ce qui
--     est déjà le sens de la colonne pour les lignes importées. Les deux
--     deviennent indiscernables, et la piste d'audit perd sa qualité de
--     piste. Écarté.
--
-- (2) SUPPRIMER POUR DE BON, en acceptant la perte. Écarté par la
--     contrainte produit ci-dessus, et par le fait qu'on ne peut pas
--     défaire ce qu'on n'a plus.
--
-- (3) ANONYMISER EN PLACE. RETENU. Le RGPD (art. 17) est satisfait
--     lorsque la donnée cesse d'être PERSONNELLE — pas lorsque la ligne
--     cesse d'exister. Le considérant 26 est explicite : un texte qui ne
--     se rapporte plus à une personne identifiée ni identifiable sort du
--     champ du règlement. Remplacer le nom, l'adresse et la photo par
--     une pierre tombale non réversible atteint ce résultat SANS toucher
--     à une seule clé étrangère : la ligne `profiles` reste, donc les
--     treize colonnes ci-dessus restent valides, donc les décisions, les
--     dépôts et le journal restent intacts et rattachés. La décision de
--     validation du 12 mars reste la décision de validation du 12 mars ;
--     son auteur devient « Utilisateur supprimé #1000 ».
--
-- Ce que (3) NE fait pas, et qu'il faut dire sans détour : il ne rend
-- pas la personne inconnue de TOUT LE MONDE. Les traces conservent son
-- identifiant technique, et une sauvegarde antérieure conserve son nom.
-- L'anonymisation vaut pour le système en service : plus aucun écran,
-- plus aucun export, plus aucune requête applicative ne peut relier ces
-- lignes à une personne nommée. C'est la forme d'effacement qu'un
-- responsable de traitement peut réellement tenir quand la même donnée
-- sert de pièce comptable — et c'est ce qu'il faut écrire dans le
-- registre des traitements, plutôt qu'un « effacement » sans réserve.

-- ------------------------------------------------------------
-- 1. Le marqueur
-- ------------------------------------------------------------
-- Une date, pas un booléen : elle dit AUSSI quand l'effacement a été
-- exercé, ce qu'un contrôleur demande avant toute autre chose (« sous un
-- mois », art. 12.3). `null` = compte ordinaire, et c'est le cas de tous
-- les comptes existants après cette migration.
--
-- Ce marqueur n'est pas décoratif : il est ce qui empêche l'écran de
-- proposer « Modifier » sur une pierre tombale — c'est-à-dire de
-- réattribuer un nom et une adresse à des traces qu'on vient
-- d'anonymiser. Une anonymisation réversible n'est pas une
-- anonymisation.
alter table profiles add column if not exists anonymized_at timestamptz;

comment on column profiles.anonymized_at is
  'Date d''exercice du droit à l''effacement (RGPD art. 17) par ANONYMISATION en place : '
  'nom, adresse et photo ont été remplacés par une pierre tombale non réversible, la ligne '
  'et toutes les clés étrangères qui la visent étant conservées. Nul = compte ordinaire. '
  'Non nul = le compte ne désigne plus personne : ne jamais lui réattribuer une identité.';

-- ------------------------------------------------------------
-- 2. Le numéro de la pierre tombale
-- ------------------------------------------------------------
-- Il faut un identifiant lisible, stable et UNIQUE — `profiles.email`
-- est `unique not null` (0001, l. 39), la pierre tombale doit donc l'être
-- aussi, sans quoi la deuxième anonymisation échoue sur la clé unique au
-- pire moment.
--
-- Trois candidats ont été pesés :
--
--   · l'UUID du compte. Unique par construction, mais illisible : un
--     « Utilisateur supprimé 8f3c1a7e-… » dans une colonne « Assigné à »
--     ne se lit pas, ne se dit pas au téléphone, et se recopie mal dans
--     un compte rendu de COPIL ;
--   · un fragment d'UUID. Lisible, mais il n'est plus unique — et
--     surtout il RE-DIVULGUE une partie de l'identifiant technique dans
--     un libellé destiné à être affiché et exporté ;
--   · une séquence dédiée. RETENU. Un numéro court, sûrement unique,
--     qui ne dit rien de la personne — pas même son ancienneté dans la
--     base, contrairement à un fragment d'UUID.
--
-- `start with 1000` : une pierre tombale « #1 » annoncerait à tous les
-- écrans qui l'affichent que cette personne est la PREMIÈRE à avoir
-- demandé son effacement. C'est peu, mais c'est déjà une information sur
-- elle, dans un libellé public à l'échelle de l'outil. Un numéro à
-- quatre chiffres se lit comme une référence de dossier, ce qu'il est.
--
-- `if not exists` : rejouer l'ensemble des migrations sur une base à
-- jour ne doit rien casser (règle du dépôt), et surtout ne doit pas
-- REMETTRE le compteur à 1000 — on réattribuerait alors des numéros
-- déjà portés, et la clé unique sur `email` refuserait l'anonymisation
-- suivante.
create sequence if not exists profiles_anonymized_seq start with 1000;

-- ------------------------------------------------------------
-- 3. Ce que le compte laisse derrière lui, compté par le catalogue
-- ------------------------------------------------------------
-- Avant d'anonymiser, l'administrateur doit voir CE QUI SERA CONSERVÉ :
-- « 42 traces au journal, 7 pièces déposées, 3 validations décidées ».
-- Sans ce chiffre, l'écran demande un geste irréversible sans en montrer
-- la portée, et l'administrateur ne peut pas répondre à la personne qui
-- lui écrit « qu'est-ce qu'il reste de moi ? ».
--
-- La liste des tables n'est PAS écrite à la main. Elle est LUE DANS LE
-- CATALOGUE : `pg_constraint` connaît, à l'instant de l'appel, toutes
-- les clés étrangères qui visent `profiles`. Une liste recopiée serait
-- juste aujourd'hui et fausse à la migration suivante — c'est exactement
-- le défaut que ce dépôt combat partout ailleurs (une seule source de
-- vérité), et il coûterait ici un compte rendu qui oublie une table.
--
-- La fonction rend aussi le nombre de traces BLOQUANTES : celles dont la
-- clé refuse la disparition du profil (`no action` / `restrict`). C'est
-- ce chiffre, et lui seul, qui dit si une suppression pure est encore
-- possible — l'écran s'en sert pour ne plus proposer un bouton
-- « Supprimer » qui échouerait à coup sûr.
--
-- `security definer` : la fonction lit des tables que l'appelant ne voit
-- pas nécessairement sous la RLS (le journal d'un projet dont il n'est
-- pas membre, par exemple). Un `security invoker` rendrait un compte
-- PARTIEL — « 3 traces » au lieu de 42 — c'est-à-dire un chiffre faux
-- présenté comme un inventaire, juste avant une opération irréversible.
-- C'est le même raisonnement que la 0051 : un droit de lecture manquant
-- ne doit pas se lire comme « rien à conserver ». Le privilège est donc
-- nécessaire, et il est immédiatement borné par `is_admin()`.
--
-- Le SQL dynamique n'expose à aucune injection : les deux identifiants
-- interpolés viennent du catalogue, jamais de l'appelant, et passent par
-- `%I`. Le seul paramètre venu de l'extérieur reste lié (`using`).
create or replace function public.profile_trace_count(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r          record;
  n          bigint;
  v_detail   jsonb  := '{}'::jsonb;
  v_total    bigint := 0;
  v_blocking bigint := 0;
begin
  if not is_admin() then
    raise exception 'Inventaire des traces réservé aux administrateurs de la plateforme.';
  end if;
  if p_user_id is null then
    return jsonb_build_object('total', 0, 'blocking', 0, 'detail', '{}'::jsonb);
  end if;

  for r in
    select src.relname::text  as table_name,
           att.attname::text  as column_name,
           c.confdeltype      as on_delete
      from pg_constraint c
      join pg_class     src on src.oid = c.conrelid
      join pg_namespace ns  on ns.oid  = src.relnamespace
      join pg_attribute att on att.attrelid = c.conrelid and att.attnum = c.conkey[1]
     where c.contype   = 'f'
       and c.confrelid = 'public.profiles'::regclass
       and ns.nspname  = 'public'
       -- Clés composites exclues : il n'en existe aucune vers `profiles`,
       -- et en compter une avec `conkey[1]` seul donnerait un chiffre faux.
       and array_length(c.conkey, 1) = 1
     order by src.relname, att.attname
  loop
    execute format('select count(*) from public.%I where %I = $1', r.table_name, r.column_name)
       into n using p_user_id;
    if n > 0 then
      v_detail := v_detail || jsonb_build_object(r.table_name || '.' || r.column_name, n);
      v_total  := v_total + n;
      -- 'a' = no action, 'r' = restrict : ces deux-là REFUSENT la
      -- disparition du profil. 'c' (cascade), 'n' (set null) et
      -- 'd' (set default) l'acceptent — elles ne bloquent rien, mais
      -- elles emporteraient ou détacheraient les lignes concernées.
      if r.on_delete in ('a', 'r') then v_blocking := v_blocking + n; end if;
    end if;
  end loop;

  return jsonb_build_object('total', v_total, 'blocking', v_blocking, 'detail', v_detail);
end;
$$;

-- ------------------------------------------------------------
-- 4. L'anonymisation elle-même
-- ------------------------------------------------------------
-- UNE SEULE ligne est modifiée : le profil. Rien n'est supprimé nulle
-- part — ni les traces, ni les notifications reçues, ni les
-- rattachements aux organisations et aux projets. C'est délibéré et
-- c'est ce qui rend la fonction défendable : une fois le profil devenu
-- une pierre tombale, tout ce qui pointe vers lui a CESSÉ de désigner
-- une personne. Supprimer en plus des notifications ou des
-- rattachements détruirait de l'histoire (« qui était sur ce projet »)
-- sans rien retirer de personnel — de la destruction gratuite, dans une
-- opération qu'on ne peut pas défaire.
--
-- `security definer`, et il faut le justifier parce que le dépôt s'est
-- imposé de le faire (0053) : AUCUNE policy ne permet à un administrateur
-- de modifier le profil d'AUTRUI. « Own profile » (0001) couvre
-- `id = auth.uid()`, les trois autres sont des `select`. C'est d'ailleurs
-- pourquoi `user-actions.ts` passe par la clé de service pour écrire un
-- profil. Un `security invoker` ici ne modifierait donc rien du tout —
-- et, pire, un `update` écarté par la RLS ne lève aucune erreur : il
-- toucherait zéro ligne et répondrait « succès ». L'écran annoncerait
-- l'effacement d'un compte intact.
--
-- Le privilège est borné par trois refus, dans cet ordre : administrateur
-- de plateforme, pas soi-même, pas le dernier administrateur. Ces refus
-- DOUBLENT ceux de l'action serveur et ne sont pas décoratifs — la
-- fonction est atteignable directement par PostgREST, avec l'identifiant
-- de compte de son choix, par n'importe quel compte authentifié.
--
-- `set search_path = public`, comme toutes les fonctions de ce dépôt
-- depuis la 0022.
--
-- AUCUN bloc `exception` : il ouvrirait une sous-transaction et pourrait
-- laisser passer une anonymisation à moitié faite. Tout échoue ou tout
-- s'applique, en un seul aller-retour.
create or replace function public.anonymize_profile(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile   profiles%rowtype;
  v_admins    int;
  v_traces    jsonb;
  v_candidate bigint;
  v_number    bigint;
  v_name      text;
  v_email     text;
  v_updated   int;
begin
  if not is_admin() then
    raise exception 'Anonymisation réservée aux administrateurs de la plateforme.';
  end if;
  if p_user_id is null then
    raise exception 'Compte non précisé.';
  end if;
  -- Se retirer soi-même reviendrait à supprimer l'administrateur qui
  -- tient le geste en cours, et à écrire ensuite une trace sous une
  -- identité qui vient d'être effacée.
  if p_user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas anonymiser votre propre compte.';
  end if;

  select * into v_profile from profiles where id = p_user_id;
  if not found then
    raise exception 'Compte introuvable.';
  end if;
  -- Rejouer l'opération réattribuerait un NOUVEAU numéro à une pierre
  -- tombale existante : les traces changeraient de nom sans raison, et
  -- l'ancien libellé, déjà recopié dans des comptes rendus, ne
  -- correspondrait plus à rien.
  if v_profile.anonymized_at is not null then
    raise exception 'Ce compte est déjà anonymisé (depuis le %).',
      to_char(v_profile.anonymized_at, 'DD/MM/YYYY');
  end if;

  -- Le dernier administrateur : l'anonymiser retirerait à la plateforme
  -- toute possibilité d'administration — y compris celle de créer son
  -- remplaçant. Même garde-fou que `deleteUser`, ici parce que la
  -- fonction s'atteint sans passer par l'écran. Les comptes DÉJÀ
  -- anonymisés ne comptent pas : ils ne peuvent plus se connecter.
  if coalesce(v_profile.platform_role,
              case when v_profile.is_platform_admin then 'admin' else 'user' end) = 'admin' then
    select count(*) into v_admins
      from profiles
     where coalesce(platform_role, case when is_platform_admin then 'admin' else 'user' end) = 'admin'
       and anonymized_at is null;
    if v_admins <= 1 then
      raise exception 'Impossible d''anonymiser le dernier administrateur de la plateforme.';
    end if;
  end if;

  -- Compté AVANT : c'est ce que la trace d'audit dira avoir été
  -- conservé. Après coup le chiffre serait le même — rien n'est
  -- supprimé — mais le relever ici garantit qu'il décrit bien l'état sur
  -- lequel la décision a été prise.
  v_traces := profile_trace_count(p_user_id);

  -- L'adresse de la pierre tombale doit tenir trois exigences à la fois :
  --
  --   · UNIQUE — `profiles.email` l'exige (0001, l. 39) ;
  --   · ne RESSEMBLER à aucune adresse réelle, faute de quoi un envoi de
  --     courriel automatique (relance de validation, invitation) pourrait
  --     partir vers une boîte qui existe et appartient à un tiers ;
  --   · rester SYNTAXIQUEMENT une adresse. C'est la contrainte qui
  --     tranche : la même valeur est portée dans `auth.users.email` par
  --     l'action serveur, et GoTrue refuse une adresse mal formée. Une
  --     pierre tombale sans arobase obligerait à en tenir deux
  --     différentes, donc à pouvoir diverger.
  --
  -- « .invalid » est réservé par la RFC 2606 §2 précisément pour cet
  -- usage : ce domaine de premier niveau ne peut être ni délégué ni
  -- enregistré, aucun résolveur ne lui répondra jamais. L'adresse est
  -- donc une adresse pour la grammaire, et une impasse pour le réseau.
  --
  -- POURQUOI UNE BOUCLE plutôt qu'un simple `nextval`. La séquence rend
  -- des valeurs uniques, mais elle peut se retrouver EN ARRIÈRE des
  -- données : restauration d'une sauvegarde logique (`pg_dump` rétablit
  -- la valeur courante d'une séquence, pas un `setval` postérieur à
  -- l'extraction), remise à zéro manuelle, copie d'une base de recette
  -- vers une autre. Éprouvé sur un cluster jetable, et ce n'est pas
  -- théorique : après un `alter sequence … restart`, l'`update`
  -- ci-dessous échoue sur
  --
  --   duplicate key value violates unique constraint "profiles_email_key"
  --
  -- c'est-à-dire un message de contrainte brut, au milieu d'une
  -- opération irréversible, sur un écran d'administration. On avance
  -- jusqu'au premier numéro libre plutôt que d'échouer. La course entre
  -- ce test et l'`update` n'existe pas en pratique : deux appels
  -- simultanés reçoivent deux valeurs différentes de `nextval`, qui ne
  -- revient jamais en arrière, même en cas d'annulation.
  for i in 1..1000 loop
    v_candidate := nextval('profiles_anonymized_seq');
    v_email     := 'utilisateur-supprime-' || v_candidate || '@anonyme.invalid';
    if not exists (select 1 from profiles where email = v_email) then
      v_number := v_candidate;
      exit;
    end if;
  end loop;
  if v_number is null then
    raise exception 'Aucun numéro de pierre tombale disponible après 1000 essais : la séquence '
      'profiles_anonymized_seq est très en arrière des comptes déjà anonymisés. '
      'La recaler (la requête figure au bas de la migration 0055), puis recommencer.';
  end if;
  v_name := 'Utilisateur supprimé #' || v_number;

  update profiles set
      full_name         = v_name,
      email             = v_email,
      -- La photo de profil est une donnée personnelle à elle seule. La
      -- colonne est vidée ICI ; le FICHIER, lui, ne peut pas l'être
      -- depuis SQL — voir la note « le fichier d'avatar » plus bas.
      avatar_url        = null,
      -- Le verrou applicatif immédiat : `app/(app)/layout.tsx` déconnecte
      -- et redirige tout compte dont `active` est faux, à la première
      -- navigation. La personne perd donc l'accès à l'application dès
      -- cette transaction, avant même que le compte d'authentification
      -- soit bloqué par l'action serveur.
      active            = false,
      -- Une pierre tombale ne conserve aucun pouvoir : ni administration
      -- de la plateforme, ni arbitrage de la roadmap. Sans cela, un
      -- compte anonymisé continuerait de figurer parmi les
      -- administrateurs — et de compter comme tel dans le garde-fou du
      -- « dernier administrateur ».
      platform_role     = 'user',
      is_platform_admin = false,
      can_manage_roadmap = false,
      anonymized_at     = now()
   where id = p_user_id;

  -- Ceinture et bretelles : la ligne vient d'être lue, elle existe, et
  -- `security definer` échappe à la RLS. Un zéro ici signalerait une
  -- réécriture de cette fonction en `security invoker` — auquel cas
  -- l'appelant lirait « compte anonymisé » sur un compte intact.
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Aucune ligne modifiée : l''anonymisation n''a pas eu lieu.';
  end if;

  -- Ce que l'appelant ne peut pas déduire par lui-même, et dont il a
  -- besoin pour la suite : le numéro attribué (il vient d'une séquence),
  -- l'adresse à porter dans `auth.users`, et le fait qu'un fichier
  -- d'avatar reste à supprimer du bucket.
  return jsonb_build_object(
    'user_id',    p_user_id,
    'number',     v_number,
    'full_name',  v_name,
    'email',      v_email,
    'had_avatar', v_profile.avatar_url is not null,
    'traces',     v_traces
  );
end;
$$;

-- Même verrou que `document_has_decision` (0051) et `save_budget_line`
-- (0053) : ces fonctions ne sont offertes qu'aux comptes authentifiés.
-- Ici ce n'est pas une formalité — elles sont `security definer`, donc
-- hors RLS, et l'une des deux anonymise. Leur seule défense de fond est
-- `is_admin()`, qui rend faux pour un appelant sans session ; ce
-- `revoke` fait qu'il n'a même pas à le rendre.
--
-- `anon` est NOMMÉ, et ce n'est pas une redondance. On a d'abord écrit
-- ici que « `public` inclut le rôle `anon` » : c'est FAUX sur Supabase,
-- et l'erreur a été prise en flagrant délit sur un cluster d'essai (la
-- migration 0056 l'a mesurée). `public` est le pseudo-rôle par défaut ;
-- `anon` est un rôle réel à qui la plateforme accorde l'exécution par un
-- `alter default privileges` distinct. Après le seul
-- `revoke ... from public`, l'ACL portait encore `anon=X` — le verrou
-- que ce commentaire décrivait n'existait pas.
revoke all on function public.profile_trace_count(uuid) from public, anon;
grant execute on function public.profile_trace_count(uuid) to authenticated;

revoke all on function public.anonymize_profile(uuid) from public, anon;
grant execute on function public.anonymize_profile(uuid) to authenticated;

-- ------------------------------------------------------------
-- Le compte d'authentification : l'ordre des opérations
-- ------------------------------------------------------------
-- C'est le point où une bonne intention détruit tout, et il vaut d'être
-- écrit ici plutôt que dans un fichier de code :
--
--   profiles.id uuid primary key references auth.users(id) ON DELETE CASCADE
--
-- SUPPRIMER L'UTILISATEUR AUTH EMPORTE DONC LE PROFIL. Toute la
-- construction ci-dessus — la pierre tombale, les clés étrangères
-- gardées valides, les décisions qui gardent leur auteur — s'effondre
-- sur un « Delete user » cliqué dans le tableau de bord Supabase.
--
-- La base se défend, et il faut savoir jusqu'où : la cascade vers
-- `profiles` se heurte immédiatement à `audit_log_user_id_fkey`, qui est
-- en `no action`. Pour un compte AYANT AGI, la suppression échoue donc
-- toute entière (23503) et rien n'est perdu. Pour un compte n'ayant
-- jamais rien fait, elle RÉUSSIT et emporte la pierre tombale. Le
-- garde-fou existe, mais il ne couvre pas le cas où l'on croit ne rien
-- risquer.
--
-- L'action serveur ne supprime donc JAMAIS le compte d'authentification.
-- Elle le neutralise, en trois gestes qui laissent la ligne en place :
--
--   1. l'adresse d'`auth.users` est remplacée par la MÊME pierre tombale
--      que le profil (`utilisateur-supprime-N@anonyme.invalid`) : sans
--      cela, l'adresse réelle de la personne survivrait dans le schéma
--      `auth`, où aucun écran ne la montre et où personne ne penserait
--      à la chercher — c'est-à-dire l'endroit le plus dangereux ;
--   2. le mot de passe est remplacé par une valeur aléatoire que
--      personne ne connaît : l'ancien ne vaut plus rien, y compris pour
--      qui l'aurait noté ;
--   3. le compte est banni (`ban_duration`), ce qui interdit toute
--      nouvelle connexion et tout renouvellement de jeton.
--
-- Un jeton d'accès déjà émis reste techniquement valide jusqu'à son
-- expiration (une heure par défaut). Ce n'est pas une brèche ici : le
-- profil porte `active = false` depuis la transaction ci-dessus, et
-- `app/(app)/layout.tsx` déconnecte le porteur à la première navigation.
--
-- MARCHE À SUIVRE, dans l'ordre, pour l'administrateur :
--   a. Administration ▸ Utilisateurs ▸ « Anonymiser », recopier
--      l'identité affichée, confirmer. Tout ce qui précède est fait par
--      l'application, dans cet ordre.
--   b. NE PAS supprimer ensuite le compte depuis le tableau de bord
--      Supabase (Authentication ▸ Users ▸ Delete user). C'est inutile —
--      l'adresse y est déjà une pierre tombale, le mot de passe est
--      perdu, le compte est banni — et c'est la seule manœuvre capable
--      de détruire ce qu'on vient de construire.
--   c. Répondre à la personne. Ce qui subsiste est décrit dans la trace
--      d'audit écrite par l'opération, et se relit :
--
--        select at, label, comment from audit_log
--         where entity = 'profile' and action = 'supprime'
--         order by at desc;

-- ------------------------------------------------------------
-- Le fichier d'avatar
-- ------------------------------------------------------------
-- La photo d'une personne est une donnée personnelle : elle doit partir,
-- et vider `profiles.avatar_url` ne la fait pas partir. Le fichier vit
-- dans le bucket `avatars`, sous `avatars/<identifiant>/avatar.<ext>`
-- (voir `components/preferences/AvatarUploader.tsx`).
--
-- Cette migration ne le supprime PAS, et c'est un arbitrage, pas un
-- oubli : `delete from storage.objects` retire la LIGNE du catalogue
-- sans retirer l'objet du magasin de fichiers. On croirait avoir effacé
-- une photo qui reste servie. Seule l'API Storage supprime réellement
-- les deux — c'est donc l'action serveur qui s'en charge, avec la clé de
-- service.
--
-- POINT D'ATTENTION, SIGNALÉ ET NON CORRIGÉ (hors périmètre) : le bucket
-- `avatars` est PUBLIC (0009 : `values ('avatars','avatars', true)`) et
-- le chemin d'un fichier se déduit de l'identifiant du compte. Toute
-- photo de profil est donc lisible sans authentification par qui connaît
-- cet identifiant, et une copie peut subsister quelque temps dans le
-- cache du CDN après suppression. À trancher séparément.

-- ------------------------------------------------------------
-- Ce que cette migration NE fait pas
-- ------------------------------------------------------------
-- · AUCUNE REPRISE, et rien à reprendre : personne n'a jamais pu être
--   effacé, donc aucun compte n'est dans un état intermédiaire.
-- · AUCUNE CLÉ ÉTRANGÈRE N'EST TOUCHÉE. C'est le fond du choix (3) :
--   `audit_log.user_id` reste en `no action`, et cette contrainte
--   devient une PROTECTION assumée plutôt qu'un défaut — c'est elle qui
--   refuse la suppression d'un compte ayant agi, y compris depuis le
--   tableau de bord Supabase.
-- · AUCUNE POLICY N'EST TOUCHÉE. Un profil anonymisé reste lisible par
--   tout compte authentifié, comme les autres (0015) : c'est ce qui
--   permet à la pierre tombale de s'afficher partout où la personne
--   apparaissait, au lieu de laisser des cases vides.
-- · LE TEXTE DE `app/confidentialite/page.tsx` N'EST PAS CORRIGÉ ICI.
--   La phrase citée en tête reste à ajuster — l'effacement est réel,
--   mais il prend la forme d'une anonymisation, et les traces de
--   décision sont conservées au titre de l'obligation comptable
--   (art. 17.3.b). C'est une décision de rédaction juridique, pas de
--   schéma, et cet écran appartient à un autre chantier.
-- · AUCUN EFFACEMENT AUTOMATIQUE. L'anonymisation est un geste
--   d'administrateur, tracé, jamais une conséquence d'un délai qui
--   s'écoule.

-- ------------------------------------------------------------
-- Ordre de déploiement
-- ------------------------------------------------------------
-- Cette migration s'applique AVANT le déploiement applicatif qui
-- l'accompagne. Dans l'intervalle inverse — application déployée,
-- migration non appliquée — l'appel échoue proprement : PostgREST rend
-- `PGRST202` (« Could not find the function public.anonymize_profile …
-- in the schema cache »), et l'action affiche une phrase qui nomme ce
-- fichier. Rien n'est modifié : c'est un blocage, pas une perte.
--
-- Si `PGRST202` persiste APRÈS application, le cache de schéma de
-- PostgREST n'a pas été rafraîchi : `notify pgrst, 'reload schema';` ou
-- un redémarrage de l'API depuis le tableau de bord Supabase.

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
-- 1. Les deux fonctions sont là, en `security definer` (`prosecdef`
--    vrai), avec leur `search_path` :
--
--      select p.proname, p.prosecdef, p.proconfig
--        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname = 'public'
--         and p.proname in ('anonymize_profile', 'profile_trace_count');
--
--    Attendu : deux lignes, `prosecdef` vrai, `proconfig` contenant
--    « search_path=public ». Un `prosecdef` faux signale une réécriture
--    qui a ignoré l'arbitrage ci-dessus : la fonction ne modifierait
--    plus rien, en répondant « succès ».
--
-- 2. Puis, dans l'application, sur un compte d'essai AYANT AGI (créer
--    une tâche suffit à écrire une trace). Relever son identifiant
--    AVANT : il ne sera plus retrouvable par son nom.
--
--      select full_name, email, active, anonymized_at
--        from profiles where id = '<identifiant>';
--
--    Attendu après anonymisation : « Utilisateur supprimé #1000 »,
--    « utilisateur-supprime-1000@anonyme.invalid », `active` faux,
--    `anonymized_at` renseigné.
--
-- 3. Les traces ont SURVÉCU, et c'est le seul contrôle qui prouve
--    quelque chose :
--
--      select count(*) from audit_log where user_id = '<identifiant>';
--
--    Attendu : le même nombre qu'avant. Zéro = les traces ont été
--    perdues, ce que cette migration existe précisément pour empêcher.
--
-- 4. La trace de l'anonymisation ne contient AUCUNE donnée personnelle —
--    à relire des yeux, c'est le piège classique :
--
--      select label, comment from audit_log
--       where entity = 'profile' and action = 'supprime'
--       order by at desc limit 1;
--
--    Attendu : le libellé nomme « Utilisateur supprimé #1000 » et
--    l'identifiant technique. L'ancien nom ou l'ancienne adresse qui y
--    figureraient rendraient l'anonymisation nulle : elle se relirait
--    dans la trace même qui l'enregistre.
--
-- 5. La suppression reste impossible, et c'est voulu :
--
--      delete from profiles where id = '<identifiant>';
--
--    Attendu : `violates foreign key constraint "audit_log_user_id_fkey"`.
--    Si la commande PASSE, c'est que le compte n'avait laissé aucune
--    trace — l'anonymisation était alors superflue, pas fausse.
--
-- 6. EN CAS DE RESTAURATION D'UNE SAUVEGARDE, et seulement dans ce cas :
--    vérifier que la séquence est bien EN AVANT des numéros déjà
--    attribués. Sinon l'anonymisation suivante parcourt des numéros déjà
--    pris avant d'en trouver un libre (elle aboutit, mais laisse un trou
--    dans la numérotation), et au-delà de mille elle refuse.
--
--      select last_value from profiles_anonymized_seq;
--      select max(substring(email from 'utilisateur-supprime-(\d+)@')::bigint)
--        from profiles where anonymized_at is not null;
--
--    Si la première valeur n'est pas supérieure à la seconde, recaler :
--
--      select setval('profiles_anonymized_seq',
--        (select coalesce(max(substring(email from 'utilisateur-supprime-(\d+)@')::bigint), 999)
--           from profiles where anonymized_at is not null));
