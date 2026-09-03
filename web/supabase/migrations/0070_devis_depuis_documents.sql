-- ============================================================
-- 0070 — Le devis se dépose aussi depuis Documents, et se retire sans disparaître
-- ============================================================
-- Constat du 03/09, en séance de préparation d'une présentation aux
-- communes : l'onglet Documents porte un bouton « Déposer une pièce »,
-- et l'aide du projet dit qu'un devis se dépose sur une ligne
-- budgétaire. Les deux sont vrais — `ProjectDocUpload` n'offre que les
-- natures du projet entier — mais rien à l'écran ne l'explique, et la
-- question tombe naturellement : « pourquoi je ne peux pas mettre mon
-- devis là où je mets mes pièces ? »
--
-- La réponse retenue n'est pas de fermer la porte, c'est de la rendre
-- exacte. La règle du modèle n'a jamais été « on dépose depuis l'onglet
-- Budget » : c'est **une pièce d'argent vit sur une ligne budgétaire**.
-- Le point de dépôt est une commodité, la ligne est l'invariant. On
-- ouvre donc devis, facture et reçu dans l'onglet Documents, en y
-- exigeant la ligne — et le montant, sans lequel un devis validé
-- engagerait zéro euro en silence (`engaged` = Σ des montants des devis
-- validés, lib/budget.ts).
--
-- Cette règle n'existait jusqu'ici que dans le choix des listes d'un
-- composant : `BUDGET_DOC_TYPES` d'un côté, `TASK_DOC_TYPES` de
-- l'autre. Une convention d'interface, pas une contrainte. Deux portes
-- au lieu d'une, c'est le moment de la graver.
--
-- ------------------------------------------------------------
-- Ce que la 0059 laissait ouvert : le devis qui s'évapore en attente
-- ------------------------------------------------------------
-- La 0059 a fermé la suppression d'une pièce DÉCIDÉE : « une décision
-- ne se rejoue pas ». Elle a délibérément laissé partir « sans
-- cérémonie » la pièce non décidée — c'était le cas des devis d'essai
-- jamais soumis.
--
-- Or depuis la 38b un devis part en validation DÈS SON DÉPÔT : « non
-- décidé » ne veut plus dire « jamais soumis ». Un déposant peut donc
-- retirer, d'un clic et sans un mot, un devis que deux organisations
-- ont dans leur file « À valider ». Elles voient disparaître une
-- décision attendue sans savoir pourquoi ; le Journal l'écrit, mais on
-- ne va pas lire le Journal pour une pièce qui n'est plus là.
--
-- Et le geste est légitime : on se trompe de PDF, le fournisseur envoie
-- une version corrigée. L'interdire n'aurait produit qu'un
-- contournement — déposer un second devis et laisser le premier
-- pourrir dans la file de quelqu'un.
--
-- D'où le RETRAIT, arbitrage du 03/09 : la pièce reste, barrée, avec
-- qui l'a retirée, quand, et pourquoi. Les organisations sollicitées
-- sont prévenues que leur décision n'est plus attendue. Aucun chiffre
-- ne bouge — un devis retiré n'a jamais été engagé. Devant un
-- financeur, « on a corrigé » se lit ; « il n'y a jamais rien eu » ne
-- se vérifie pas.
--
--   pièce sans validation (photo, justificatif, facture)  → suppression, comme avant
--   pièce en attente de décision                          → RETRAIT tracé (nouveau)
--   pièce décidée                                         → intouchable, purge admin (0059)
--
-- Ce que cette migration NE change pas, et c'est un arbitrage explicite
-- du Product Owner : le déposant peut valider sa propre pièce. Le cas
-- réel est la mairie qui reçoit un devis par courriel, le charge et
-- l'approuve — un geste, pas un contournement. Le circuit garde son
-- sens par l'échelon suivant (0041) et par la trace : on sait qui a
-- déposé et qui a décidé.

-- ------------------------------------------------------------
-- 1. Une pièce d'argent porte sa ligne et son montant
-- ------------------------------------------------------------
-- CONTRÔLE AVANT — à passer dans le SQL Editor. S'il remonte des
-- lignes, les corriger (leur affecter une ligne budgétaire et un
-- montant) AVANT d'appliquer cette migration :
--
--   select id, type, filename, budget_line_id, amount, uploaded_at
--     from documents
--    where type in ('devis','facture','recu')
--      and (budget_line_id is null or amount is null)
--    order by uploaded_at;
--
-- La contrainte est posée NOT VALID : elle s'applique à tout ce qui
-- s'écrit désormais, sans jamais faire échouer la migration sur des
-- données anciennes — une migration qui refuse de passer laisse une
-- base à moitié à jour, ce qui est pire que la règle qu'elle porte. Le
-- bloc qui suit la valide de lui-même quand la base est déjà propre,
-- ce qui est le cas nominal.
alter table documents drop constraint if exists documents_argent_sur_ligne;
alter table documents add constraint documents_argent_sur_ligne
  check (
    type not in ('devis', 'facture', 'recu')
    or (budget_line_id is not null and amount is not null)
  ) not valid;

do $$
declare n integer;
begin
  select count(*) into n from documents
   where type in ('devis', 'facture', 'recu')
     and (budget_line_id is null or amount is null);
  if n = 0 then
    execute 'alter table documents validate constraint documents_argent_sur_ligne';
    raise notice '0070 — contrainte validée : aucune pièce d''argent sans ligne ni montant.';
  else
    raise notice '0070 — % pièce(s) d''argent sans ligne ou sans montant. La contrainte protège les écritures à venir ; corrigez ces lignes puis exécutez : alter table documents validate constraint documents_argent_sur_ligne;', n;
  end if;
end $$;

-- ------------------------------------------------------------
-- 2. Le retrait : trois colonnes, et rien de plus
-- ------------------------------------------------------------
-- Pas de nouvel état à maintenir dans `type` ni de table à part : une
-- date qui existe ou non, l'auteur du geste, et un motif facultatif.
-- Le motif l'est délibérément — un refus s'impose à autrui et exige
-- d'être motivé (0030), un retrait ne s'impose à personne. Il part
-- pourtant dans la notification : le renseigner rend service.
alter table documents
  add column if not exists withdrawn_at timestamptz,
  add column if not exists withdrawn_by uuid references profiles(id),
  add column if not exists withdrawn_reason text;

comment on column documents.withdrawn_at is
  'Retrait par le déposant avant toute décision. La pièce reste au dossier, barrée.';

-- ------------------------------------------------------------
-- 3. « Cette pièce est-elle entrée dans un circuit ? »
-- ------------------------------------------------------------
-- Jumelle de `document_has_decision` (0059), pour la même raison et
-- avec les mêmes précautions : `security definer` pour ne pas traîner
-- la RLS de `validations` dans une policy de `documents`, et pour que
-- l'absence de droit de lecture ne se traduise pas en « aucune
-- validation », donc en suppression ouverte.
create or replace function public.document_has_validation(doc_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from validations v where v.document_id = doc_id);
$$;

revoke all on function public.document_has_validation(uuid) from public, anon;
grant execute on function public.document_has_validation(uuid) to authenticated;

-- ------------------------------------------------------------
-- 4. La suppression s'arrête à l'entrée du circuit
-- ------------------------------------------------------------
-- Même structure qu'en 0059, un cran plus tôt : les droits ordinaires
-- ne suppriment plus dès qu'une validation existe — décidée ou non.
-- L'administrateur passe toujours, et c'est toujours pour la même
-- raison : nettoyer des données de test.
--
-- L'application dira POURQUOI elle refuse, une policy ne sachant que
-- rendre `false` ; `deleteDocument` distingue les trois cas et oriente
-- vers le retrait.
drop policy if exists "Delete documents" on documents;
create policy "Delete documents" on documents
  for delete using (
    (
      not public.document_has_validation(documents.id)
      and (
        uploaded_by = auth.uid()
        or exists (
          select 1 from project_members pm
           where pm.project_id = documents.project_id and pm.user_id = auth.uid()
             and pm.role in ('chef_projet', 'resp_financier')
        )
      )
    )
    or is_admin() or is_lead_org_admin()
  );

-- ------------------------------------------------------------
-- 5. Le retrait, gardé en base
-- ------------------------------------------------------------
-- « Update documents » (0029) autorise la mise à jour à tout compte qui
-- peut déposer sur le projet : sans ce garde, n'importe quel membre
-- retirerait la pièce d'un autre, et un retrait s'annulerait aussi
-- facilement qu'il se pose. Une policy ne sait pas dire « seulement
-- cette colonne, et seulement dans ce sens » — c'est le travail d'un
-- trigger.
--
-- Population du retrait : celle de la suppression en 0029 — l'auteur du
-- dépôt, le chef de projet, le responsable financier, l'administrateur.
-- Le geste remplace la suppression, il n'ouvre aucun droit nouveau.
create or replace function public.documents_retrait_garde()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Une pièce retirée est FIGÉE : ni montant, ni ligne, ni « payée »
  -- ne bougent plus. Sans quoi le barré deviendrait un brouillon
  -- modifiable, et la lecture « voilà ce qui a été retiré » cesserait
  -- d'être vraie.
  if old.withdrawn_at is not null and new.withdrawn_at is not distinct from old.withdrawn_at then
    if new.amount is distinct from old.amount
       or new.paid is distinct from old.paid
       or new.budget_line_id is distinct from old.budget_line_id
       or new.type is distinct from old.type then
      raise exception 'Cette pièce a été retirée le % : elle ne se modifie plus. Déposez-en une nouvelle.',
        to_char(old.withdrawn_at, 'DD/MM/YYYY');
    end if;
    return new;
  end if;

  if new.withdrawn_at is not distinct from old.withdrawn_at then
    return new; -- la mise à jour ne porte pas sur le retrait
  end if;

  if new.withdrawn_at is null then
    raise exception 'Un retrait ne s''annule pas : pour repartir, déposez une nouvelle pièce.';
  end if;

  if public.document_has_decision(old.id) then
    raise exception 'Cette pièce a été décidée : la décision est la trace du circuit, elle reste au dossier.';
  end if;

  if not (
    old.uploaded_by = auth.uid()
    or exists (
      select 1 from project_members pm
       where pm.project_id = old.project_id and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'resp_financier')
    )
    or is_admin() or is_lead_org_admin()
  ) then
    raise exception 'Le retrait appartient à l''auteur du dépôt, au chef de projet et au responsable financier.';
  end if;

  -- Posés par la base, jamais par l'appelant : ni « retiré par » ni la
  -- date ne se choisissent. Un horodatage venu du navigateur se
  -- antidaterait aussi facilement qu'il se lit.
  new.withdrawn_by := auth.uid();
  new.withdrawn_at := now();
  return new;
end;
$$;

drop trigger if exists documents_retrait_garde on documents;
create trigger documents_retrait_garde
  before update on documents
  for each row execute function public.documents_retrait_garde();

-- ------------------------------------------------------------
-- 6. Une décision ne se prend pas sur une pièce retirée
-- ------------------------------------------------------------
-- Sans cela, un écran resté ouvert validerait un devis retiré cinq
-- minutes plus tôt, et son montant partirait dans l'engagé. La policy
-- de décision (0036/0041) est donc complétée d'une condition : le
-- document ne doit pas être retiré.
create or replace function public.document_is_withdrawn(doc_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from documents d where d.id = doc_id and d.withdrawn_at is not null);
$$;

revoke all on function public.document_is_withdrawn(uuid) from public, anon;
grant execute on function public.document_is_withdrawn(uuid) to authenticated;

-- La policy est REPRISE de la 0045 (sa forme sans auto-lecture, `using`
-- et `with check` symétriques), augmentée de la seule condition
-- nouvelle. La recopier entièrement plutôt que d'empiler une policy
-- permissive de plus : deux policies pour une même action se combinent
-- par OU, et la seconde AUTORISERAIT ce que la première refuse.
drop policy if exists "Decide validation" on validations;
create policy "Decide validation" on validations
  for update
  using (
    public.validation_step_is_open(document_id, step)
    and not public.document_is_withdrawn(document_id)
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
  )
  with check (
    public.validation_step_is_open(document_id, step)
    and not public.document_is_withdrawn(document_id)
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
-- CONTRÔLE APRÈS — ce que la base sait désormais refuser.
-- ------------------------------------------------------------
--   select conname, convalidated from pg_constraint
--    where conrelid = 'documents'::regclass and conname = 'documents_argent_sur_ligne';
--
--   select tgname from pg_trigger
--    where tgrelid = 'documents'::regclass and not tgisinternal;
