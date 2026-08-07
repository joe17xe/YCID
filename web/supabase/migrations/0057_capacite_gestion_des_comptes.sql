-- ============================================================
-- 0057 — Gérer les comptes sans administrer l'outil
-- ============================================================
-- Demande du Product Owner : « donner le droit à certaines personnes
-- d'ajouter des utilisateurs et d'accéder aux consoles de gestion
-- d'utilisateur ».
--
-- Aujourd'hui la seule façon de l'accorder est de poser
-- `platform_role = 'admin'`. Ce rôle ne veut pas dire « gère les
-- comptes » : il veut dire « administre l'OUTIL ». Il ouvre, du même
-- geste, la configuration (clés d'IA, SMTP, marque, mentions légales),
-- le stockage, la vision de TOUS les projets — `is_admin()` est le seul
-- raccourci global restant depuis la 0037 — et l'anonymisation, la
-- seule opération irréversible de l'application (0055).
--
-- C'est exactement la confusion que la 0037 a défaite : elle a séparé
-- l'APPARTENANCE, le PÉRIMÈTRE et la CAPACITÉ, et retiré le rôle
-- « ycid » précisément parce qu'il avait donné la console des comptes à
-- quelqu'un dont ce n'était pas la fonction. Rendre le rôle « admin »
-- pour ouvrir cette même console referait le même trajet en sens
-- inverse.
--
-- Le précédent existe et se suit à la lettre : `can_manage_roadmap`
-- (0037, l. 75) est une CAPACITÉ cochée sur le profil, distincte du
-- rôle plateforme. La gouvernance produit n'était ni un droit projet ni
-- de l'administration technique ; la gestion des comptes ne l'est pas
-- davantage. Une case à cocher exprime cela sans inventer un troisième
-- rôle intermédiaire — et sans que personne n'ait à arbitrer, dans six
-- mois, ce qu'un « demi-administrateur » a le droit de faire.
--
-- ------------------------------------------------------------
-- Ce que la capacité donne, et ce qu'elle ne donne PAS
-- ------------------------------------------------------------
-- DONNE : voir la liste des comptes ; créer un compte ; modifier nom,
-- adresse, mot de passe et statut actif d'un compte ORDINAIRE ; le
-- rattacher à des organisations (rattachement simple, `role =
-- 'membre'`) ; le supprimer s'il n'a laissé aucune trace.
--
-- NE DONNE PAS, et les trois bornes tiennent ici en SQL autant que dans
-- l'action serveur — une seule des deux ne suffirait pas, l'action
-- serveur écrit avec la clé de service (hors RLS) tandis que l'API REST
-- reste ouverte à qui possède une session :
--
--   1. PROMOUVOIR au rôle plateforme `admin` — soi-même ou autrui.
--      Sinon la case à cocher fabrique un administrateur par un autre
--      chemin, et tout ce qui précède ne vaut rien ;
--   2. ATTRIBUER une capacité de profil (celle-ci, ou l'arbitrage de la
--      roadmap). Qui distribue les droits en distribue le sien : la
--      capacité se propagerait d'elle-même, sans qu'un administrateur
--      l'ait jamais décidé ;
--   3. ANONYMISER un compte (0055). Irréversible, et déjà borné par
--      `is_admin()` dans `anonymize_profile()` — cette migration
--      s'assure surtout que la capacité n'élargit PAS `is_admin()`.
--
-- Une quatrième borne s'est imposée à l'écriture, et elle n'était pas
-- demandée : la capacité ne permet pas de TOUCHER À UN COMPTE
-- ADMINISTRATEUR. Sans elle, la borne 1 se contourne en un geste — on
-- ne se promeut pas, on change le MOT DE PASSE d'un administrateur
-- existant et on se connecte sous son nom. L'écran de gestion des
-- comptes propose ce champ ; il fallait donc fermer la cible, pas le
-- champ. Le dépôt avait déjà rendu cet arbitrage pour l'ancien rôle
-- « ycid » (« Le rôle YCID ne peut pas modifier ni créer un
-- Administrateur », user-actions.ts) : on le reprend tel quel.

-- ------------------------------------------------------------
-- 1. La case à cocher
-- ------------------------------------------------------------
alter table profiles
  add column if not exists can_manage_users boolean not null default false;

comment on column profiles.can_manage_users is
  'CAPACITÉ (pas un rôle) : gérer les comptes — créer, modifier, rattacher, désactiver. '
  'N''ouvre ni la configuration, ni le stockage, ni la vision globale des projets, '
  'ni l''anonymisation. Ne permet ni de promouvoir au rôle admin, ni de toucher à un '
  'compte administrateur, ni d''attribuer cette capacité : voir la migration 0057.';

-- ------------------------------------------------------------
-- 2. Qui la porte
-- ------------------------------------------------------------
-- Calquée sur `is_roadmap_manager()` (0037) : la capacité OU le rôle
-- administrateur. L'administrateur ne coche rien pour lui-même — il
-- gérait déjà les comptes, et devoir se cocher une case pour conserver
-- un droit qu'on avait est le genre de détail qui se découvre en
-- production, un compte à la main.
--
-- `security definer` : la fonction lit `profiles`, table dont la RLS
-- renvoie à... des policies qui appellent cette fonction. C'est la
-- récursion des 0003 et 0010, et le remède est le même.
--
-- `set search_path = public` : ces fonctions sont appelées depuis des
-- policies évaluées dans des sessions dont on ne choisit pas le
-- `search_path` (0022 l'a appris sur `handle_new_user`, appelée depuis
-- GoTrue).
create or replace function public.is_user_manager()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and (can_manage_users = true
            or coalesce(platform_role, case when is_platform_admin then 'admin' else 'user' end) = 'admin')
  );
$$;

-- Le rôle plateforme d'une LIGNE de `profiles` — pas celui de
-- l'appelant. La même expression était recopiée dans la 0037, la 0055 et
-- l'application ; elle est écrite ici une fois, parce que les policies
-- ci-dessous et le trigger doivent en dire exactement la même chose.
-- `immutable` : elle ne lit aucune table, elle traduit deux colonnes.
create or replace function public.platform_role_of(p_role text, p_flag boolean)
returns text language sql immutable as $$
  select coalesce(p_role, case when p_flag then 'admin' else 'user' end);
$$;

-- ------------------------------------------------------------
-- 3. Ce que la RLS exige aujourd'hui pour écrire dans `profiles`
-- ------------------------------------------------------------
-- Vérifié sur un cluster, pas déduit. Les policies vivantes sur
-- `profiles` sont : « Own profile » (0001 — `for all using (id =
-- auth.uid())`, donc écriture de SA SEULE ligne), et trois policies de
-- LECTURE (« Admins see all profiles » 0003, « Lead org admins see
-- profiles » 0007, « Members read profiles » 0015).
--
-- Autrement dit : PERSONNE, pas même l'administrateur, ne peut modifier
-- le profil d'autrui par l'API REST. L'écran d'administration s'en tire
-- parce qu'il écrit avec la clé de service (`adminClient()`), qui
-- contourne la RLS — et c'est aussi ce qui explique que le droit
-- n'existait nulle part en base : il n'existait que dans une action
-- serveur.
--
-- On l'écrit donc en base, pour l'administrateur ET pour le porteur de
-- la capacité, parce qu'un droit qui ne vit que dans du TypeScript
-- n'est pas opposable et disparaît au premier appel direct.
--
-- ⚠️ ET LA LEÇON DU LOT PRÉCÉDENT : un `update` écarté par une policy ne
-- lève AUCUNE erreur. Il touche zéro ligne, PostgREST répond 204, et
-- l'écran annonce « Enregistré ». Sans la policy ci-dessous, un porteur
-- de la capacité passant par l'API verrait ses modifications
-- silencieusement perdues — le pire des deux mondes, puisqu'il croirait
-- l'inverse.
--
-- POURQUOI PAS DE POLICY `insert` : créer un compte ne commence pas par
-- `profiles`. `profiles.id references auth.users(id)` (0001) — la ligne
-- naît du trigger `handle_new_user` quand GoTrue crée l'utilisateur
-- d'authentification, hors session et hors RLS. Une policy `insert`
-- serait morte : aucune ligne insérable sans un `auth.users`
-- correspondant, que seule l'API admin de GoTrue sait créer.
drop policy if exists "Manage user accounts" on profiles;
create policy "Manage user accounts" on profiles
  for update
  -- `using` : QUELLE ligne on a le droit de viser (l'ancienne).
  -- Un compte administrateur n'est pas une cible — c'est la borne 4.
  using (
    is_admin()
    or (is_user_manager()
        and platform_role_of(platform_role, is_platform_admin) <> 'admin')
  )
  -- `with check` : ce que la ligne a le droit de DEVENIR. Omettre ce
  -- volet est le défaut de la 0041, corrigé en 0045 : on contrôlait la
  -- ligne avant la mise à jour, jamais après — donc on pouvait la
  -- transformer en ce qu'on voulait. Ici il porte la borne 1 : le
  -- résultat ne peut pas être un administrateur.
  with check (
    is_admin()
    or (is_user_manager()
        and platform_role_of(platform_role, is_platform_admin) <> 'admin')
  );

-- ------------------------------------------------------------
-- 4. Le rattachement aux organisations
-- ------------------------------------------------------------
-- C'est le champ du formulaire qui décide du PÉRIMÈTRE (0037) : gérer
-- un compte sans pouvoir le rattacher, c'est créer des comptes qui ne
-- voient rien.
--
-- `role = 'membre'` n'est PAS un détail de forme, et il a été trouvé en
-- éprouvant la policy plutôt qu'en la relisant : `is_lead_org_admin()`
-- (0007) rend vrai pour un `role = 'admin_org'` dans une organisation
-- dont le nom contient « YCID » ou « LEY », et ce prédicat porte
-- « Lead admins manage project members » (0015) — l'écriture des
-- membres de TOUS les projets. Une policy ouverte sans cette borne
-- laissait donc le porteur de la capacité s'inscrire `admin_org` chez
-- YCID et devenir chef de projet partout : la borne 1 contournée par la
-- table d'à côté. Le formulaire n'écrit de toute façon que des
-- rattachements simples (`syncMemberships`).
drop policy if exists "Manage user memberships" on memberships;
create policy "Manage user memberships" on memberships
  for all
  using (is_user_manager() and role = 'membre')
  with check (is_user_manager() and role = 'membre');

-- ------------------------------------------------------------
-- 5. Le verrou qui ne dépend d'aucune policy
-- ------------------------------------------------------------
-- `protect_profile_flags` (0006, durci en 0022) garde `is_platform_admin`
-- et rien d'autre. C'était suffisant en 0006 ; ça ne l'est plus depuis
-- la 0017, qui a introduit `platform_role`, et surtout depuis la 0037,
-- où `is_admin()` LIT `platform_role` en priorité :
--
--   select coalesce(platform_role, case when is_platform_admin ...) = 'admin'
--
-- Conséquence, éprouvée sur un cluster et non supposée : « Own profile »
-- (0001) autorise chacun à écrire SA ligne, le trigger ne regardait pas
-- `platform_role`, donc N'IMPORTE QUEL COMPTE CONNECTÉ pouvait se
-- promettre administrateur d'une requête —
--
--   patch /rest/v1/profiles?id=eq.<soi>   {"platform_role":"admin"}
--
-- et `is_admin()` répondait vrai à la suivante. Le trou est ANTÉRIEUR à
-- cette migration et indépendant d'elle ; il est refermé ici parce que
-- la borne 1 s'appuie dessus, et qu'il n'aurait servi à rien de border
-- une capacité neuve en laissant la porte d'à côté ouverte. Même chose
-- pour `can_manage_roadmap`, que chacun pouvait se cocher depuis la
-- 0037.
--
-- Le trigger est le bon endroit — et le seul — pour les règles de
-- DELTA : une policy ne voit jamais l'ancienne et la nouvelle ligne
-- ensemble dans son `with check`. « Ce drapeau ne doit pas CHANGER » ne
-- s'y écrit pas ; ici, si.
--
-- `auth.uid() is null` → contexte privilégié (GoTrue au moment du
-- `handle_new_user`, clé de service). La règle vient de la 0022 et elle
-- est conservée telle quelle : la retirer casserait la création de
-- comptes. Elle dit aussi pourquoi les mêmes bornes sont RÉPÉTÉES dans
-- l'action serveur — la clé de service ne rencontre ni la RLS ni ce
-- trigger, et c'est le chemin que l'écran emprunte.
create or replace function public.protect_profile_flags()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text;
begin
  if auth.uid() is null then
    return new;
  end if;
  if is_admin() then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    if new.is_platform_admin
       or new.platform_role = 'admin'
       or new.can_manage_users
       or new.can_manage_roadmap
       or new.anonymized_at is not null then
      raise exception 'Rôle plateforme, capacités et effacement ne peuvent être attribués que par un administrateur';
    end if;
    return new;
  end if;

  -- `is distinct from` et non `<>` : `null <> 'admin'` vaut NULL, donc
  -- ni vrai ni faux, et la garde ne se déclencherait pas sur un passage
  -- depuis (ou vers) une valeur nulle — le cas des comptes antérieurs à
  -- la 0017.
  if new.is_platform_admin is distinct from old.is_platform_admin then
    v_reason := 'le drapeau is_platform_admin';
  elsif new.platform_role is distinct from old.platform_role then
    v_reason := 'le rôle plateforme';
  elsif new.can_manage_users is distinct from old.can_manage_users then
    v_reason := 'la capacité de gestion des comptes';
  elsif new.can_manage_roadmap is distinct from old.can_manage_roadmap then
    v_reason := 'la capacité d''arbitrage de la roadmap';
  elsif new.anonymized_at is distinct from old.anonymized_at then
    -- Poser la date à la main n'anonymise rien (l'identité resterait
    -- lisible) mais verrouille le compte ; la RETIRER d'une pierre
    -- tombale rouvre « Modifier », donc la ré-attribution d'une identité
    -- aux traces qu'on venait d'anonymiser. Les deux sens se ferment.
    v_reason := 'la date d''effacement RGPD';
  end if;

  if v_reason is not null then
    raise exception '% ne peut être modifié que par un administrateur', v_reason;
  end if;
  return new;
end;
$$;

-- Le trigger est déjà posé par la 0006 et `create or replace function`
-- suffit à le mettre à jour. On le repose quand même : la 0057 doit
-- pouvoir s'appliquer seule sur une base où quelqu'un aurait, un jour,
-- supprimé le trigger sans supprimer la fonction.
drop trigger if exists trg_protect_profile_flags on profiles;
create trigger trg_protect_profile_flags
  before insert or update on profiles
  for each row execute function protect_profile_flags();

-- ------------------------------------------------------------
-- 6. Une pierre tombale ne conserve aucune capacité
-- ------------------------------------------------------------
-- `anonymize_profile()` (0055) remet déjà `platform_role`,
-- `is_platform_admin` et `can_manage_roadmap` à leur valeur neutre. La
-- capacité neuve doit y figurer, sans quoi un compte anonymisé
-- continuerait de pouvoir gérer les comptes — c'est-à-dire qu'une
-- personne ayant exercé son droit à l'effacement resterait, en base,
-- gestionnaire des comptes de tous les autres.
--
-- La fonction est REPRISE ICI EN ENTIER par `create or replace`, et la
-- 0055 n'est pas touchée : une migration appliquée ne se réécrit pas
-- (règle du dépôt), sans quoi une base à jour ne verrait jamais le
-- correctif. Seule la ligne `can_manage_users` est ajoutée ; le reste
-- est identique à la 0055, dont les commentaires font foi pour le
-- détail des arbitrages.
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
  -- Inchangé, et c'est le point qui compte pour la 0057 : `is_admin()`
  -- ne connaît PAS `can_manage_users`. La capacité n'ouvre donc pas
  -- l'anonymisation, et ce n'est pas un oubli qu'il faudrait combler.
  if not is_admin() then
    raise exception 'Anonymisation réservée aux administrateurs de la plateforme.';
  end if;
  if p_user_id is null then
    raise exception 'Compte non précisé.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas anonymiser votre propre compte.';
  end if;

  select * into v_profile from profiles where id = p_user_id;
  if not found then
    raise exception 'Compte introuvable.';
  end if;
  if v_profile.anonymized_at is not null then
    raise exception 'Ce compte est déjà anonymisé (depuis le %).',
      to_char(v_profile.anonymized_at, 'DD/MM/YYYY');
  end if;

  if platform_role_of(v_profile.platform_role, v_profile.is_platform_admin) = 'admin' then
    select count(*) into v_admins
      from profiles
     where platform_role_of(platform_role, is_platform_admin) = 'admin'
       and anonymized_at is null;
    if v_admins <= 1 then
      raise exception 'Impossible d''anonymiser le dernier administrateur de la plateforme.';
    end if;
  end if;

  v_traces := profile_trace_count(p_user_id);

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
      full_name          = v_name,
      email              = v_email,
      avatar_url         = null,
      active             = false,
      platform_role      = 'user',
      is_platform_admin  = false,
      can_manage_roadmap = false,
      -- L'ajout de la 0057.
      can_manage_users   = false,
      anonymized_at      = now()
   where id = p_user_id;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Aucune ligne modifiée : l''anonymisation n''a pas eu lieu.';
  end if;

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

-- Motif de la 0055, reconduit parce que la fonction vient d'être
-- réécrite : `create or replace` conserve l'ACL existante, mais cette
-- migration doit aussi pouvoir s'appliquer à une base où la 0055 est
-- passée AVANT le correctif qui a nommé `anon`.
--
-- `anon` est nommé À CÔTÉ de `public`, et ce n'est pas une redondance :
-- sur Supabase, `revoke ... from public` ne retire RIEN à `anon`, qui
-- est un rôle réel recevant l'exécution par un `alter default
-- privileges` distinct. Le défaut a été mesuré sur un cluster et corrigé
-- dans trois migrations (0051, 0053, 0055) — après le seul `revoke from
-- public`, l'ACL portait encore `anon=X`.
revoke all on function public.anonymize_profile(uuid) from public, anon;
grant execute on function public.anonymize_profile(uuid) to authenticated;

-- Mêmes précautions pour les deux fonctions ajoutées ici. Elles ne
-- modifient rien, mais `is_user_manager()` est `security definer` et lit
-- `profiles` hors RLS : une session anonyme n'a aucune raison de
-- pouvoir l'appeler (elle rendrait faux, mais elle n'a pas à être
-- posée).
revoke all on function public.is_user_manager() from public, anon;
grant execute on function public.is_user_manager() to authenticated, service_role;
revoke all on function public.platform_role_of(text, boolean) from public, anon;
grant execute on function public.platform_role_of(text, boolean) to authenticated, service_role;

-- ------------------------------------------------------------
-- 7. Reprise
-- ------------------------------------------------------------
-- Aucune. La colonne naît à `false` pour tout le monde : la capacité
-- s'attribue compte par compte, depuis Administration ▸ Utilisateurs,
-- par un administrateur. Cocher quelqu'un ici, dans une migration,
-- reviendrait à décider à sa place — et le nom se retrouverait écrit
-- dans le dépôt, ce qui n'a rien à y faire.
