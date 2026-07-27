-- ============================================================
-- 0045 — La policy d'ordre se mordait la queue
-- ============================================================
-- Constat de recette, 27/07, premier essai réel du circuit à deux
-- échelons : cliquer sur « Valider » renvoyait
--
--   infinite recursion detected in policy for relation "validations"
--
-- Aucune décision n'était donc possible. Ni au porteur, ni au
-- coordinateur, ni à l'administrateur en recours. Le circuit livré en
-- 0041 était inopérant de bout en bout.
--
-- Cause : la policy « Decide validation » posée en 0041 interrogeait
-- `validations` dans son propre corps, pour vérifier qu'aucun échelon
-- antérieur ne restait en attente. PostgreSQL applique la RLS à cette
-- lecture interne aussi — laquelle rappelle la même policy, qui relit
-- la table, sans fin. Le moteur détecte la boucle et refuse.
--
-- Ce n'est pas une subtilité rare : c'est la même erreur que les 0003 et
-- 0010, corrigées sur `profiles` puis sur les memberships. La règle qui
-- s'en dégage, et qu'il faut tenir : **une policy ne lit jamais sa
-- propre table directement.** Elle passe par une fonction
-- `security definer`, qui n'est pas soumise à la RLS.
--
-- Pourquoi la recette ne l'avait pas vu : elle s'est faite sur la
-- Coordination, où l'organisation porteuse et le coordinateur sont la
-- même — un seul échelon. Mais la boucle ne dépend pas du nombre de
-- lignes : elle est déclenchée à l'évaluation, même sur une chaîne à un
-- échelon. Le vrai motif est plus simple, et plus embarrassant : depuis
-- la 0041, personne n'avait cliqué sur « Valider ».

-- ------------------------------------------------------------
-- 1. L'ordre, calculé hors RLS
-- ------------------------------------------------------------
-- La fonction ne divulgue rien : elle répond « l'échelon précédent
-- a-t-il signé ? » par oui ou non, sur un document dont l'appelant
-- détient déjà l'identifiant. Aucune donnée ne sort.
create or replace function public.validation_step_is_open(doc_id uuid, at_step smallint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from validations prev
     where prev.document_id = doc_id
       and prev.step < at_step
       and prev.decision is distinct from 'valide'
  );
$$;

revoke all on function public.validation_step_is_open(uuid, smallint) from public;
grant execute on function public.validation_step_is_open(uuid, smallint) to authenticated;

-- ------------------------------------------------------------
-- 2. La policy, sans auto-lecture
-- ------------------------------------------------------------
-- Règle inchangée sur le fond, y compris le `with check` que la 0041
-- avait omis : sans lui, une mise à jour pouvait déplacer une ligne
-- vers un état que la clause `using` n'aurait plus autorisé — on
-- contrôlait la ligne avant, jamais après.
drop policy if exists "Decide validation" on validations;
create policy "Decide validation" on validations
  for update
  using (
    public.validation_step_is_open(document_id, step)
    and (
      -- Cas normal : membre de l'organisation sollicitée.
      exists (
        select 1 from memberships m
         where m.user_id = auth.uid() and m.org_id = validations.org_id
      )
      -- Recours d'exploitation, réservé au rôle « admin » (0036).
      or exists (
        select 1 from profiles p
         where p.id = auth.uid()
           and coalesce(p.platform_role, case when p.is_platform_admin then 'admin' else 'user' end) = 'admin'
      )
    )
  )
  with check (
    public.validation_step_is_open(document_id, step)
    and (
      exists (
        select 1 from memberships m
         where m.user_id = auth.uid() and m.org_id = validations.org_id
      )
      or exists (
        select 1 from profiles p
         where p.id = auth.uid()
           and coalesce(p.platform_role, case when p.is_platform_admin then 'admin' else 'user' end) = 'admin'
      )
    )
  );

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
-- Doit renvoyer une ligne, et son corps ne doit plus contenir
-- « from validations » :
--
--   select policyname, qual
--     from pg_policies
--    where tablename = 'validations' and policyname = 'Decide validation';
--
-- Et, connecté comme le membre de l'organisation sollicitée, la
-- décision doit passer sans erreur de récursion.
