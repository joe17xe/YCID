-- ============================================================
-- 0044 — Adresse de réponse des notifications
-- ============================================================
-- La 0040 gérait l'expéditeur, pas la réponse. Or les deux diffèrent
-- souvent : on expédie depuis une boîte de service — « YCID Notifications
-- <cem.notif@…> » — et l'on veut que les réponses arrivent quelque part
-- de lu.
--
-- Sans `reply_to`, une réponse part vers l'adresse d'expédition. Si
-- celle-ci n'est relevée par personne, la réponse est perdue en silence —
-- et l'expéditeur croit avoir répondu. C'est le genre de perte qu'on ne
-- constate jamais, puisque personne ne sait qu'un message a existé.
alter table email_settings
  add column if not exists reply_to text;

-- Par défaut, l'adresse d'expédition : mieux vaut un repli explicite
-- qu'un champ vide dont le comportement dépend du client de messagerie.
update email_settings
   set reply_to = from_email
 where reply_to is null and from_email is not null;
