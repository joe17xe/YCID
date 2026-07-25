-- ============================================================
-- PR 40 — Lien lignes budgétaires ↔ tâches
-- ============================================================
-- Cadrage YCID : « une ligne budgétaire est une tâche ; on peut ajouter
-- une tâche supplémentaire sans budget (signer un contrat…) ».
--
-- Modèle retenu : N lignes → 1 tâche, et non un 1:1 strict. Trois cas
-- réels du programme CEM ne rentrent pas dans un 1:1 :
--   · co-financement — un même livrable financé par le Département, la
--     Mairie et l'association donne trois lignes (financeurs distincts) ;
--     en 1:1 le même travail apparaîtrait trois fois dans les tâches ;
--   · valorisations (bénévolat, locaux) — ce ne sont pas des tâches ;
--   · frais de structure — aucun livrable daté.
-- Les deux extrémités restent possibles : tâche sans ligne, ligne sans
-- tâche. D'où une colonne NULLABLE.

alter table budget_lines
  add column if not exists task_id uuid references tasks(id) on delete set null;

create index if not exists budget_lines_task_id_idx on budget_lines(task_id);

-- Cohérence structurelle. Rien ne vérifiait jusqu'ici que la phase d'une
-- ligne appartenait bien au projet de cette ligne : on ferme aussi ce
-- trou au passage, sinon le regroupement par phase peut afficher des
-- lignes venues d'un autre projet.
create or replace function public.check_budget_line_coherence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_phase uuid;
  v_phase_project uuid;
begin
  if new.task_id is not null then
    select t.phase_id into v_task_phase from tasks t where t.id = new.task_id;
    if v_task_phase is null then
      raise exception 'Tâche introuvable.';
    end if;
    if new.phase_id is null then
      -- Aligner plutôt que refuser : choisir la tâche suffit à situer la ligne.
      new.phase_id := v_task_phase;
    elsif new.phase_id <> v_task_phase then
      raise exception 'La tâche financée n''appartient pas à la phase de la ligne budgétaire.';
    end if;
  end if;

  if new.phase_id is not null then
    select ph.project_id into v_phase_project from phases ph where ph.id = new.phase_id;
    if v_phase_project is distinct from new.project_id then
      raise exception 'La phase sélectionnée n''appartient pas au projet de la ligne budgétaire.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_budget_line_coherence on budget_lines;
create trigger trg_budget_line_coherence
  before insert or update on budget_lines
  for each row execute function public.check_budget_line_coherence();
