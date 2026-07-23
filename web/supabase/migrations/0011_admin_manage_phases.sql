-- ============================================================
-- MIGRATION 0011 — Les admins gèrent les phases
-- ============================================================
-- La policy « Chef manage phases » (0001) réservait la gestion des
-- phases au seul chef_projet ; les admins plateforme / YCID / LEY
-- doivent pouvoir créer et modifier les phases de tout projet
-- (écran Tâches, PR 9).

drop policy if exists "Admins manage phases" on phases;
create policy "Admins manage phases" on phases
  for all
  using (is_admin() or is_lead_org_admin())
  with check (is_admin() or is_lead_org_admin());
