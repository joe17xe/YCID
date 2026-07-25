-- ============================================================
-- Correctif 38b — qui peut décider d'une validation
-- ============================================================
-- Constaté en recette : un compte de rôle YCID a pu valider un devis
-- adressé à « Libanais en Yvelines ». La décision s'enregistre alors
-- sous l'organisation LEY, sans que rien n'indique qu'une autre
-- organisation a tranché à sa place.
--
-- Cause : la policy posée en 0030 admettait `is_admin()`, vrai pour
-- tout membre `admin_org` d'une organisation nommée YCID ou LEY. Le
-- garde-fou visait à débloquer un devis adressé à une organisation sans
-- compte actif — intention légitime, portée beaucoup trop large : il
-- autorisait n'importe quel administrateur à se prononcer au nom de
-- n'importe qui.
--
-- C'est d'autant plus grave avec la règle d'unanimité arbitrée le
-- 25/07 : si un administrateur peut décider pour toutes les
-- organisations, l'unanimité ne veut plus rien dire.
--
-- Règle retenue : décide qui est MEMBRE de l'organisation sollicitée.
-- Le recours subsiste, mais réservé aux administrateurs PLATEFORME
-- (`is_platform_admin`) — un rôle d'exploitation, pas un rôle
-- partenaire. Et il devient visible : voir `decided_by` ci-dessous.

drop policy if exists "Decide validation" on validations;
create policy "Decide validation" on validations
  for update using (
    -- Cas normal : membre de l'organisation sollicitée.
    exists (
      select 1 from memberships m
       where m.user_id = auth.uid() and m.org_id = validations.org_id
    )
    -- Recours d'exploitation : administrateur plateforme uniquement.
    -- Volontairement PAS is_admin(), qui englobe les admins d'organisation
    -- YCID / LEY et rouvrirait exactement le trou qu'on ferme.
    or exists (
      select 1 from profiles p
       where p.id = auth.uid() and p.is_platform_admin = true
    )
  );

-- Le chef de projet perd ce droit, qu'il n'aurait jamais dû avoir : il
-- est le plus souvent le déposant du devis. Se valider soi-même vide le
-- circuit de son sens.

-- ------------------------------------------------------------
-- Rendre la décision hors organisation VISIBLE
-- ------------------------------------------------------------
-- `decided_by` était déjà renseigné, mais rien ne permettait de savoir
-- si le décideur appartenait à l'organisation sollicitée. Pour une
-- piste d'audit destinée à un financeur, « validé par LEY » et « validé
-- par un administrateur au nom de LEY » ne sont pas la même affirmation.
create or replace function public.validation_decided_outside_org(validation_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select v.decided_by is not null
     and not exists (
       select 1 from memberships m
        where m.user_id = v.decided_by and m.org_id = v.org_id
     )
    from validations v
   where v.id = validation_id;
$$;
