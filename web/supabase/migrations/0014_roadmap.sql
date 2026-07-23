-- ============================================================
-- MIGRATION 0014 — Roadmap participative (PR 18)
-- ============================================================
-- Idées d'évolution proposées par les utilisateurs, votables et
-- commentables ; arbitrage (statut/priorité/difficulté) réservé aux
-- admins, appliqué côté serveur. Spec : docs/roadmap-feature-spec.md

create table if not exists ideas (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  status text not null default 'idee',
  priority text not null default 'moyenne',
  difficulty int check (difficulty between 1 and 5),
  tags text[],
  author_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists idea_votes (
  idea_id uuid not null references ideas(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

create table if not exists idea_comments (
  id uuid primary key default uuid_generate_v4(),
  idea_id uuid not null references ideas(id) on delete cascade,
  author_id uuid references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists ideas_created_idx on ideas (created_at desc);
create index if not exists idea_comments_idea_idx on idea_comments (idea_id);

alter table ideas enable row level security;
alter table idea_votes enable row level security;
alter table idea_comments enable row level security;

-- Lecture : tous les connectés (la roadmap est commune)
drop policy if exists "Read ideas" on ideas;
create policy "Read ideas" on ideas for select using (auth.uid() is not null);
drop policy if exists "Read idea votes" on idea_votes;
create policy "Read idea votes" on idea_votes for select using (auth.uid() is not null);
drop policy if exists "Read idea comments" on idea_comments;
create policy "Read idea comments" on idea_comments for select using (auth.uid() is not null);

-- Proposer : chacun, en son nom
drop policy if exists "Propose idea" on ideas;
create policy "Propose idea" on ideas for insert with check (author_id = auth.uid());

-- Modifier / supprimer : l'auteur ou un admin (le tri statut/priorité/
-- difficulté réservé admin est appliqué par la server action)
drop policy if exists "Update own idea" on ideas;
create policy "Update own idea" on ideas for update
  using (author_id = auth.uid() or is_admin() or is_lead_org_admin());
drop policy if exists "Delete own idea" on ideas;
create policy "Delete own idea" on ideas for delete
  using (author_id = auth.uid() or is_admin() or is_lead_org_admin());

-- Votes : un par utilisateur, réversible
drop policy if exists "Vote" on idea_votes;
create policy "Vote" on idea_votes for insert with check (user_id = auth.uid());
drop policy if exists "Unvote" on idea_votes;
create policy "Unvote" on idea_votes for delete using (user_id = auth.uid());

-- Commentaires : chacun en son nom ; suppression auteur ou admin
drop policy if exists "Comment" on idea_comments;
create policy "Comment" on idea_comments for insert with check (author_id = auth.uid());
drop policy if exists "Delete comment" on idea_comments;
create policy "Delete comment" on idea_comments for delete
  using (author_id = auth.uid() or is_admin() or is_lead_org_admin());
