-- ============================================================
-- MIGRATION 0013 — Les admins gèrent budget, impact et COPIL
-- ============================================================
-- Les policies d'origine réservaient ces tables aux rôles projet
-- (chef, resp_financier...) ; les admins plateforme / YCID / LEY
-- doivent pouvoir tout gérer (écrans Budget / Impact / COPIL, PR 15).

drop policy if exists "Admins manage budget lines" on budget_lines;
create policy "Admins manage budget lines" on budget_lines
  for all using (is_admin() or is_lead_org_admin()) with check (is_admin() or is_lead_org_admin());

drop policy if exists "Admins manage indicators" on indicators;
create policy "Admins manage indicators" on indicators
  for all using (is_admin() or is_lead_org_admin()) with check (is_admin() or is_lead_org_admin());

drop policy if exists "Admins manage measures" on indicator_measures;
create policy "Admins manage measures" on indicator_measures
  for all using (is_admin() or is_lead_org_admin()) with check (is_admin() or is_lead_org_admin());

drop policy if exists "Admins manage meetings" on meetings;
create policy "Admins manage meetings" on meetings
  for all using (is_admin() or is_lead_org_admin()) with check (is_admin() or is_lead_org_admin());

drop policy if exists "Admins manage decisions" on decisions;
create policy "Admins manage decisions" on decisions
  for all using (is_admin() or is_lead_org_admin()) with check (is_admin() or is_lead_org_admin());
