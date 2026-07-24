-- ============================================================
-- MIGRATION 0015 — Gestion des membres de projet
-- ============================================================
-- 1. Les admins YCID/LEY (non plateforme) doivent pouvoir gérer les
--    membres (la policy « Manage project members » ne couvrait que
--    is_admin() et le chef de projet).
-- 2. Tous les connectés peuvent lire les profils (noms/emails) :
--    nécessaire pour afficher les membres, assigner des tâches et
--    choisir un utilisateur à rattacher — outil interne, comptes
--    créés uniquement sur invitation.

drop policy if exists "Lead admins manage project members" on project_members;
create policy "Lead admins manage project members" on project_members
  for all using (is_lead_org_admin()) with check (is_lead_org_admin());

drop policy if exists "Members read profiles" on profiles;
create policy "Members read profiles" on profiles
  for select using (auth.uid() is not null);
