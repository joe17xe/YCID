-- ============================================================
-- MIGRATION 0068 — Adresser une demande à quelqu'un, sur une tâche
-- ============================================================
-- Demande du 28/08, en toutes lettres : « sur le point d'aménagement du
-- site du Shir, il faut que je puisse mettre un commentaire qui dit
-- merci de déposer une facture ou un devis, à destination de quelqu'un
-- sur le projet — Ziad, LEY ou Maria ».
--
-- Le fil de la 0067 ne le permettait pas. Un commentaire s'adressait à
-- tout le monde, c'est-à-dire à personne : il prévenait les
-- organisations pilotes et la direction du programme, jamais LA personne
-- de qui on attend quelque chose. Écrire « merci de déposer le devis »
-- dans un fil que trois personnes reçoivent en copie, ce n'est pas une
-- demande, c'est un vœu.
--
-- Trois colonnes, et l'essentiel tient dans la deuxième :
--
--   · `addressed_to` — À QUI. Un membre du projet, un seul. Ce n'est pas
--     une assignation de tâche (la tâche a déjà son responsable) : c'est
--     une demande ponctuelle, qui peut viser quelqu'un d'autre que le
--     responsable — le trésorier pour une facture, le référent mairie
--     pour une délibération ;
--   · `answered_at` — la demande ATTEND une réponse, et cette attente se
--     voit. Sans cet état, une demande est un commentaire de plus dans
--     un fil, et on ne sait jamais ce qui reste dû ;
--   · `answered_by` — qui l'a soldée.
--
-- CE QUI SOLDE UNE DEMANDE, arbitré : un geste explicite, pas une
-- déduction. L'exemple qui l'impose est celui de la demande elle-même —
-- « déposez la facture » se solde en DÉPOSANT une pièce, pas en
-- répondant du texte. Un fil qui n'attendrait qu'une réponse écrite
-- resterait éternellement rouge sur des demandes pourtant satisfaites.
-- Trois personnes peuvent solder : le destinataire (il a fait la
-- chose), l'auteur (il a obtenu ce qu'il voulait, par un autre canal) et
-- l'administrateur. Personne d'autre.

alter table task_comments
  add column if not exists addressed_to uuid references profiles(id) on delete set null,
  add column if not exists answered_at timestamptz,
  add column if not exists answered_by uuid references profiles(id) on delete set null;

-- Les demandes en attente, à l'échelle d'un projet : c'est la requête
-- que fait l'écran pour poser sa pastille sur la tâche. Partielle, donc
-- petite — une demande soldée ne pèse plus rien.
create index if not exists task_comments_ouvertes_idx
  on task_comments (task_id) where addressed_to is not null and answered_at is null;

-- ------------------------------------------------------------
-- Solder une demande
-- ------------------------------------------------------------
-- Le seul `update` autorisé sur ce fil. La 0067 n'en ouvrait aucun : un
-- commentaire ne se modifie pas, il se corrige en en écrivant un autre.
-- Cette règle NE CHANGE PAS — le déclencheur ci-dessous s'en assure.
drop policy if exists "Answer task question" on task_comments;
create policy "Answer task question" on task_comments
  for update using (
    is_admin() or addressed_to = auth.uid() or author_id = auth.uid()
  ) with check (
    is_admin() or addressed_to = auth.uid() or author_id = auth.uid()
  );

-- Une policy d'`update` sur une table de texte libre ouvre, telle
-- quelle, la réécriture du texte : l'auteur pourrait refaire l'histoire
-- de sa propre demande, et le destinataire réécrire ce qu'on lui a
-- demandé après l'avoir soldé. Ce déclencheur borne l'écriture aux deux
-- colonnes de réponse — le reste est figé, y compris pour un appel
-- direct à PostgREST qui contournerait l'application.
create or replace function public.task_comment_immuable()
returns trigger language plpgsql as $$
begin
  if new.id is distinct from old.id
     or new.task_id is distinct from old.task_id
     or new.author_id is distinct from old.author_id
     or new.body is distinct from old.body
     or new.created_at is distinct from old.created_at
     or new.addressed_to is distinct from old.addressed_to then
    raise exception 'Un commentaire ne se modifie pas : seule la réponse à une demande peut être posée ou retirée.';
  end if;
  return new;
end $$;

drop trigger if exists trg_task_comment_immuable on task_comments;
create trigger trg_task_comment_immuable
  before update on task_comments
  for each row execute function public.task_comment_immuable();

-- ------------------------------------------------------------
-- L'export RGPD reprend les demandes adressées à la personne
-- ------------------------------------------------------------
-- La 0067 exportait ce qu'elle a ÉCRIT. Une demande qui la désigne est
-- l'autre moitié : un texte rédigé par un tiers, mais qui la nomme et
-- l'engage. Même exception que les décisions de COPIL à sa charge
-- (0064) — et, comme elles, sans l'identité de l'auteur.
create or replace function public.export_person_data(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_out jsonb;
begin
  if not is_admin() then
    raise exception 'Réservé aux administrateurs de la plateforme.';
  end if;
  if p_user_id is null then
    raise exception 'Personne non précisée.';
  end if;
  if not exists (select 1 from profiles where id = p_user_id) then
    raise exception 'Compte introuvable.';
  end if;

  select jsonb_build_object(

    'export', jsonb_build_object(
      'genere_le', now(),
      'genere_par', (select email from profiles where id = auth.uid()),
      'personne_id', p_user_id,
      'fondement', 'RGPD, articles 15 (droit d''accès) et 20 (portabilité).',
      'portee',
        'Données à caractère personnel concernant cette personne, détenues par la '
        'plateforme Solid''Pilot. Les données des AUTRES personnes en sont exclues : '
        'aucune liste de membres, aucun texte rédigé par un tiers à son sujet sauf '
        'quand la ligne serait incompréhensible sans lui, aucune identité de tiers '
        'dans le journal.',
      'avertissement',
        'À relire avant remise. Certains textes exportés (décisions de COPIL, '
        'commentaires de validation) ont été rédigés par des personnes et peuvent, '
        'dans un cas non anticipé, en nommer d''autres.',
      'non_inclus',
        'Le contenu des pièces déposées (fichiers du stockage) n''est pas repris ici : '
        'il est remis séparément si la demande le couvre.'
    ),

    'profil', (
      select to_jsonb(x) from (
        select p.id, p.email, p.full_name, p.avatar_url,
               p.platform_role, p.active, p.can_manage_roadmap,
               p.tour_seen_at, p.created_at
          from profiles p where p.id = p_user_id
      ) x
    ),

    -- Le NOM de l'organisation, jamais ses membres.
    'organisations', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'organisation', o.name, 'type', o.type, 'pays', o.country,
               'role', m.role) order by o.name), '[]'::jsonb)
        from memberships m join organizations o on o.id = m.org_id
       where m.user_id = p_user_id
    ),

    -- Le RÔLE dans le projet, jamais l'annuaire du projet.
    'projets', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'projet', pr.name, 'pays', pr.country, 'statut', pr.status,
               'role_projet', pm.role) order by pr.name), '[]'::jsonb)
        from project_members pm join projects pr on pr.id = pm.project_id
       where pm.user_id = p_user_id
    ),

    'projets_crees', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'projet', pr.name, 'cree_le', pr.created_at) order by pr.created_at), '[]'::jsonb)
        from projects pr where pr.created_by = p_user_id
    ),

    -- Sans `description` ni `comment` : ces textes sont écrits par
    -- l'équipe et peuvent porter sur d'autres personnes. Le titre,
    -- l'échéance et l'avancement suffisent à décrire une assignation.
    'taches_assignees', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'projet', pr.name, 'phase', ph.name, 'tache', t.title,
               'statut', t.status, 'avancement', t.progress,
               'debut', t.start_date, 'echeance', t.end_date,
               'creee_le', t.created_at) order by t.created_at), '[]'::jsonb)
        from tasks t
        join phases ph on ph.id = t.phase_id
        join projects pr on pr.id = ph.project_id
       where t.assignee_id = p_user_id
    ),

    'taches_creees', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'projet', pr.name, 'tache', t.title, 'statut', t.status,
               'creee_le', t.created_at) order by t.created_at), '[]'::jsonb)
        from tasks t
        join phases ph on ph.id = t.phase_id
        join projects pr on pr.id = ph.project_id
       where t.created_by = p_user_id
    ),

    'depots', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'projet', pr.name, 'fichier', d.filename, 'type', d.type,
               'montant', d.amount, 'depose_le', d.uploaded_at) order by d.uploaded_at), '[]'::jsonb)
        from documents d left join projects pr on pr.id = d.project_id
       where d.uploaded_by = p_user_id
    ),

    -- Le commentaire est de sa main : c'est la motivation qu'elle a
    -- écrite en validant ou en refusant.
    'decisions_de_validation', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'piece', d.filename, 'organisation_sollicitee', o.name,
               'decision', v.decision, 'decide_le', v.decided_at,
               'commentaire', v.comment) order by v.decided_at), '[]'::jsonb)
        from validations v
        join documents d on d.id = v.document_id
        left join organizations o on o.id = v.org_id
       where v.decided_by = p_user_id
    ),

    -- `text` inclus : voir la règle 2 en tête de fonction.
    'decisions_copil_a_sa_charge', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'projet', pr.name, 'decision', dc.text, 'echeance', dc.due_date,
               'statut', dc.status, 'prise_le', dc.created_at) order by dc.created_at), '[]'::jsonb)
        from decisions dc join projects pr on pr.id = dc.project_id
       where dc.owner_user_id = p_user_id
    ),

    -- Ni `attendees` (liste de personnes) ni `minutes` (compte rendu
    -- portant sur tout le monde).
    'reunions_creees', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'projet', pr.name, 'reunion', mt.title, 'type', mt.kind,
               'date', mt.date) order by mt.date), '[]'::jsonb)
        from meetings mt join projects pr on pr.id = mt.project_id
       where mt.created_by = p_user_id
    ),

    'mesures_saisies', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'projet', pr.name, 'indicateur', i.name, 'periode', im.period,
               'valeur', im.value, 'commentaire', im.comment,
               'saisie_le', im.at) order by im.at), '[]'::jsonb)
        from indicator_measures im
        join indicators i on i.id = im.indicator_id
        join projects pr on pr.id = i.project_id
       where im.entered_by = p_user_id
    ),

    -- Sans `contents` : les contenus de campagne sont une production
    -- collective destinée à publication, pas une donnée personnelle.
    'campagnes_de_communication', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'projet', pr.name, 'campagne', cc.title, 'statut', cc.status,
               'lien', case when cc.responsible_id = p_user_id then 'responsable' else 'créateur' end,
               'creee_le', cc.created_at) order by cc.created_at), '[]'::jsonb)
        from comm_campaigns cc join projects pr on pr.id = cc.project_id
       where cc.responsible_id = p_user_id or cc.created_by = p_user_id
    ),

    -- Le contenu du rapport n'est pas repris : c'est de la donnée
    -- projet, produite par le modèle, pas une donnée sur la personne.
    -- Le FAIT qu'elle en ait déclenché la génération, si.
    'rapports_ia_demandes', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'projet', pr.name, 'modele', ar.model, 'demande_le', ar.created_at)
               order by ar.created_at), '[]'::jsonb)
        from ai_reports ar join projects pr on pr.id = ar.project_id
       where ar.created_by = p_user_id
    ),

    'roadmap_idees', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'titre', ia.title, 'description', ia.description, 'statut', ia.status,
               'proposee_le', ia.created_at) order by ia.created_at), '[]'::jsonb)
        from ideas ia where ia.author_id = p_user_id
    ),

    'roadmap_votes', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'idee', ia.title, 'vote_le', iv.at) order by iv.at), '[]'::jsonb)
        from idea_votes iv join ideas ia on ia.id = iv.idea_id
       where iv.user_id = p_user_id
    ),

    'roadmap_commentaires', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'idee', ia.title, 'commentaire', ic.body,
               'ecrit_le', ic.created_at) order by ic.created_at), '[]'::jsonb)
        from idea_comments ic join ideas ia on ia.id = ic.idea_id
       where ic.author_id = p_user_id
    ),

    -- Ses commentaires de tâche (0067). Le texte est INCLUS : c'est
    -- elle qui l'a écrit, et un commentaire sans son texte n'est pas
    -- une donnée, c'est une devinette. Le titre de la tâche et le nom
    -- du projet situent le propos ; ni la description de la tâche, ni
    -- les commentaires des AUTRES personnes du fil n'y figurent —
    -- règle 2 en tête de fonction.
    -- Les demandes qui LUI sont adressées (0068). Texte rédigé par un
    -- tiers, donc exporté à titre d'exception — la même que les
    -- décisions de COPIL dont elle a la charge : « une demande vous
    -- désigne sur telle tâche » sans son énoncé n'est pas une
    -- information, c'est une devinette. L'auteur de la demande n'est
    -- PAS exporté : c'est un tiers.
    'demandes_qui_lui_sont_adressees', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'projet', pr.name, 'tache', tk.title, 'demande', tc.body,
               'recue_le', tc.created_at, 'repondue_le', tc.answered_at)
               order by tc.created_at), '[]'::jsonb)
        from task_comments tc
        join tasks tk on tk.id = tc.task_id
        join phases ph on ph.id = tk.phase_id
        join projects pr on pr.id = ph.project_id
       where tc.addressed_to = p_user_id
         and tc.author_id is distinct from p_user_id
    ),

    'commentaires_de_tache', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'projet', pr.name, 'tache', tk.title, 'commentaire', tc.body,
               'ecrit_le', tc.created_at) order by tc.created_at), '[]'::jsonb)
        from task_comments tc
        join tasks tk on tk.id = tc.task_id
        join phases ph on ph.id = tk.phase_id
        join projects pr on pr.id = ph.project_id
       where tc.author_id = p_user_id
    ),

    -- Sans `errors` : ce jsonb reproduit des lignes du fichier importé,
    -- qui décrivent des tiers.
    'imports', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'type', ir.kind, 'fichier', ir.filename, 'crees', ir.created_count,
               'ignores', ir.skipped_count, 'resultat', ir.status,
               'le', ir.at) order by ir.at), '[]'::jsonb)
        from import_runs ir where ir.by_user = p_user_id
    ),

    'avis_de_revue', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'objet', rv.entity, 'etat', rv.state, 'commentaire', rv.comment,
               'le', rv.updated_at) order by rv.updated_at), '[]'::jsonb)
        from reviews rv where rv.updated_by = p_user_id
    ),

    -- `payload` inclus : c'est le message qui lui a été présenté à
    -- l'écran. Le lui restituer ne lui apprend rien qu'elle n'ait déjà
    -- reçu.
    'notifications_recues', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'type', n.type, 'contenu', n.payload, 'recue_le', n.created_at,
               'lue_le', n.read_at) order by n.created_at), '[]'::jsonb)
        from notifications n where n.user_id = p_user_id
    ),

    'appels_intelligence_artificielle', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'le', au.at, 'fonction', au.feature, 'modele', au.model,
               'jetons', au.total_tokens, 'abouti', au.ok) order by au.at), '[]'::jsonb)
        from ai_usage au where au.user_id = p_user_id
    ),

    -- Ce que la personne a fait. `label` masqué dès qu'il désigne un
    -- AUTRE profil : c'est là que le nom d'un collègue se serait glissé.
    'journal_de_ses_actions', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'le', al.at, 'projet', pr.name, 'objet', al.entity,
               'libelle', case
                 when al.entity_id is not null
                  and al.entity_id <> p_user_id
                  and exists (select 1 from profiles pf where pf.id = al.entity_id)
                 then '(une autre personne)'
                 else al.label end,
               'action', al.action, 'detail', al.comment) order by al.at), '[]'::jsonb)
        from audit_log al left join projects pr on pr.id = al.project_id
       where al.user_id = p_user_id
    ),

    -- Ce qu'on a fait SUR elle. `user_id` — l'auteur — n'est pas
    -- exporté : c'est un tiers.
    'journal_la_concernant', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'le', al.at, 'projet', pr.name, 'objet', al.entity,
               'action', al.action, 'detail', al.comment) order by al.at), '[]'::jsonb)
        from audit_log al left join projects pr on pr.id = al.project_id
       where al.entity_id = p_user_id
         and al.user_id is distinct from p_user_id
    )

  ) into v_out;

  -- L'export d'une personne EST une consultation de ses données
  -- personnelles : elle se trace, comme tout ce qui touche à une
  -- personne dans cette application. `entity_id` porte l'identifiant de
  -- la personne exportée — c'est ce qui la fera apparaître, plus tard,
  -- dans son propre `journal_la_concernant`.
  insert into audit_log (project_id, entity, entity_id, label, action, user_id, comment)
  values (null, 'personne', p_user_id,
          (select full_name from profiles where id = p_user_id),
          'archive', auth.uid(),
          'Export RGPD des données personnelles (art. 15 et 20)');

  return v_out;
end;
$$;

revoke all on function public.export_person_data(uuid) from public, anon;
grant execute on function public.export_person_data(uuid) to authenticated;
