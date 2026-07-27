-- ============================================================
-- 0043 — Mesurer ce que l'IA consomme, et ce qu'elle coûte
-- ============================================================
-- Constat du 27/07 : l'application appelle un fournisseur d'IA payant à
-- l'usage, et ne sait pas ce qu'elle consomme.
--
--   · `lib/llm.ts` récupère bien les jetons renvoyés par le fournisseur,
--     mais SEUL le rapport d'expert en garde une trace
--     (`ai_reports.tokens`) ;
--   · la génération des contenus de communication appelle l'IA et
--     n'enregistre rien ;
--   · seul le TOTAL est conservé — or la sortie coûte trois à huit fois
--     l'entrée selon les fournisseurs. Un total ne permet donc pas de
--     calculer un coût ;
--   · aucun écran n'affiche quoi que ce soit.
--
-- Autrement dit : une dépense engagée automatiquement, sans compteur.
-- C'est exactement le genre de chose qu'on découvre sur une facture.

create table if not exists ai_usage (
  id uuid primary key default uuid_generate_v4(),
  at timestamptz not null default now(),
  -- Qui, et pour quoi. `project_id` est nullable : le test de connexion
  -- depuis l'administration ne relève d'aucun projet.
  user_id uuid references profiles(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  -- 'rapport' | 'campagne' | 'test' | autre. Texte libre plutôt qu'enum :
  -- une fonctionnalité nouvelle ne doit pas exiger une migration pour
  -- être comptée — sans quoi elle ne le serait pas, comme aujourd'hui.
  feature text not null,
  model text,
  -- Séparés, parce que leurs tarifs le sont.
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  total_tokens int not null default 0,
  -- Un appel en échec consomme quand même des jetons d'entrée : le
  -- compter permet de voir ce que coûtent les tentatives ratées.
  ok boolean not null default true,
  truncated boolean not null default false
);

create index if not exists ai_usage_at_idx on ai_usage (at desc);
create index if not exists ai_usage_feature_idx on ai_usage (feature, at desc);

alter table ai_usage enable row level security;

-- Lecture réservée aux administrateurs : la consommation d'IA est une
-- donnée d'exploitation, au même titre que le stockage.
drop policy if exists "Admins read ai usage" on ai_usage;
create policy "Admins read ai usage" on ai_usage for select using (is_admin());

-- Aucune policy d'insertion : l'écriture passe par la clé service, comme
-- les notifications. Un utilisateur ne doit pas pouvoir fabriquer ni
-- effacer une ligne de consommation — ce serait un compteur qu'on peut
-- truquer, donc pas un compteur.

-- ------------------------------------------------------------
-- Tarifs et budget
-- ------------------------------------------------------------
-- Les prix ne sont pas devinables : ils dépendent du fournisseur, du
-- modèle, et changent. On ne les met donc pas en dur — ils se saisissent,
-- et le coût affiché est une ESTIMATION assumée comme telle.
--
-- Le budget mensuel, lui, ne bloque rien pour l'instant : il sert de
-- repère et d'alerte. Interrompre une génération de rapport la veille
-- d'un COPIL parce qu'un plafond est atteint serait pire que la dépense
-- évitée — cette décision revient à YCID, pas au code.
alter table ai_settings
  add column if not exists price_input_per_million numeric not null default 0,
  add column if not exists price_output_per_million numeric not null default 0,
  add column if not exists monthly_budget numeric not null default 0,
  add column if not exists currency text not null default 'EUR';

-- ------------------------------------------------------------
-- Reprise de l'historique connu
-- ------------------------------------------------------------
-- Les rapports déjà générés portent un total de jetons. On ne connaît
-- pas leur répartition entrée/sortie — elle n'a jamais été enregistrée —
-- donc tout est porté en entrée, et signalé comme tel : l'estimation de
-- coût sur cette période sera BASSE. Mieux vaut un historique incomplet
-- et daté qu'un historique inventé.
insert into ai_usage (at, user_id, project_id, feature, model, prompt_tokens, completion_tokens, total_tokens, ok)
select r.created_at, r.created_by, r.project_id, 'rapport (historique)', r.model,
       coalesce(r.tokens, 0), 0, coalesce(r.tokens, 0), true
  from ai_reports r
 where r.tokens is not null
   and not exists (select 1 from ai_usage u where u.feature = 'rapport (historique)' and u.at = r.created_at);
