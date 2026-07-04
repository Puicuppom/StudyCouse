-- รัน SQL นี้ใน Supabase Dashboard → SQL Editor
-- https://supabase.com/dashboard/project/rwsyiiulfbolymxppvmy/sql/new

create table if not exists public.study_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.study_links (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.study_categories (id) on delete cascade,
  title text not null,
  url text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists study_links_category_id_idx on public.study_links (category_id);

alter table public.study_categories enable row level security;
alter table public.study_links enable row level security;

create policy "study_categories_select" on public.study_categories
  for select to anon, authenticated using (true);

create policy "study_categories_insert" on public.study_categories
  for insert to anon, authenticated with check (true);

create policy "study_categories_update" on public.study_categories
  for update to anon, authenticated using (true) with check (true);

create policy "study_categories_delete" on public.study_categories
  for delete to anon, authenticated using (true);

create policy "study_links_select" on public.study_links
  for select to anon, authenticated using (true);

create policy "study_links_insert" on public.study_links
  for insert to anon, authenticated with check (true);

create policy "study_links_update" on public.study_links
  for update to anon, authenticated using (true) with check (true);

create policy "study_links_delete" on public.study_links
  for delete to anon, authenticated using (true);
