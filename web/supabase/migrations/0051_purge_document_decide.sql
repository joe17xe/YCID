-- ============================================================
-- 0051 — Le devis refusé s'effaçait, et le refus avec lui
-- ============================================================
-- Le circuit tient sur une règle que la 0041 grave en base et que
-- `decideValidation` répète à l'écran : une décision ne se rejoue pas.
-- Un devis refusé reste refusé ; pour repartir, on en dépose un nouveau.
--
-- Elle se contourne pourtant sans effort. La policy « Delete documents »
-- (0029:102) autorise la suppression à `uploaded_by = auth.uid()` —
-- l'AUTEUR DU DÉPÔT — et `validations.document_id ... on delete cascade`
-- (0001:154) emporte les décisions avec la pièce. Autrement dit : celui à
-- qui l'on vient de refuser un devis peut le supprimer, et le refus
-- disparaît avec lui. Ce n'est pas une faille, c'est l'ordre normal des
-- clics : un bouton corbeille, deux secondes, et le circuit n'a jamais eu
-- lieu. Le seul à qui la décision s'impose tient la gomme.
--
-- Jusqu'à la 0050 l'opération ne laissait STRICTEMENT rien : « supprime »
-- ne figurait pas dans l'enum `audit_action`, l'insert de trace était
-- rejeté, et la pièce, ses validations et le motif du refus s'évaporaient
-- ensemble. Devant le MEAE, « il n'y a jamais eu de devis sur cette
-- ligne » et « un devis a été refusé, puis retiré » ne racontent pas la
-- même histoire — et rien ne permettait de les distinguer.
--
-- ------------------------------------------------------------
-- L'arbitrage : resserrer sans fermer
-- ------------------------------------------------------------
-- La demande qui déclenche cette migration va pourtant dans l'autre
-- sens : des devis de TEST ont été déposés en recette, et le Product
-- Owner veut « repartir de zéro » sans toucher aux vrais. Interdire toute
-- suppression le laisserait avec ses données d'essai à l'écran, pour
-- toujours — et un écran qu'on ne peut pas nettoyer finit par n'être plus
-- lu du tout.
--
-- Une seule ligne de partage, donc : la pièce a-t-elle été DÉCIDÉE ?
--
--   · aucune validation, ou toutes `en_attente` → rien n'a été jugé,
--     rien à conserver. La suppression reste exactement ce qu'elle
--     était : c'est le cas des devis d'essai jamais soumis, et ils
--     doivent partir sans cérémonie ;
--   · au moins une décision prise → les rôles ordinaires ne suppriment
--     plus. La trace du circuit est le cœur de la justification, et elle
--     ne peut pas dépendre du bon vouloir de celui qu'elle contraint ;
--   · au moins une décision prise, et l'on est ADMINISTRATEUR → la
--     suppression demeure, précisément pour retirer les données de test.
--     `is_admin() / is_lead_org_admin()`, les motifs déjà employés par la
--     policy d'origine — cette migration ne redéfinit pas qui administre.
--
-- « Validée » pèse autant que « refusée », et ce n'est pas un excès de
-- prudence : effacer un devis validé retire de l'« engagé » un montant
-- que deux organisations ont approuvé, et ce montant part au compte
-- rendu. Le mot de la demande — « une fois le devis refusé, on devrait
-- pas le ré accepter » — vaut pour l'autre sens : un devis validé ne se
-- dé-valide pas davantage par la corbeille.
--
-- Ce que la base NE fait pas, et qui appartient à l'application : dire
-- POURQUOI elle refuse. Une policy ne sait que rendre `false`, et un
-- `delete` écarté par la RLS ne remonte aucune erreur — il supprime zéro
-- ligne et répond « succès » (même piège que l'`update` documenté dans
-- `decideValidation`). `deleteDocument` compte donc les lignes revenues
-- et distingue les trois cas ci-dessus par un message ; la purge
-- administrateur exige en outre un paramètre explicite, pour qu'elle ne
-- se confonde jamais avec un clic ordinaire.

-- ------------------------------------------------------------
-- 1. « Cette pièce a-t-elle été jugée ? », calculé hors RLS
-- ------------------------------------------------------------
-- `security definer` pour la raison exposée en 0045, et pour une seconde
-- qui lui ressemble. La première : une policy ne doit pas traîner la RLS
-- dans son corps. Ici la lecture porte sur `validations`, pas sur
-- `documents` — le contrôle `check:policies` passe donc à la lettre —
-- mais la policy « See validations » (0030) interroge à son tour
-- `documents`, et l'on rentrerait dans la pile de policies de la table
-- qu'on est en train de quitter. C'est la boucle de la 0045 avec un
-- détour de plus, celui qui ne se voit pas à la relecture.
--
-- La seconde : sous RLS, la fonction ne verrait que les validations
-- VISIBLES par l'appelant. Un droit de lecture manquant vaudrait alors
-- « aucune décision », donc « suppression autorisée » — une règle de
-- conservation qui s'assouplit à mesure qu'on voit moins est exactement
-- l'inverse de ce qu'on écrit ici.
--
-- La fonction ne divulgue rien : oui ou non, sur un document dont
-- l'appelant détient déjà l'identifiant. Aucun montant, aucun motif,
-- aucune organisation n'en sort.
create or replace function public.document_has_decision(doc_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- `<>` et non `is distinct from` : `validations.decision` est NOT NULL
  -- depuis la 0001 (l.156), avec `en_attente` pour défaut. Le jour où
  -- elle deviendrait nullable, un NULL serait « pas encore décidé » —
  -- soit le comportement de `<>`, qui rendrait NULL, donc faux, donc
  -- suppression ouverte. C'est le bon sens de l'erreur.
  select exists (
    select 1 from validations v
     where v.document_id = doc_id
       and v.decision <> 'en_attente'
  );
$$;

revoke all on function public.document_has_decision(uuid) from public;
grant execute on function public.document_has_decision(uuid) to authenticated;

-- ------------------------------------------------------------
-- 2. La suppression d'une pièce, resserrée sur les pièces décidées
-- ------------------------------------------------------------
-- Structure volontairement lisible en une phrase : les droits ORDINAIRES
-- (auteur du dépôt, chef de projet, responsable financier — la liste de
-- la 0029, inchangée) ne valent plus que sur une pièce non décidée ;
-- l'administrateur, lui, passe dans tous les cas.
--
-- Écrit ainsi plutôt qu'en policy RESTRICTIVE séparée (le procédé de la
-- 0047) : une restrictive s'ajoute par ET à TOUTES les policies de
-- suppression de la table, et il faudrait alors y réinscrire l'exception
-- administrateur, donc tenir la même exception à deux endroits. Ici il
-- n'y a qu'une policy de suppression sur `documents`, et une seule règle
-- à relire.
drop policy if exists "Delete documents" on documents;
create policy "Delete documents" on documents
  for delete using (
    (
      not public.document_has_decision(documents.id)
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
-- 3. La même règle sur les validations, sinon elle se contourne
-- ------------------------------------------------------------
-- « Delete validation » (0030:73) laisse le chef de projet et le
-- responsable financier supprimer une validation, décidée ou non. Sans
-- ce paragraphe, la règle ci-dessus s'annulerait en deux gestes :
-- supprimer la ligne du refus, puis la pièce — redevenue « non décidée »
-- entre-temps. Une protection qu'on lève en cliquant à côté n'en est pas
-- une.
--
-- Le motif d'origine de cette policy est conservé, car il est réel : une
-- soumission adressée à la mauvaise organisation doit pouvoir être
-- retirée par le pilotage. Mais une soumission mal adressée est, par
-- construction, encore `en_attente` — personne n'a eu à se prononcer.
-- Une fois la décision prise, seul l'administrateur retire la ligne.
--
-- La cascade de la clé étrangère n'est pas concernée : elle s'exécute
-- pour le compte de la contrainte et ignore la RLS. Une purge
-- administrateur emporte donc bien les validations de la pièce, sans
-- que cette policy ait son mot à dire.
--
-- `validations.decision` est ici une QUALIFICATION DE COLONNE, la ligne
-- en cours d'évaluation — pas une lecture de la table. Aucune récursion
-- (voir `check:policies`, qui ne traque que `from` / `join`).
drop policy if exists "Delete validation" on validations;
create policy "Delete validation" on validations
  for delete using (
    (
      validations.decision = 'en_attente'
      and exists (
        select 1 from documents d
          join project_members pm on pm.project_id = d.project_id
         where d.id = validations.document_id
           and pm.user_id = auth.uid() and pm.role in ('chef_projet', 'resp_financier')
      )
    )
    or is_admin() or is_lead_org_admin()
  );

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
-- 1. La fonction répond juste. Sur un devis dont une organisation s'est
--    prononcée, elle doit rendre `true` :
--
--      select d.id, d.filename, public.document_has_decision(d.id)
--        from documents d
--       where d.type = 'devis'
--       order by d.uploaded_at desc
--       limit 10;
--
-- 2. La policy est bien celle-ci — le corps doit contenir
--    « document_has_decision » :
--
--      select policyname, qual
--        from pg_policies
--       where tablename = 'documents' and cmd = 'DELETE';
--
-- 3. Puis dans l'application, et c'est le seul essai qui prouve quelque
--    chose : connecté comme le DÉPOSANT d'un devis refusé, la corbeille
--    doit refuser en expliquant qu'on dépose un nouveau devis ; connecté
--    comme administrateur, la même pièce doit se purger en deux temps, et
--    laisser au journal une ligne `supprime` qui compte les validations
--    emportées :
--
--      select at, label, action, comment
--        from audit_log
--       where action = 'supprime' and entity = 'document'
--       order by at desc
--       limit 5;
--
--    Une purge sans ligne au journal signale un insert refusé (policy
--    « Insert audit », 0005) : le serveur en garde alors le contenu
--    complet dans ses logs, à réinscrire à la main. C'est la seule chose
--    qui survit à la purge, et elle ne doit pas manquer.
