-- ============================================================
-- MIGRATION 0020 — Programme de rattachement (PR 27, multi-niveaux)
-- ============================================================
-- Vision Solid'YCID : Programme (ex. CEM / MEAE) → Financeur territorial
-- (YCID…) → Pays → Projet → Associations. Le pays existe déjà
-- (projects.country / zone) ; on ajoute le programme. Les projets
-- existants sont rattachés à CEM (programme actuel).

alter table projects add column if not exists programme text;
update projects set programme = 'CEM' where programme is null;
