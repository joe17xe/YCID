-- ============================================================
-- 0054 — Le référent Mairie avait sept droits à l'écran, aucun en base
-- ============================================================
-- `lib/rbac.ts` accorde sept capacités d'écriture au rôle
-- `referent_mairie` : `projets.update`, `phases.manage`,
-- `membres.manage`, `budget.manage`, `indicateurs.manage`,
-- `copil.manage`, `decisions.manage` — plus `taches.manage`, qu'il tient
-- de la liste `CONTRIBUTORS`.
--
-- La 0026 a créé le rôle (« le référent d'une commune est un rôle
-- DISTINCT du chef de projet ») et s'est arrêtée là : elle ajoute la
-- valeur à l'enum, elle n'ouvre aucune policy. Trois migrations
-- ultérieures l'ont nommé au coup par coup — `can_upload_document()`
-- (0029), « Add measure » (0038), « Create ai reports » (0039) — parce
-- qu'à chaque fois quelqu'un butait sur un refus précis. Les huit autres
-- écritures n'ont jamais été ouvertes.
--
-- CE QUE CELA DONNE À L'USAGE. Éprouvé sur un cluster jetable, les 53
-- migrations appliquées, connecté en `referent_mairie` d'un projet dont
-- il est bien membre :
--
--   update projects            → 0 ligne, aucune erreur
--   update phases              → 0 ligne, aucune erreur
--   update project_members     → 0 ligne, aucune erreur
--   update budget_lines        → 0 ligne, aucune erreur
--   update indicators          → 0 ligne, aucune erreur
--   update meetings            → 0 ligne, aucune erreur
--   update decisions           → 0 ligne, aucune erreur
--   update tasks               → 0 ligne, aucune erreur
--   insert (les mêmes tables)  → « new row violates row-level security »
--
-- Les INSERT échouent bruyamment : `with check` refuse la ligne, l'erreur
-- remonte, l'écran affiche « Échec ». C'est désagréable mais honnête.
--
-- Les UPDATE, eux, MENTENT. Une policy ne rejette pas une mise à jour :
-- elle retire la ligne de la vue de l'appelant. L'ordre s'exécute sur un
-- ensemble vide, ne lève rien, et `supabase.from(...).update(...)` sans
-- `.select()` ne rapporte ni erreur ni compte. L'action serveur enchaîne
-- donc sur son chemin de succès, écrit sa trace au journal d'audit —
-- « Fiche projet modifiée », avec l'ancien et le nouveau montant voté —
-- et rend « Enregistré ». Le référent ferme l'écran en croyant avoir
-- saisi. Rien n'a bougé, et le journal affirme le contraire.
--
-- C'est le même piège que documentent la 0051 (« un delete écarté par la
-- RLS répondait succès ») et la 0053, qui l'avait constaté sur ce rôle
-- précis sans le trancher : « La divergence matrice ↔ RLS reste entière
-- et n'est PAS tranchée ici : elle demande de décider si ce rôle doit
-- écrire au budget. » C'est cette décision qui manquait.
--
-- ARBITRAGE DU PRODUCT OWNER : « Concernant le référent de Mairie, on
-- lui donne ses droits. » La matrice avait raison, le SQL est en retard.
-- Cette migration aligne le SQL sur la matrice, capacité par capacité,
-- et RIEN de plus — la liste de ce qui n'est délibérément pas accordé
-- est en fin de fichier, elle fait partie de l'arbitrage.
--
-- POURQUOI LES NOMS DE POLICIES NE CHANGENT PAS. « Chef manage phases »
-- ne désigne plus le seul chef de projet, et le nom ment un peu. Le
-- renommer imposerait de garder pour toujours un `drop policy if exists`
-- sur l'ancien nom : une policy oubliée n'est pas inerte, elle
-- s'additionne aux autres par OU et rouvre en silence ce qu'on croyait
-- fermé. Un nom approximatif coûte moins cher qu'une autorisation
-- fantôme. Chaque policy est remplacée en place, `drop` puis `create`,
-- jamais modifiée.

-- ------------------------------------------------------------
-- 1. Lire un rôle projet sans faire boucler la policy
-- ------------------------------------------------------------
-- `project_members` est le seul cas particulier de cette migration :
-- une policy POSÉE SUR cette table ne peut pas l'interroger. PostgreSQL
-- applique la RLS aux lectures faites dans le corps d'une policy, la
-- lecture rappelle la même policy, et l'on obtient « infinite recursion
-- detected in policy » — la panne des 0003, 0010, 0041 et 0045, que
-- `npm run check:policies` refuse désormais à l'écriture.
--
-- La 0010 avait posé `is_chef_projet(pid)` pour cette raison. On ne peut
-- pas la réutiliser : elle code UN rôle dans son nom, et il en faut deux
-- ici. Une `is_chef_ou_referent()` figerait la même erreur d'un cran
-- plus loin — la question « quels rôles » doit rester lisible À
-- L'ENDROIT où on la pose, pas enfouie dans un nom de fonction. D'où une
-- fonction qui prend la liste en paramètre : la liste reste écrite dans
-- la policy, où `npm run check:rbac` sait la lire et la comparer à la
-- matrice.
--
-- `is_chef_projet()` reste en place, appelée par « Manage project orgs »
-- (0004) et « Chef manage campaigns » (0019) : rien à y toucher.
create or replace function public.has_project_role(pid uuid, roles text[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.project_members pm
     where pm.project_id = pid
       and pm.user_id = auth.uid()
       and pm.role::text = any(roles)
  );
$$;

-- ------------------------------------------------------------
-- 2. `projets.update` — modifier la fiche du projet
-- ------------------------------------------------------------
-- DEUX tables, un seul geste. « Modifier la fiche du projet » écrit
-- `projects`, et — quand l'organisation porteuse change — le rôle
-- « porteur » de `project_organizations` (0042). `updateProject` le dit
-- lui-même : si le second n'aboutit pas, « l'écran et le circuit de
-- validation désigneraient deux organisations différentes », donc le
-- devis part au mauvais endroit.
--
-- N'ouvrir que `projects` reviendrait donc à créer une écriture à
-- moitié faite là où il n'y avait qu'un refus complet : le porteur
-- changé dans la fiche, inchangé dans le circuit. C'est la panne que la
-- 0053 vient de fermer sur le budget. Les deux tables vont ensemble ou
-- aucune ; on ouvre les deux.
--
-- Au passage, un défaut que cette lecture met au jour : AUCUNE policy
-- n'autorisait l'`update` de `projects` aux administrateurs. La 0016
-- leur a donné le `delete`, la 0001 le `select` — jamais le `update`.
-- L'administrateur subissait donc exactement le même « Enregistré » sur
-- une fiche inchangée, alors que la matrice porte `admin: true` sur
-- cette capacité. Réparé ici, sur le modèle des 0011 et 0013.
drop policy if exists "Chef modify project" on projects;
create policy "Chef modify project" on projects
  for update
  using (
    is_admin() or is_lead_org_admin()
    or exists (
      select 1 from project_members pm
       where pm.project_id = projects.id and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'referent_mairie')
    )
  )
  with check (
    is_admin() or is_lead_org_admin()
    or exists (
      select 1 from project_members pm
       where pm.project_id = projects.id and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'referent_mairie')
    )
  );

-- `with check` autant que `using`, leçon de la 0045 : sans lui on juge
-- la ligne AVANT et jamais APRÈS. Ici la nuance est concrète — la fiche
-- ne porte aucune colonne d'appartenance, mais elle porte `lead_org_id`,
-- et l'omission laisserait passer demain toute colonne qui compterait.
drop policy if exists "Manage project orgs" on project_organizations;
create policy "Manage project orgs" on project_organizations
  for all
  using (
    is_admin() or is_lead_org_admin()
    or exists (
      select 1 from project_members pm
       where pm.project_id = project_organizations.project_id and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'referent_mairie')
    )
  )
  with check (
    is_admin() or is_lead_org_admin()
    or exists (
      select 1 from project_members pm
       where pm.project_id = project_organizations.project_id and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'referent_mairie')
    )
  );

-- ------------------------------------------------------------
-- 3. `phases.manage` — gérer les phases
-- ------------------------------------------------------------
-- « Admins manage phases » (0011) couvre déjà les administrateurs :
-- rien à ajouter ici pour eux.
drop policy if exists "Chef manage phases" on phases;
create policy "Chef manage phases" on phases
  for all
  using (
    exists (
      select 1 from project_members pm
       where pm.project_id = phases.project_id and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'referent_mairie')
    )
  )
  with check (
    exists (
      select 1 from project_members pm
       where pm.project_id = phases.project_id and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'referent_mairie')
    )
  );

-- ------------------------------------------------------------
-- 4. `membres.manage` — décider qui a accès au projet
-- ------------------------------------------------------------
-- La capacité la plus sensible des huit : elle distribue l'accès. Deux
-- garde-fous encadrent ce qu'on ouvre, et il faut vérifier qu'ils
-- tiennent AVANT d'ajouter le rôle, pas après.
--
--   · LE SIÈGE D'AUDITEUR NE BOUGE PAS. La 0047 pose trois policies
--     `as restrictive` sur `project_members` — ajout, changement,
--     retrait — qui exigent `role <> 'auditeur' or is_admin()`. Une
--     policy restrictive se combine par ET avec TOUTES les autres,
--     présentes et à venir : celle qu'on écrit ici s'y soumet
--     mécaniquement, sans avoir à la mentionner. Un référent Mairie ne
--     peut donc ni nommer un auditeur, ni se hisser lui-même à ce
--     siège, ni rétrograder ou retirer celui qui le contrôle. C'est
--     exactement ce que dit la matrice : `membres.manage_auditeur` n'est
--     accordé à AUCUN rôle projet. Vérifié à l'exécution (voir le bloc
--     « Contrôle »), et non déduit de la lecture — la 0045 a montré ce
--     que vaut une relecture sur une règle de RLS.
--
--   · CE QU'IL PEUT FAIRE, un chef de projet le pouvait déjà, sur le
--     même projet et pas ailleurs : ajouter, changer de rôle
--     opérationnel, retirer. Y compris se promouvoir `chef_projet`.
--     Ouvrir cette capacité au référent ne crée donc aucun pouvoir
--     nouveau dans l'application ; elle donne à un second rôle un
--     pouvoir déjà existant, ce que la matrice affiche depuis le 27/07.
--     `removeProjectMember` refuse par ailleurs de retirer le DERNIER
--     chef de projet — un projet sans pilote n'est plus administrable.
drop policy if exists "Manage project members" on project_members;
create policy "Manage project members" on project_members
  for all
  using (
    is_admin()
    or has_project_role(project_members.project_id, array['chef_projet', 'referent_mairie'])
  )
  with check (
    is_admin()
    or has_project_role(project_members.project_id, array['chef_projet', 'referent_mairie'])
  );

-- ------------------------------------------------------------
-- 5. `taches.manage` — l'écart que personne n'avait relevé
-- ------------------------------------------------------------
-- Celui-ci ne figurait dans aucun signalement, et c'est ce qui le rend
-- intéressant : il ne se voit pas dans la matrice, parce que la liste
-- n'y est pas écrite en clair. `taches.manage` vaut `CONTRIBUTORS`, et
-- `CONTRIBUTORS` contient `referent_mairie`. La 0005 énumère
-- ('chef_projet','resp_financier','contributeur') dans ses trois
-- policies. Une constante nommée d'un côté, une liste littérale de
-- l'autre : la divergence était invisible à l'œil.
--
-- La règle de fond de la 0005 est INCHANGÉE — une tâche terminée reste
-- verrouillée pour tout le monde sauf `can_edit_completed_tasks()`. Le
-- `using` continue de porter `status <> 'terminee'`, le `with check` de
-- ne tester que l'appartenance, pour qu'on puisse encore passer une
-- tâche en cours à terminée. Seule la liste de rôles change.
drop policy if exists "Contributeur insert tasks" on tasks;
create policy "Contributeur insert tasks" on tasks
  for insert with check (
    exists (
      select 1 from project_members pm
        join phases ph on ph.id = tasks.phase_id
       where pm.project_id = ph.project_id and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'referent_mairie', 'resp_financier', 'contributeur')
    )
  );

drop policy if exists "Contributeur update open tasks" on tasks;
create policy "Contributeur update open tasks" on tasks
  for update
  using (
    tasks.status <> 'terminee'
    and exists (
      select 1 from project_members pm
        join phases ph on ph.id = tasks.phase_id
       where pm.project_id = ph.project_id and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'referent_mairie', 'resp_financier', 'contributeur')
    )
  )
  with check (
    exists (
      select 1 from project_members pm
        join phases ph on ph.id = tasks.phase_id
       where pm.project_id = ph.project_id and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'referent_mairie', 'resp_financier', 'contributeur')
    )
  );

drop policy if exists "Contributeur delete open tasks" on tasks;
create policy "Contributeur delete open tasks" on tasks
  for delete using (
    tasks.status <> 'terminee'
    and exists (
      select 1 from project_members pm
        join phases ph on ph.id = tasks.phase_id
       where pm.project_id = ph.project_id and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'referent_mairie', 'resp_financier', 'contributeur')
    )
  );

-- ------------------------------------------------------------
-- 6. `budget.manage` — les lignes budgétaires ET leur répartition
-- ------------------------------------------------------------
-- Deux tables encore, et pour la raison qu'expose la 0053 : le budget
-- d'une tâche EST la somme de ses affectations (0028), il n'existe nulle
-- part ailleurs, et il sert de poids à l'avancement de la phase.
-- N'ouvrir que `budget_lines` ferait échouer `save_budget_line()` au
-- moment de réécrire la répartition — donc, la fonction étant
-- transactionnelle depuis la 0053, ferait échouer TOUT l'enregistrement.
-- Le référent lirait un refus au lieu d'un mensonge : progrès sur la
-- 0053, mais toujours pas le droit que la matrice affiche.
drop policy if exists "Manage budget lines" on budget_lines;
create policy "Manage budget lines" on budget_lines
  for all
  using (
    exists (
      select 1 from project_members pm
       where pm.project_id = budget_lines.project_id and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'referent_mairie', 'resp_financier')
    )
  )
  with check (
    exists (
      select 1 from project_members pm
       where pm.project_id = budget_lines.project_id and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'referent_mairie', 'resp_financier')
    )
  );

drop policy if exists "Manage budget line tasks" on budget_line_tasks;
create policy "Manage budget line tasks" on budget_line_tasks
  for all
  using (
    exists (
      select 1 from budget_lines bl
        join project_members pm on pm.project_id = bl.project_id
       where bl.id = budget_line_tasks.budget_line_id and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'referent_mairie', 'resp_financier')
    )
  )
  with check (
    exists (
      select 1 from budget_lines bl
        join project_members pm on pm.project_id = bl.project_id
       where bl.id = budget_line_tasks.budget_line_id and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'referent_mairie', 'resp_financier')
    )
  );

-- ------------------------------------------------------------
-- 7. `indicateurs.manage` — les indicateurs d'impact
-- ------------------------------------------------------------
-- La saisie des MESURES (« Add measure », 0038) est déjà ouverte au
-- référent ; définir l'indicateur qui les porte ne l'était pas. Il
-- pouvait donc renseigner une valeur trimestrielle sans jamais pouvoir
-- corriger la cible à laquelle on la compare.
drop policy if exists "Manage indicators" on indicators;
create policy "Manage indicators" on indicators
  for all
  using (
    exists (
      select 1 from project_members pm
       where pm.project_id = indicators.project_id and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'referent_mairie', 'resp_financier')
    )
  )
  with check (
    exists (
      select 1 from project_members pm
       where pm.project_id = indicators.project_id and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'referent_mairie', 'resp_financier')
    )
  );

-- ------------------------------------------------------------
-- 8. `copil.manage` — les réunions de comité de pilotage
-- ------------------------------------------------------------
-- Le COPIL d'un projet de coopération réunit la commune et l'expert. Un
-- référent Mairie qui ne peut pas inscrire une réunion à laquelle il
-- siège est le cas le plus littéral de droit affiché et refusé.
drop policy if exists "Chef manage meetings" on meetings;
create policy "Chef manage meetings" on meetings
  for all
  using (
    exists (
      select 1 from project_members pm
       where pm.project_id = meetings.project_id and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'referent_mairie')
    )
  )
  with check (
    exists (
      select 1 from project_members pm
       where pm.project_id = meetings.project_id and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'referent_mairie')
    )
  );

-- ------------------------------------------------------------
-- 9. `decisions.manage` — les décisions de COPIL
-- ------------------------------------------------------------
-- La clause `owner_user_id = auth.uid()` de la 0001 est conservée telle
-- quelle : c'est la note de la matrice — « le responsable d'une décision
-- peut aussi la mettre à jour ». Elle ne dépend d'aucun rôle et ne se
-- confond pas avec la liste qu'on élargit.
drop policy if exists "Manage decisions" on decisions;
create policy "Manage decisions" on decisions
  for all
  using (
    exists (
      select 1 from project_members pm
       where pm.project_id = decisions.project_id and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'referent_mairie')
    )
    or decisions.owner_user_id = auth.uid()
  )
  with check (
    exists (
      select 1 from project_members pm
       where pm.project_id = decisions.project_id and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'referent_mairie')
    )
    or decisions.owner_user_id = auth.uid()
  );

-- ------------------------------------------------------------
-- 10. CE QUI N'EST PAS ACCORDÉ, et pourquoi
-- ------------------------------------------------------------
-- Une migration qui aligne une matrice doit dire où elle s'arrête,
-- sinon « aligner » devient « ouvrir ».
--
--   · LE SIÈGE D'AUDITEUR (`membres.manage_auditeur`). Non accordé,
--     parce que la matrice ne l'accorde à aucun rôle projet. Les trois
--     policies restrictives de la 0047 sont intactes et s'appliquent au
--     référent comme au chef de projet. Le contrôlé ne choisit pas son
--     contrôleur.
--
--   · DÉCIDER D'UNE VALIDATION (`validations.decide`). Non accordé : ce
--     droit ne vient d'aucun rôle projet mais de l'appartenance à
--     l'organisation SOLLICITÉE (0036, 0041, 0045). Un référent Mairie
--     membre de la commune porteuse décide donc déjà — à ce titre-là, et
--     pas au titre de son rôle projet. Y toucher ici reviendrait à
--     recréer le rôle « validateur » supprimé en 0038.
--
--   · LES CAMPAGNES DE COMMUNICATION (`comm_campaigns`, 0019). Non
--     accordé, et c'est un écart CONNU que cette migration laisse
--     ouvert : « Chef manage campaigns » réserve la table au chef de
--     projet, tandis que l'application garde l'écran derrière
--     `phases.manage` (comm-actions.ts) — qui, lui, inclut le référent.
--     La divergence est réelle mais elle porte sur une capacité que la
--     matrice ne nomme PAS : la trancher demanderait d'y créer une
--     entrée `communication.manage`, donc un arbitrage produit, pas une
--     transcription. On ne l'invente pas au détour d'une migration de
--     mise en conformité. Signalé, non corrigé.
--
--   · LA SUPPRESSION D'UN PROJET. Inchangée : « Admins delete projects »
--     (0016), et `deleteProject` exige `isUserAdmin`. `projets.update`
--     modifie une fiche, il n'efface pas un dossier.

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
-- 1. Les huit règles portent bien les deux rôles. Chaque ligne doit
--    contenir `referent_mairie` :
--
--      select tablename, policyname, cmd
--        from pg_policies
--       where schemaname = 'public'
--         and (qual like '%referent_mairie%' or with_check like '%referent_mairie%')
--       order by tablename, policyname;
--
-- 2. Les trois policies de la 0047 sont TOUJOURS restrictives. Une seule
--    revenue à `PERMISSIVE` annulerait la protection du siège d'auditeur
--    en ouvrant une voie au lieu d'en fermer une :
--
--      select policyname, permissive, cmd from pg_policies
--       where tablename = 'project_members' and policyname like 'Auditor seat%';
--
-- 3. Essai réel, connecté en `referent_mairie` d'un projet (c'est le
--    seul contrôle qui prouve quelque chose — cf. 0045) :
--
--      · modifier la fiche, une phase, une ligne budgétaire, un
--        indicateur, une réunion, une décision, une tâche NON terminée,
--        un membre au rôle opérationnel  →  1 ligne touchée ;
--      · nommer un auditeur, se hisser auditeur, retirer ou rétrograder
--        l'auditeur en place                →  refus ou 0 ligne ;
--      · modifier une tâche TERMINÉE        →  0 ligne (règle 0005) ;
--      · toucher un projet dont il n'est pas membre  →  0 ligne.
