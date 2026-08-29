-- ============================================================
-- MIGRATION 0069 — Le bénéficiaire confirme ce qu'il a reçu
-- ============================================================
-- Demande du 29/08 : « LEY a reçu 2 000 € en virement de la part de la
-- mairie. Comment LEY va confirmer la réception ? Et cela doit
-- déclencher une action / paiement. »
--
-- LE DÉFAUT que cela met au jour. La 0066 a UN état « reçu », cliquable
-- par n'importe quel gestionnaire du budget du projet. Un seul bouton
-- pour deux faits qui ne se ressemblent pas :
--
--   · le PAYEUR dit « j'ai émis le virement le 12/03, réf. VIR-2026-041 » ;
--   · le BÉNÉFICIAIRE dit « c'est crédité chez moi le 15/03, voici l'avis ».
--
-- Le chef de projet pouvait déclarer reçu un virement qu'il n'a jamais
-- vu, et LEY n'avait aucun moyen de dire que l'argent était arrivé.
-- L'écart entre les deux dates est précisément ce qu'on relance ; et en
-- contrôle, c'est la seconde qui fait foi — c'est elle qui autorise à
-- dépenser.
--
-- La chaîne devient : promis → demandé → versé → reçu. « versé » est
-- l'affaire du payeur, « reçu » celle du bénéficiaire, et personne ne
-- signe à la place de l'autre. Les lignes existantes en « recu »
-- restent valides : rien n'est réécrit.

-- ------------------------------------------------------------
-- 1. Ce qu'il faut noter de part et d'autre
-- ------------------------------------------------------------
-- Les DEUX dates sont saisies, jamais déduites de l'instant du clic :
-- un virement se constate après coup, souvent en relevant le compte en
-- fin de semaine. `received_at` (0066) reste l'horodatage de la SAISIE ;
-- `received_on` porte la date de VALEUR, celle qui compte en compta.
-- Même distinction côté payeur.
alter table funding_calls
  add column if not exists paid_on date,
  add column if not exists paid_by uuid references profiles(id),
  add column if not exists payment_ref text,
  add column if not exists received_on date,
  add column if not exists received_by uuid references profiles(id),
  -- Recours administrateur, sur le modèle des validations de devis
  -- (0036) : l'admin peut confirmer quand l'organisation bénéficiaire
  -- n'a aucun compte actif, mais la trace le DIT — « confirmé au nom de
  -- LEY » et « confirmé par LEY » ne racontent pas la même histoire à
  -- un contrôleur, six mois plus tard.
  add column if not exists received_on_behalf boolean not null default false;

alter table funding_calls drop constraint if exists funding_calls_status_check;
alter table funding_calls add constraint funding_calls_status_check
  check (status in ('promis', 'demande', 'verse', 'recu'));

-- ------------------------------------------------------------
-- 2. La preuve
-- ------------------------------------------------------------
-- « Reçu » sans pièce n'est qu'une affirmation. L'avis de virement se
-- dépose sur l'appel de fonds lui-même — pas sur une ligne budgétaire,
-- qu'un versement ne concerne pas ligne à ligne.
-- `on delete set null` : supprimer une promesse n'efface pas l'avis de
-- virement, qui reste une pièce du projet.
alter table documents
  add column if not exists funding_call_id uuid references funding_calls(id) on delete set null;

create index if not exists documents_funding_call_idx
  on documents (funding_call_id) where funding_call_id is not null;

-- ------------------------------------------------------------
-- 3. Qui peut dire quoi
-- ------------------------------------------------------------
-- Ces deux gestes ne passent PAS par une policy d'`update` sur
-- funding_calls. Une policy assez large pour laisser un membre de LEY
-- écrire `received_on` le laisserait aussi réécrire le MONTANT de la
-- promesse — la table entière est ouverte ou fermée, une policy ne
-- borne pas les colonnes. Deux fonctions `security definer` qui
-- n'écrivent que ce qu'elles doivent, et vérifient elles-mêmes le
-- droit : c'est la mécanique déjà retenue pour l'anonymisation (0063)
-- et la purge (0064).

-- Membre d'une organisation, au sens des rattachements.
create or replace function public.is_org_member(p_org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_org_id is not null and exists (
    select 1 from memberships m
     where m.org_id = p_org_id and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_org_member(uuid) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;

-- Déclarer le virement ÉMIS — côté payeur.
-- Y ont droit : les membres de l'organisation qui paie (c'est elle qui
-- sait), les gestionnaires du budget du projet (qui saisissent souvent
-- pour une mairie sans compte), et l'administrateur.
create or replace function public.declare_funding_payment(
  p_call_id uuid, p_paid_on date, p_ref text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_call funding_calls;
begin
  select * into v_call from funding_calls where id = p_call_id;
  if v_call.id is null then raise exception 'Appel de fonds introuvable.'; end if;
  if not (is_admin()
          or is_org_member(v_call.payer_org_id)
          or has_project_role(v_call.project_id, array['chef_projet', 'referent_mairie', 'resp_financier'])) then
    raise exception 'Réservé à l''organisation qui verse et aux gestionnaires du budget du projet.';
  end if;
  if p_paid_on is null then raise exception 'La date du virement est obligatoire.'; end if;
  if p_paid_on > current_date then raise exception 'La date du virement ne peut pas être dans le futur.'; end if;

  update funding_calls set
    status = case when status = 'recu' then 'recu' else 'verse' end,
    paid_on = p_paid_on,
    paid_by = auth.uid(),
    payment_ref = nullif(btrim(coalesce(p_ref, '')), ''),
    requested_at = coalesce(requested_at, now()),
    updated_at = now()
  where id = p_call_id;

  return jsonb_build_object('ok', true);
end $$;

-- Confirmer la RÉCEPTION — côté bénéficiaire, et lui seul.
-- Le recours administrateur est marqué `received_on_behalf`.
-- Cas de la réserve (bénéficiaire vide, « X garde la somme pour le
-- projet ») : c'est l'organisation qui réserve qui confirme, puisque
-- c'est chez elle que la somme reste.
create or replace function public.confirm_funding_receipt(
  p_call_id uuid, p_received_on date
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_call funding_calls;
  v_holder uuid;
  v_on_behalf boolean;
begin
  select * into v_call from funding_calls where id = p_call_id;
  if v_call.id is null then raise exception 'Appel de fonds introuvable.'; end if;

  v_holder := coalesce(v_call.beneficiary_org_id, v_call.payer_org_id);
  if is_org_member(v_holder) then
    v_on_behalf := false;
  elsif is_admin() then
    v_on_behalf := true;
  else
    raise exception 'Seule l''organisation qui reçoit peut confirmer la réception (recours administrateur possible).';
  end if;

  if p_received_on is null then raise exception 'La date de réception est obligatoire.'; end if;
  if p_received_on > current_date then raise exception 'La date de réception ne peut pas être dans le futur.'; end if;
  if v_call.paid_on is not null and p_received_on < v_call.paid_on then
    raise exception 'La réception ne peut pas précéder le virement (émis le %).', v_call.paid_on;
  end if;

  update funding_calls set
    status = 'recu',
    received_on = p_received_on,
    received_at = now(),
    received_by = auth.uid(),
    received_on_behalf = v_on_behalf,
    updated_at = now()
  where id = p_call_id;

  return jsonb_build_object('ok', true, 'on_behalf', v_on_behalf);
end $$;

-- Revenir en arrière : une confirmation erronée se retire, par les
-- mêmes mains que celles qui l'ont posée. Les dates du versement ne
-- bougent PAS — le virement, lui, a bien été émis.
create or replace function public.revoke_funding_receipt(p_call_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_call funding_calls;
  v_holder uuid;
begin
  select * into v_call from funding_calls where id = p_call_id;
  if v_call.id is null then raise exception 'Appel de fonds introuvable.'; end if;
  v_holder := coalesce(v_call.beneficiary_org_id, v_call.payer_org_id);
  if not (is_org_member(v_holder) or is_admin()) then
    raise exception 'Seule l''organisation qui reçoit peut retirer sa confirmation (recours administrateur possible).';
  end if;

  update funding_calls set
    status = case when paid_on is not null then 'verse' else 'demande' end,
    received_on = null, received_at = null, received_by = null, received_on_behalf = false,
    updated_at = now()
  where id = p_call_id;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.declare_funding_payment(uuid, date, text) from public, anon;
grant execute on function public.declare_funding_payment(uuid, date, text) to authenticated;
revoke all on function public.confirm_funding_receipt(uuid, date) from public, anon;
grant execute on function public.confirm_funding_receipt(uuid, date) to authenticated;
revoke all on function public.revoke_funding_receipt(uuid) from public, anon;
grant execute on function public.revoke_funding_receipt(uuid) to authenticated;

-- ------------------------------------------------------------
-- 4. Ce que « reçu » déclenche
-- ------------------------------------------------------------
-- Rien d'automatique sur l'argent : aucun paiement ne se fait tout seul,
-- et aucune ligne budgétaire n'est touchée ici. Ce qui se déclenche est
-- une INFORMATION adressée à ceux qui décaissent — « 2 000 € sont
-- arrivés de Villepreux, voici les lignes que cette enveloppe finance,
-- et ce qu'il reste à régler dessus ». Le lien existe déjà en base :
-- budget_lines.funder_org_id + year, la même clé que la comparaison
-- promesse ↔ budget de la 0066. Cette fonction ne fait que la lire.
--
-- Hors valorisation : une contribution en nature ne se règle pas, et un
-- versement ne la finance pas (check:valorisation).
create or replace function public.lines_funded_by(p_project_id uuid, p_org_id uuid, p_year int)
returns table (line_id uuid, poste text, planned numeric)
language sql stable security definer set search_path = public as $$
  select bl.id, bl.poste, bl.planned_amount
    from budget_lines bl
   where bl.project_id = p_project_id
     and bl.funder_org_id = p_org_id
     and bl.year = p_year
     and coalesce(bl.is_valorisation, false) = false
   order by bl.poste;
$$;

revoke all on function public.lines_funded_by(uuid, uuid, int) from public, anon;
grant execute on function public.lines_funded_by(uuid, uuid, int) to authenticated;
