-- ============================================================
-- 0046 — La trace des envois RÉELS
-- ============================================================
-- « Le SMTP est en place, pourquoi je n'ai pas reçu de mail ? » (27/07)
--
-- La question était sans réponse possible, et c'est cela le défaut. La
-- 0040 conserve `last_test_*` : le résultat du bouton « Tester la
-- connexion ». Or ce bouton appelle `verify()` — il ouvre la session,
-- s'authentifie, referme. Il ne prouve donc RIEN de ce qui échoue le
-- plus souvent en production :
--
--   · le relais accepte l'authentification mais refuse l'expéditeur
--     (ici : s'authentifier en joe@ezrya.fr pour écrire sous
--     cem.notif@ezrya.fr — Hostinger le refuse couramment) ;
--   · le message part et se fait classer en indésirable ;
--   · l'adresse du destinataire est inexploitable.
--
-- Dans les trois cas, l'écran affichait « connexion réussie » pendant
-- que rien n'arrivait. Un test vert et une boîte vide : la pire des
-- combinaisons, parce qu'elle oriente le soupçon vers le destinataire.
--
-- Deux colonnes de plus, et la question devient vérifiable : quand
-- l'application a-t-elle réellement tenté d'écrire à quelqu'un, et
-- qu'a répondu le relais.

alter table email_settings
  add column if not exists last_send_at    timestamptz,
  add column if not exists last_send_to    text,
  add column if not exists last_send_ok    boolean,
  add column if not exists last_send_error text;

comment on column email_settings.last_send_at is
  'Dernier envoi RÉEL tenté (pas un test de connexion). Renseigné par le serveur, clé service.';
comment on column email_settings.last_send_error is
  'Réponse du relais au dernier envoi réel en échec. Vide si le dernier envoi a réussi.';

-- Aucune policy nouvelle : la table est déjà réservée aux admins en
-- lecture (0040), et l'écriture passe par la clé service — comme le
-- compteur d'IA (0043), et pour la même raison. Une trace que
-- l'application peut réécrire depuis le navigateur n'est pas une trace.

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select last_test_at, last_test_ok,
--          last_send_at, last_send_to, last_send_ok, last_send_error
--     from email_settings;
--
-- `last_test_ok` à vrai avec `last_send_at` à nul signifie exactement
-- ceci : la connexion fonctionne, et l'application n'a jamais essayé
-- d'écrire à personne.
