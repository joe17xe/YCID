-- ============================================================
-- 0053 — Enregistrer une ligne budgétaire détruisait sa répartition
--        avant de savoir si l'enregistrement allait réussir
-- ============================================================
-- `saveBudgetLine` (app/(app)/projets/[id]/actions.ts), branche
-- « modification », tenait en trois appels séparés :
--
--   1. delete from budget_line_tasks where budget_line_id = …
--   2. update budget_lines set … where id = …
--   3. insert into budget_line_tasks (…)
--
-- Trois requêtes HTTP, donc TROIS TRANSACTIONS. Si la 2 échoue, la 1 a
-- déjà été validée : l'utilisateur lit « Échec de la modification » —
-- une phrase qui dit que rien n'a bougé — alors que TOUTES les
-- affectations de tâches de la ligne viennent d'être détruites. Si la 3
-- échoue, il lit « Ligne enregistrée, mais la répartition a échoué » :
-- la ligne est bien enregistrée, et sa répartition n'existe plus.
--
-- Dans les deux cas la perte est SILENCIEUSE au sens qui compte : elle
-- ne se voit pas là où l'on regarde. L'écran budgétaire montre une ligne
-- au bon montant ; c'est l'onglet Tâches, ailleurs, qui a changé.
--
-- Et il a changé plus qu'il n'y paraît. Le budget d'une tâche est la
-- SOMME DE SES AFFECTATIONS (0028) — il n'existe nulle part ailleurs —
-- et ce budget sert de POIDS à l'avancement de la phase (page projet :
-- moyenne des avancements pondérée par le budget des tâches, avec un
-- plancher à 2 %). Une répartition à moitié détruite ne fait donc pas
-- que vider une colonne : elle DÉPLACE le pourcentage d'avancement que
-- lit un financeur, sans que personne n'ait décidé de le déplacer et
-- sans qu'aucune trace ne le dise.
--
-- L'ordre des trois appels n'est pas en cause, et c'est ce qui rend le
-- défaut coriace : purger AVANT d'écrire la ligne est délibéré. Le
-- trigger de cohérence (0028) refuse de baisser le montant d'une ligne
-- sous la somme déjà répartie, et refuse de changer sa phase tant que
-- des tâches d'une autre phase la financent. Écrire la ligne d'abord
-- ferait donc échouer une baisse de montant parfaitement légitime. Le
-- ré-ordonnancement ne règle rien ; ce qui manque, c'est la
-- TRANSACTION.

-- ------------------------------------------------------------
-- Pourquoi `security invoker`, alors que ce dépôt écrit ses fonctions
-- en `security definer`
-- ------------------------------------------------------------
-- C'est l'arbitrage principal de cette migration, et il va contre
-- l'habitude du dépôt : il faut donc l'écrire.
--
-- Ce qu'on vient chercher ici, c'est l'ATOMICITÉ — un seul aller-retour,
-- donc une seule transaction, donc « tout ou rien ». Cela ne demande
-- aucun privilège particulier : chacun des trois ordres ci-dessus est un
-- ordre que l'appelant exécute DÉJÀ aujourd'hui, un par un, sous son
-- identité et sous la RLS. Il n'y a rien à contourner.
--
-- `security definer` serait donc du privilège gratuit, et pas
-- inoffensif : la fonction est exposée par PostgREST à tout compte
-- authentifié, qui peut l'appeler avec l'identifiant de ligne et de
-- projet de son choix. Hors RLS, elle devrait alors réimplémenter
-- elle-même la règle « qui peut écrire une ligne budgétaire » — soit une
-- TROISIÈME copie de la liste posée par « Manage budget lines » (0001)
-- et « Admins manage budget lines » (0013). Une copie qui dérive dans un
-- sens verrouille des utilisateurs légitimes ; dans l'autre, elle ouvre
-- une écriture que la RLS refuse. C'est exactement le trou qu'on
-- creuserait en bouchant une perte de données.
--
-- Les `security definer` déjà en place dans ce dépôt le sont toutes pour
-- une raison qu'on ne retrouve PAS ici : lire `storage.objects`, hors de
-- portée de l'appelant (0034) ; sortir une lecture du corps d'une policy
-- pour ne pas la faire boucler (0045, 0051) ; s'assurer qu'un droit de
-- lecture manquant ne se lise pas comme « rien à conserver » (0051).
-- Aucune ne s'applique à une écriture ordinaire de ligne budgétaire.
--
-- CE QUE `security invoker` COÛTE, et comment on le paie. Un `delete` ou
-- un `update` ÉCARTÉ par la RLS ne lève aucune erreur : il touche zéro
-- ligne et répond « succès » (le même piège que la 0051 documente pour
-- la suppression d'une pièce). Une fonction qui se contenterait
-- d'enchaîner les ordres rendrait donc « enregistré » à quelqu'un dont
-- rien n'a été écrit. Les deux contrôles ci-dessous — `row_count` après
-- l'update, et la vérification que la purge a bien eu lieu — sont là
-- pour cela : ils transforment un mensonge silencieux en refus explicite.
--
-- Effet de bord assumé, et c'est une CORRECTION : `referent_mairie`
-- reçoit `budget.manage` dans lib/rbac.ts, mais ne figure ni dans
-- « Manage budget lines » (0001) ni dans « Manage budget line tasks »
-- (0028). Ce rôle ne pouvait donc déjà rien modifier ; il obtenait
-- simplement, quand la ligne n'avait aucune répartition, un « Ligne
-- enregistrée » sur une ligne inchangée. Il lira désormais un refus. La
-- divergence matrice ↔ RLS reste entière et n'est PAS tranchée ici :
-- elle demande de décider si ce rôle doit écrire au budget, ce qui n'est
-- pas une question de transaction.

-- ------------------------------------------------------------
-- La fonction
-- ------------------------------------------------------------
-- Elle couvre la création ET la modification, `p_line_id` nul valant
-- création. Deux fonctions auraient laissé la création hors transaction,
-- avec la même moitié d'écriture possible : la ligne créée, sa
-- répartition non. C'est moins destructeur — rien d'existant ne
-- disparaît — mais tout aussi faux : une ligne de 40 000 € qu'on croit
-- répartie sur trois tâches et qui n'en finance aucune.
--
-- `set search_path = public`, comme toutes les fonctions de ce dépôt
-- depuis la 0022. Une inquiétude mérite d'être levée par écrit, parce
-- qu'elle se pose à chaque relecture : la branche « création » laisse la
-- base calculer `budget_lines.id`, dont le défaut (0001) est
-- `uuid_generate_v4()` — fonction de l'extension « uuid-ossp », que
-- Supabase installe dans le schéma `extensions` et non dans `public`.
-- Ce défaut n'a pourtant PAS besoin d'`extensions` dans le chemin :
-- PostgreSQL résout l'expression au moment du `create table` et la
-- stocke résolue. Vérifié plutôt que supposé —
--
--   select pg_get_expr(adbin, adrelid) from pg_attrdef …
--     → extensions.uuid_generate_v4()
--
-- Ce qui échouerait, c'est un appel NOMMÉ et non qualifié dans le corps
-- d'une fonction ; il n'y en a aucun ici. Élargir le chemin « au cas
-- où » aurait ajouté un schéma de résolution sans nécessité.
--
-- AUCUN bloc `exception` : il ouvrirait une sous-transaction, avalerait
-- l'erreur et laisserait passer l'écriture partielle qu'on est en train
-- de fermer. Toute erreur — trigger de cohérence, clé étrangère, clé
-- primaire dupliquée, contrainte `amount >= 0`, RLS — remonte telle
-- quelle et annule l'ensemble.
create or replace function public.save_budget_line(
  p_project_id      uuid,
  p_line_id         uuid,
  p_poste           text,
  p_description     text,
  p_category        text,
  p_funder_org_id   uuid,
  p_owner_org_id    uuid,
  p_phase_id        uuid,
  p_year            int,
  p_planned_amount  numeric,
  p_is_valorisation boolean,
  p_status          text,
  p_comment         text,
  p_allocations     jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_line_id       uuid;
  v_before_count  int     := 0;
  v_before_amount numeric := 0;
  v_updated       int;
begin
  -- Ces trois refus doublent les contrôles de l'action serveur. Ils ne
  -- sont pas décoratifs : la fonction est atteignable directement par
  -- PostgREST, sans passer par l'écran, et `budget_lines.poste` est
  -- `not null` sans être `not blank`.
  if p_project_id is null then
    raise exception 'Projet non précisé.';
  end if;
  if coalesce(btrim(p_poste), '') = '' then
    raise exception 'Le poste est obligatoire.';
  end if;
  if coalesce(p_planned_amount, 0) < 0 then
    raise exception 'Le montant prévisionnel ne peut pas être négatif.';
  end if;

  if p_line_id is null then
    -- ------------------------------------------------------
    -- Création
    -- ------------------------------------------------------
    -- `project_id` vient du paramètre et de nulle part ailleurs ; la
    -- policy « Manage budget lines » tranche en `with check` si
    -- l'appelant a le droit d'écrire dans CE projet.
    insert into budget_lines (
      project_id, poste, description, category,
      funder_org_id, owner_org_id, phase_id, year,
      planned_amount, is_valorisation, status, comment
    ) values (
      p_project_id, btrim(p_poste), p_description, p_category::line_category,
      p_funder_org_id, p_owner_org_id, p_phase_id, p_year,
      coalesce(p_planned_amount, 0), coalesce(p_is_valorisation, false),
      p_status::line_status, p_comment
    )
    returning id into v_line_id;
  else
    -- ------------------------------------------------------
    -- Modification
    -- ------------------------------------------------------
    v_line_id := p_line_id;

    -- La ligne doit relever du projet annoncé. Sans ce contrôle, un
    -- appel direct pourrait présenter l'identifiant d'une ligne d'un
    -- autre projet avec un projet où l'appelant a des droits — et la
    -- policy, qui juge la ligne visée et non le paramètre, refuserait
    -- certes l'écriture, mais après que la purge a eu lieu. On refuse
    -- AVANT de toucher à quoi que ce soit. Le message est le même que
    -- pour une ligne inexistante : il n'a pas à confirmer qu'elle
    -- existe ailleurs.
    if not exists (
      select 1 from budget_lines bl
       where bl.id = v_line_id and bl.project_id = p_project_id
    ) then
      raise exception 'Ligne introuvable.';
    end if;

    -- Relevé AVANT la purge : c'est ce que le journal d'audit dira avoir
    -- été remplacé, et après le delete plus rien ne peut le dire. Compté
    -- ici plutôt que par l'application, pour que le chiffre soit celui
    -- que la transaction a réellement effacé et non celui d'une lecture
    -- faite une seconde plus tôt.
    select count(*), coalesce(sum(amount), 0)
      into v_before_count, v_before_amount
      from budget_line_tasks
     where budget_line_id = v_line_id;

    -- Purge d'abord, exactement comme avant cette migration : le trigger
    -- `trg_budget_line_coherence` (0028) refuserait une baisse de montant
    -- ou un changement de phase s'il voyait encore l'ancienne
    -- répartition. Ce qui change, c'est qu'à partir d'ici plus rien ne
    -- peut être validé à moitié.
    delete from budget_line_tasks where budget_line_id = v_line_id;

    -- Un `delete` écarté par la RLS ne lève pas d'erreur : il supprime
    -- zéro ligne et répond « succès ». Sans ce contrôle, un appelant
    -- autorisé à VOIR la répartition sans pouvoir la gérer verrait la
    -- ligne mise à jour par-dessus une répartition intacte — donc une
    -- ligne dont le montant ne couvre plus ce qu'elle finance.
    if exists (select 1 from budget_line_tasks where budget_line_id = v_line_id) then
      raise exception 'La répartition n''a pas pu être remplacée : droits insuffisants sur les affectations de cette ligne.';
    end if;

    update budget_lines set
      poste           = btrim(p_poste),
      description     = p_description,
      category        = p_category::line_category,
      funder_org_id   = p_funder_org_id,
      owner_org_id    = p_owner_org_id,
      phase_id        = p_phase_id,
      year            = p_year,
      planned_amount  = coalesce(p_planned_amount, 0),
      is_valorisation = coalesce(p_is_valorisation, false),
      status          = p_status::line_status,
      comment         = p_comment
     where id = v_line_id;

    -- Même piège que ci-dessus, et c'est ici qu'il coûtait le plus cher :
    -- un `update` filtré par la RLS répond « succès » sans rien écrire.
    -- L'exception annule la purge faite trois lignes plus haut — ce que
    -- l'ancien enchaînement était incapable de faire.
    get diagnostics v_updated = row_count;
    if v_updated = 0 then
      raise exception 'Ligne introuvable, ou droits insuffisants sur le budget de ce projet : rien n''a été modifié.';
    end if;
  end if;

  -- ------------------------------------------------------------
  -- La nouvelle répartition
  -- ------------------------------------------------------------
  -- `alloc(item)` nomme explicitement la colonne : `as alloc` seul
  -- donnerait le même nom à la table et à sa colonne, et la relecture
  -- d'un `->>` deviendrait ambiguë pour qui reprend ce code.
  --
  -- Rien n'est validé ici à la main. Le trigger
  -- `trg_budget_line_task_coherence` (0028) refuse une tâche d'une autre
  -- phase et une répartition qui dépasse le montant de la ligne ; la clé
  -- primaire refuse deux fois la même tâche ; la contrainte
  -- `amount >= 0` refuse un montant négatif ; la clé étrangère refuse
  -- une tâche inexistante. Recopier ces règles ici en ferait une seconde
  -- version à tenir juste.
  insert into budget_line_tasks (budget_line_id, task_id, amount)
  select v_line_id,
         (alloc.item->>'task_id')::uuid,
         coalesce((alloc.item->>'amount')::numeric, 0)
    from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb)) as alloc(item);

  -- Ce que l'appelant ne peut plus lire par lui-même : l'identifiant de
  -- la ligne créée, et la répartition d'avant, qui n'existe plus.
  return jsonb_build_object(
    'line_id',      v_line_id,
    'created',      p_line_id is null,
    'before_count', v_before_count,
    'before_amount', v_before_amount
  );
end;
$$;

-- Même verrou que `document_has_decision` (0051) : la fonction n'est
-- offerte qu'aux comptes authentifiés. C'est une formalité tant qu'elle
-- reste `security invoker` — elle ne peut rien faire que son appelant ne
-- puisse déjà faire — mais elle vaut pour le jour où quelqu'un la
-- basculerait en `security definer` sans relire ce fichier.
revoke all on function public.save_budget_line(
  uuid, uuid, text, text, text, uuid, uuid, uuid, int, numeric, boolean, text, text, jsonb
) from public;
grant execute on function public.save_budget_line(
  uuid, uuid, text, text, text, uuid, uuid, uuid, int, numeric, boolean, text, text, jsonb
) to authenticated;

-- ------------------------------------------------------------
-- Ce que cette migration NE fait pas
-- ------------------------------------------------------------
-- · AUCUNE REPRISE. Les répartitions détruites par un enregistrement
--   à moitié réussi le sont : rien en base ne dit ce qu'elles portaient
--   — c'est la définition de la panne — et le journal d'audit ne
--   commentait que les enregistrements ABOUTIS. Les avancements de
--   phase qui en ont bougé ont bougé.
-- · LE JOURNAL D'AUDIT RESTE HORS TRANSACTION. La trace « Ligne
--   modifiée — RÉPARTITION : 3 affectations (40 000 €) → 1 (10 000 €) »
--   continue d'être écrite par l'application, après coup. L'y faire
--   entrer supposerait un insert dans `audit_log` depuis cette fonction,
--   donc sous l'identité de l'appelant : la policy « Insert audit »
--   (0005) l'accepterait, mais on déplacerait dans la base la
--   construction d'une phrase qui se lit à l'écran, avec ses montants
--   formatés en euros et ses accords au pluriel. Le risque résiduel est
--   celui, connu et assumé partout dans ce dépôt, d'une trace manquante
--   sur une opération réussie — jamais l'inverse, puisque la trace n'est
--   écrite qu'après le retour de cette fonction.
-- · AUCUN AUTRE CHEMIN D'ÉCRITURE N'EST TOUCHÉ. L'import CSV
--   (app/import/actions.ts) écrit `budget_lines` puis `budget_line_tasks`
--   directement, et `createTaskFromBudgetLine` crée une tâche puis son
--   affectation en deux appels — il annonce d'ailleurs franchement
--   « Tâche créée, mais son rattachement au budget a échoué ». Ces deux
--   chemins CRÉENT sans rien détruire ; ils relèvent du même
--   raisonnement, pas de la même urgence.

-- ------------------------------------------------------------
-- Ordre de déploiement
-- ------------------------------------------------------------
-- Cette migration s'applique AVANT le déploiement applicatif qui
-- l'accompagne. Dans l'intervalle inverse — application déployée,
-- migration non appliquée — l'appel échoue proprement : PostgREST rend
-- `PGRST202` (« Could not find the function public.save_budget_line …
-- in the schema cache ») et l'action affiche une phrase qui nomme ce
-- fichier. Aucune ligne n'est modifiée, aucune répartition n'est
-- détruite : c'est un blocage, pas une perte, et c'est le bon sens de
-- l'erreur.
--
-- Si `PGRST202` persiste APRÈS application, le cache de schéma de
-- PostgREST n'a pas été rafraîchi : `notify pgrst, 'reload schema';` ou
-- un redémarrage de l'API depuis le tableau de bord Supabase.

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
-- 1. La fonction est là, en `security invoker` (`prosecdef` à false) :
--
--      select p.proname, p.prosecdef, p.proconfig
--        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname = 'public' and p.proname = 'save_budget_line';
--
--    Attendu : une ligne, `prosecdef` = false, `proconfig` contenant
--    « search_path=public ». Un `prosecdef` à true signale une
--    réécriture qui a ignoré l'arbitrage ci-dessus — la fonction
--    contournerait alors la RLS sans rien vérifier elle-même.
--
-- 2. Puis, dans l'application, et c'est le seul essai qui prouve quelque
--    chose. Sur une ligne de 40 000 € répartie sur deux tâches, ramener
--    le montant à 5 000 € SANS toucher à la répartition : le trigger de
--    cohérence refuse (« Le montant de la ligne est inférieur à la somme
--    déjà répartie »), et il faut ensuite vérifier que la répartition est
--    TOUJOURS LÀ — c'est précisément le cas qui la détruisait :
--
--      select t.title, blt.amount
--        from budget_line_tasks blt
--        join tasks t on t.id = blt.task_id
--       where blt.budget_line_id = '<identifiant de la ligne>';
--
--    Attendu : les deux affectations d'origine, intactes. Zéro ligne =
--    la transaction n'a pas joué (migration non appliquée, ou action
--    revenue à l'ancien enchaînement).
--
-- 3. Le cas normal doit rester normal : baisser le montant ET réduire la
--    répartition dans le même enregistrement s'applique sans erreur, et
--    le journal du projet porte la ligne « RÉPARTITION : 2 affectations
--    (40 000 €) → 1 (5 000 €) ».
