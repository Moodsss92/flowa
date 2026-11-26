-- =====================================================================
-- Journal de configuration SAP — Philo Televisions
-- Migration initiale : tables, RLS, Storage, Realtime
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- members : qui est qui (1 ligne par utilisateur Supabase)
-- ---------------------------------------------------------------------
create table if not exists public.members (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null check (name in ('Moad', 'Armel', 'Mazen', 'Thomas')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- steps : une étape de configuration
-- ---------------------------------------------------------------------
create table if not exists public.steps (
  id         uuid primary key default gen_random_uuid(),
  num        text not null default '',
  bloc       text not null default '',
  titre      text not null default '',
  tcode      text not null default '',
  chemin     text not null default '',
  action     text not null default '',
  valeurs    text not null default '',
  controle   text not null default '',
  remarque   text not null default '',
  resp       text not null default '',
  statut     text not null default 'afaire'
             check (statut in ('afaire', 'encours', 'fait', 'probleme')),
  author_id  uuid references auth.users (id) on delete set null default auth.uid(),
  updated_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists steps_bloc_idx on public.steps (bloc);
create index if not exists steps_resp_idx on public.steps (resp);

-- ---------------------------------------------------------------------
-- captures : captures d'écran d'une étape (fichiers dans le bucket « captures »)
-- ---------------------------------------------------------------------
create table if not exists public.captures (
  id         uuid primary key default gen_random_uuid(),
  step_id    uuid not null references public.steps (id) on delete cascade,
  path       text not null,
  legende    text not null default '',
  position   int  not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists captures_step_idx on public.captures (step_id, position);

-- ---------------------------------------------------------------------
-- updated_at / updated_by automatiques
-- ---------------------------------------------------------------------
create or replace function public.touch_step()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'INSERT' then
    new.author_id := coalesce(new.author_id, auth.uid());
  else
    new.author_id := old.author_id;      -- l'auteur d'origine ne change pas
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists steps_touch on public.steps;
create trigger steps_touch
  before insert or update on public.steps
  for each row execute function public.touch_step();

-- Ajouter / retirer une capture met aussi à jour la fiche (dernière mise à jour)
create or replace function public.touch_step_from_capture()
returns trigger
language plpgsql
as $$
begin
  update public.steps
     set updated_at = now()
   where id = coalesce(new.step_id, old.step_id);
  return null;
end;
$$;

drop trigger if exists captures_touch on public.captures;
create trigger captures_touch
  after insert or update or delete on public.captures
  for each row execute function public.touch_step_from_capture();

-- ---------------------------------------------------------------------
-- Row Level Security
-- Tout membre connecté lit tout et peut créer / modifier / supprimer
-- toutes les étapes (travail d'équipe).
-- ---------------------------------------------------------------------
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.members where id = auth.uid());
$$;

alter table public.members  enable row level security;
alter table public.steps    enable row level security;
alter table public.captures enable row level security;

-- members : chacun voit l'équipe, ne crée / modifie que sa propre ligne
drop policy if exists members_select on public.members;
create policy members_select on public.members
  for select to authenticated using (true);

drop policy if exists members_insert on public.members;
create policy members_insert on public.members
  for insert to authenticated with check (id = auth.uid());

drop policy if exists members_update on public.members;
create policy members_update on public.members
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- steps
drop policy if exists steps_all on public.steps;
create policy steps_all on public.steps
  for all to authenticated
  using (public.is_member())
  with check (public.is_member());

-- captures
drop policy if exists captures_all on public.captures;
create policy captures_all on public.captures
  for all to authenticated
  using (public.is_member())
  with check (public.is_member());

-- ---------------------------------------------------------------------
-- Storage : bucket privé « captures » (accès par URL signée)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('captures', 'captures', false, 10485760,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set public = false;

drop policy if exists captures_read on storage.objects;
create policy captures_read on storage.objects
  for select to authenticated
  using (bucket_id = 'captures' and public.is_member());

drop policy if exists captures_insert on storage.objects;
create policy captures_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'captures' and public.is_member());

drop policy if exists captures_update on storage.objects;
create policy captures_update on storage.objects
  for update to authenticated
  using (bucket_id = 'captures' and public.is_member());

drop policy if exists captures_delete on storage.objects;
create policy captures_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'captures' and public.is_member());

-- ---------------------------------------------------------------------
-- Realtime : les changements des autres apparaissent sans recharger
-- (replica identity full → les DELETE transportent toute la ligne)
-- ---------------------------------------------------------------------
alter table public.steps    replica identity full;
alter table public.captures replica identity full;
alter table public.members  replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.steps;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.captures;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.members;
  exception when duplicate_object then null;
  end;
end $$;
