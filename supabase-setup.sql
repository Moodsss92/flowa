-- ════════════════════════════════════════════════════════════════
-- FLOWA — Setup Supabase pour le formulaire de contact
-- ════════════════════════════════════════════════════════════════
-- À coller dans : Supabase Dashboard → SQL Editor → New query → Run
-- ════════════════════════════════════════════════════════════════

-- 1. Table des leads
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  first_name  text not null,
  last_name   text not null,
  email       text not null,
  service     text,
  message     text not null,
  status      text not null default 'new',     -- 'new' | 'contacted' | 'won' | 'lost'
  source      text not null default 'website',
  notes       text
);

-- Index pour retrouver les leads récents rapidement
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_status_idx      on public.leads (status);

-- 2. Activer Row Level Security
alter table public.leads enable row level security;

-- 3. Policies

-- Policy 1 : le public (anon) peut INSÉRER des leads depuis le site
-- (mais ne peut rien lire — protection des données)
drop policy if exists "public can insert leads" on public.leads;
create policy "public can insert leads"
  on public.leads
  for insert
  to anon
  with check (true);

-- Policy 2 : toi (connecté en tant qu'admin) peux tout lire
drop policy if exists "authenticated can read leads" on public.leads;
create policy "authenticated can read leads"
  on public.leads
  for select
  to authenticated
  using (true);

-- Policy 3 : toi peux mettre à jour le statut/notes
drop policy if exists "authenticated can update leads" on public.leads;
create policy "authenticated can update leads"
  on public.leads
  for update
  to authenticated
  using (true)
  with check (true);

-- 4. Colonnes supplémentaires pour le funnel multi-étapes
alter table public.leads add column if not exists phone  text;
alter table public.leads add column if not exists budget text;

-- ════════════════════════════════════════════════════════════════
-- ✅ Terminé. Ta table est prête.
-- Va maintenant dans Settings → API pour récupérer :
--    - Project URL   → à mettre dans SUPABASE_URL
--    - anon public   → à mettre dans SUPABASE_ANON_KEY
-- ════════════════════════════════════════════════════════════════
