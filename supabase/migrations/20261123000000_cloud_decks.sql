-- Cloud decks for the WKND Deck Builder.
--
-- Run once in the Supabase SQL Editor (or `supabase db push`). Safe to re-run:
-- every statement is idempotent.
--
-- What it sets up:
-- 1. Sign-in with any email (email code / magic link).
-- 2. public.decks: one row per presentation, JSON in `presentation`.
-- 3. public.deck_shares: colleagues (by email) who may open and edit a deck.
-- 4. Storage bucket `deck-images` for slide photos.
-- Access rules live in row level security, so the browser talks to the
-- database directly with the anon key.

create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Lower-cased email of the signed-in user, from the JWT.
create or replace function private.current_email()
returns text
language sql
stable
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

grant execute on function private.current_email() to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Sign-in is open to any email address
-- ---------------------------------------------------------------------------

-- An earlier draft limited sign-up to allowed domains. Remove it if it was
-- applied.
drop trigger if exists enforce_email_domain on auth.users;
drop function if exists private.enforce_email_domain();
drop table if exists private.allowed_email_domains;

-- ---------------------------------------------------------------------------
-- 2. Decks
-- ---------------------------------------------------------------------------

create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  owner_email text not null default private.current_email(),
  presentation jsonb not null check (jsonb_typeof(presentation -> 'slides') = 'array'),
  -- Summary fields for the Library, derived so they never drift.
  title text generated always as (coalesce(presentation ->> 'title', '')) stored,
  slide_count integer generated always as (jsonb_array_length(presentation -> 'slides')) stored,
  cover_slide jsonb generated always as (presentation -> 'slides' -> 0) stored,
  -- Optimistic concurrency: every save must send revision = previous + 1.
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null default private.current_email()
);

create index if not exists decks_owner_updated_idx on public.decks (owner_id, updated_at desc);

create or replace function private.touch_deck()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.revision <> old.revision + 1 then
    raise exception 'REVISION_CONFLICT' using errcode = '40001';
  end if;
  new.updated_at := now();
  new.updated_by := private.current_email();
  return new;
end;
$$;

drop trigger if exists touch_deck on public.decks;
create trigger touch_deck
  before update on public.decks
  for each row execute function private.touch_deck();

-- ---------------------------------------------------------------------------
-- 3. Shares
-- ---------------------------------------------------------------------------

create table if not exists public.deck_shares (
  deck_id uuid not null references public.decks (id) on delete cascade,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  role text not null default 'editor' check (role in ('editor')),
  created_at timestamptz not null default now(),
  primary key (deck_id, email)
);

create index if not exists deck_shares_email_idx on public.deck_shares (email);

-- Security definer so share policies can check ownership without going
-- through the decks policies (which read deck_shares: that would recurse).
create or replace function private.is_deck_owner(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.decks d
    where d.id = target and d.owner_id = (select auth.uid())
  );
$$;

grant execute on function private.is_deck_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.decks enable row level security;
alter table public.deck_shares enable row level security;

revoke all on public.decks from anon;
revoke all on public.deck_shares from anon;

-- Clients may only change the presentation and bump the revision; owner,
-- dates and summaries are set by the database.
revoke insert, update on public.decks from authenticated;
grant select, delete on public.decks to authenticated;
grant insert (presentation) on public.decks to authenticated;
grant update (presentation, revision) on public.decks to authenticated;
grant select, insert, delete on public.deck_shares to authenticated;

drop policy if exists "Owners and collaborators can read decks" on public.decks;
create policy "Owners and collaborators can read decks"
  on public.decks for select to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.deck_shares s
      where s.deck_id = decks.id and s.email = (select private.current_email())
    )
  );

drop policy if exists "Users create their own decks" on public.decks;
create policy "Users create their own decks"
  on public.decks for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "Owners and collaborators can edit decks" on public.decks;
create policy "Owners and collaborators can edit decks"
  on public.decks for update to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.deck_shares s
      where s.deck_id = decks.id and s.email = (select private.current_email())
    )
  );

drop policy if exists "Owners delete decks" on public.decks;
create policy "Owners delete decks"
  on public.decks for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "Owners and invitees can read shares" on public.deck_shares;
create policy "Owners and invitees can read shares"
  on public.deck_shares for select to authenticated
  using (email = (select private.current_email()) or (select private.is_deck_owner(deck_id)));

drop policy if exists "Owners share decks" on public.deck_shares;
create policy "Owners share decks"
  on public.deck_shares for insert to authenticated
  with check ((select private.is_deck_owner(deck_id)));

-- Owners remove anyone; invitees can leave a deck.
drop policy if exists "Owners and invitees remove shares" on public.deck_shares;
create policy "Owners and invitees remove shares"
  on public.deck_shares for delete to authenticated
  using (email = (select private.current_email()) or (select private.is_deck_owner(deck_id)));

-- ---------------------------------------------------------------------------
-- 4. Slide images
-- ---------------------------------------------------------------------------

-- Public bucket: files are named by a SHA-256 of their content, so URLs
-- can't be guessed, and the editor and PowerPoint export can load them
-- without signing each URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'deck-images',
  'deck-images',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do nothing;

-- Each user uploads into a folder named after their user id.
drop policy if exists "Users upload deck images to their folder" on storage.objects;
create policy "Users upload deck images to their folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'deck-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
