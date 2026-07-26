-- ============================================================
-- 0040 — Envoi d'emails, entièrement configurable
-- ============================================================
-- Arbitrage du 25/07 : « il faut envoyer des mails à chaque fois qu'il y
-- a une notification, surtout de validation ou d'action terminée. Il
-- faut que ce soit complètement configurable, SMTP etc. Je ne veux pas
-- que ça soit en dur. »
--
-- Même raisonnement que la configuration IA (0023) : un secret ne se
-- met pas dans un fichier sur le serveur, où le changer suppose un accès
-- SSH et un redémarrage. Il se saisit depuis l'administration.
--
-- SÉCURITÉ : le mot de passe SMTP est un secret. Cette table est donc
-- séparée de `platform_settings` — lisible publiquement pour la marque —
-- et n'est accessible qu'aux administrateurs. Côté serveur la lecture
-- passe par la clé service ; le mot de passe n'est JAMAIS renvoyé au
-- navigateur, seul un booléen « configuré » l'est.
--
-- POURQUOI CETTE MIGRATION MAINTENANT : l'unanimité arbitrée le 25/07
-- rend une organisation silencieuse BLOQUANTE pour l'engagé. Sans
-- notification, personne ne sait qu'on l'attend, et le circuit
-- s'arrêterait au premier devis. Les deux se livrent ensemble.

create table if not exists email_settings (
  id boolean primary key default true check (id),
  -- Interrupteur général. À false, l'application n'envoie rien et se
  -- contente des notifications internes : c'est l'état par défaut, pour
  -- qu'une installation neuve ne tente pas d'écrire à des inconnus.
  enabled boolean not null default false,
  host text,
  port integer not null default 587,
  -- true = TLS implicite (port 465). false = STARTTLS (port 587), le
  -- cas courant.
  secure boolean not null default false,
  username text,
  password text,
  from_name text not null default 'Solid''Pilot',
  from_email text,
  -- Adresse publique de l'application, pour les liens des messages. Un
  -- email qui annonce qu'une décision attend sans donner le chemin pour
  -- s'y rendre ne sert à rien. Ici plutôt qu'en variable
  -- d'environnement : la changer ne doit pas supposer un accès SSH et un
  -- redémarrage.
  site_url text,
  -- Trace du dernier essai : sans elle, un envoi qui échoue en
  -- silence — mot de passe changé, quota atteint — ne se découvre que
  -- le jour où quelqu'un s'étonne de n'avoir rien reçu.
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_error text,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);

insert into email_settings (id) values (true) on conflict (id) do nothing;

alter table email_settings enable row level security;

drop policy if exists "Admins read email settings" on email_settings;
create policy "Admins read email settings" on email_settings
  for select using (is_admin());

drop policy if exists "Admins update email settings" on email_settings;
create policy "Admins update email settings" on email_settings
  for update using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------
-- Ne pas écrire deux fois la même chose à la même personne
-- ------------------------------------------------------------
-- Un devis soumis à trois organisations engendre trois notifications ;
-- une personne membre de deux d'entre elles en recevrait deux. La
-- colonne porte l'adresse réellement servie, ce qui permet de constater
-- après coup ce qui est parti — et de ne pas réémettre.
alter table notifications
  add column if not exists emailed_at timestamptz;

create index if not exists notifications_unread_idx
  on notifications (user_id, read_at) where read_at is null;
