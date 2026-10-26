-- =====================================================================
--  KELİME OYUNU — Supabase kurulum betiği
--  Supabase > SQL Editor > New query > bu dosyanın tamamını yapıştır > Run
--  Tekrar çalıştırmak güvenlidir (var olan veriyi silmez).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Öğretmen profilleri ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- İlk kayıt olan öğretmen otomatik olarak yönetici olur.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, is_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    not exists (select 1 from public.profiles)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

drop policy if exists "profil okuma" on public.profiles;
create policy "profil okuma" on public.profiles
  for select to authenticated using (true);
drop policy if exists "profil guncelleme" on public.profiles;
create policy "profil guncelleme" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid()));

-- ---------- Kitaplar ve üniteler (bütün öğretmenler ortak görür) ----------
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  cover_url text,
  sort integer not null default 0,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.books enable row level security;

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  number integer not null default 1,
  title text,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.units enable row level security;
create index if not exists units_book_idx on public.units(book_id);

do $$
declare t text;
begin
  foreach t in array array['books','units'] loop
    execute format('drop policy if exists "okuma" on public.%I', t);
    execute format('create policy "okuma" on public.%I for select to authenticated using (true)', t);
    execute format('drop policy if exists "ekleme" on public.%I', t);
    execute format('create policy "ekleme" on public.%I for insert to authenticated with check (created_by = auth.uid())', t);
    execute format('drop policy if exists "duzenleme" on public.%I', t);
    execute format('create policy "duzenleme" on public.%I for update to authenticated using (created_by = auth.uid() or public.is_admin())', t);
    execute format('drop policy if exists "silme" on public.%I', t);
    execute format('create policy "silme" on public.%I for delete to authenticated using (created_by = auth.uid() or public.is_admin())', t);
  end loop;
end $$;

-- ---------- Setler ve maddeler (öğretmene özel; istenirse herkese açık) ----------
create table if not exists public.sets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null,
  kind text not null default 'words' check (kind in ('words','questions')),
  book_id uuid references public.books(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  topic text,
  is_public boolean not null default false,
  item_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sets enable row level security;
create index if not exists sets_owner_idx on public.sets(owner_id);
create index if not exists sets_book_idx on public.sets(book_id);

drop policy if exists "set okuma" on public.sets;
create policy "set okuma" on public.sets for select to authenticated
  using (owner_id = auth.uid() or is_public or public.is_admin());
drop policy if exists "set ekleme" on public.sets;
create policy "set ekleme" on public.sets for insert to authenticated
  with check (owner_id = auth.uid());
drop policy if exists "set duzenleme" on public.sets;
create policy "set duzenleme" on public.sets for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "set silme" on public.sets;
create policy "set silme" on public.sets for delete to authenticated
  using (owner_id = auth.uid());

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.sets(id) on delete cascade,
  position integer not null default 0,
  topic text,
  -- kelime alanları
  tr text, en text, ky text, ru text,
  image_url text,
  -- soru alanları
  prompt text,
  prompt_image text,
  answer text,
  answer_image text,
  wrongs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.items enable row level security;
create index if not exists items_set_idx on public.items(set_id, position);

drop policy if exists "madde okuma" on public.items;
create policy "madde okuma" on public.items for select to authenticated
  using (exists (select 1 from public.sets s where s.id = set_id
                 and (s.owner_id = auth.uid() or s.is_public or public.is_admin())));
drop policy if exists "madde yazma" on public.items;
create policy "madde yazma" on public.items for all to authenticated
  using (exists (select 1 from public.sets s where s.id = set_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.sets s where s.id = set_id and s.owner_id = auth.uid()));

-- ---------- Ödevler ----------
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  set_id uuid references public.sets(id) on delete set null,
  set_title text,
  kind text not null default 'words',
  title text not null,
  class_name text,
  game_type text not null default 'test',
  question_count integer not null default 10,
  time_limit integer not null default 0,
  direction text not null default 'mixed',
  langs text[] not null default array['en','ky','ru'],
  due_at timestamptz,
  is_open boolean not null default true,
  slug text not null unique,
  items jsonb not null default '[]'::jsonb,   -- ödev oluşturulduğu andaki maddelerin kopyası
  created_at timestamptz not null default now()
);
alter table public.assignments enable row level security;
create index if not exists assignments_owner_idx on public.assignments(owner_id, created_at desc);

drop policy if exists "odev sahibi" on public.assignments;
create policy "odev sahibi" on public.assignments for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------- Öğrenci denemeleri ----------
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_name text not null,
  name_key text not null,
  lang text,
  attempt_no integer not null default 1,
  score integer not null default 0,
  max_score integer not null default 0,
  correct integer not null default 0,
  wrong integer not null default 0,
  total integer not null default 0,
  duration_ms integer not null default 0,
  answers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.attempts enable row level security;
create index if not exists attempts_assignment_idx on public.attempts(assignment_id, created_at);

drop policy if exists "deneme okuma" on public.attempts;
create policy "deneme okuma" on public.attempts for select to authenticated
  using (exists (select 1 from public.assignments a where a.id = assignment_id and a.owner_id = auth.uid()));
drop policy if exists "deneme silme" on public.attempts;
create policy "deneme silme" on public.attempts for delete to authenticated
  using (exists (select 1 from public.assignments a where a.id = assignment_id and a.owner_id = auth.uid()));

-- ---------- Öğrencinin (hesapsız) kullandığı iki fonksiyon ----------
create or replace function public.get_assignment_public(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a public.assignments;
begin
  select * into a from public.assignments where slug = p_slug;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if not a.is_open then
    return jsonb_build_object('status', 'closed', 'title', a.title);
  end if;
  if a.due_at is not null and now() > a.due_at then
    return jsonb_build_object('status', 'expired', 'title', a.title);
  end if;
  return jsonb_build_object(
    'status', 'ok',
    'title', a.title,
    'class_name', a.class_name,
    'kind', a.kind,
    'game_type', a.game_type,
    'question_count', a.question_count,
    'time_limit', a.time_limit,
    'direction', a.direction,
    'langs', to_jsonb(a.langs),
    'due_at', a.due_at,
    'items', a.items
  );
end $$;

create or replace function public.submit_attempt(
  p_slug text, p_name text, p_lang text,
  p_score integer, p_max integer, p_correct integer, p_wrong integer, p_total integer,
  p_duration integer, p_answers jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a public.assignments;
  k text;
  n integer;
  new_id uuid;
begin
  select * into a from public.assignments where slug = p_slug;
  if not found then raise exception 'Ödev bulunamadı'; end if;
  if not a.is_open then raise exception 'Ödev kapalı'; end if;
  -- son tarihten sonra 30 dakika tolerans (oyuna önceden başlayanlar için)
  if a.due_at is not null and now() > a.due_at + interval '30 minutes' then
    raise exception 'Son tarih geçti';
  end if;
  if p_name is null or length(trim(p_name)) < 2 or length(p_name) > 80 then
    raise exception 'Geçersiz ad';
  end if;
  if pg_column_size(p_answers) > 200000 then raise exception 'Veri çok büyük'; end if;

  k := lower(regexp_replace(trim(p_name), '\s+', ' ', 'g'));
  select count(*) + 1 into n from public.attempts where assignment_id = a.id and name_key = k;

  insert into public.attempts (assignment_id, student_name, name_key, lang, attempt_no,
    score, max_score, correct, wrong, total, duration_ms, answers)
  values (a.id, trim(p_name), k, left(p_lang, 5), n,
    greatest(p_score, 0), greatest(p_max, 0), greatest(p_correct, 0), greatest(p_wrong, 0),
    greatest(p_total, 0), greatest(p_duration, 0), coalesce(p_answers, '[]'::jsonb))
  returning id into new_id;

  return jsonb_build_object('id', new_id, 'attempt_no', n);
end $$;

-- Öğretmenin ödev listesindeki katılımcı sayıları
create or replace function public.my_assignment_stats()
returns table (assignment_id uuid, students bigint, attempts bigint)
language sql stable security invoker set search_path = public as $$
  select t.assignment_id, count(distinct t.name_key), count(*)
  from public.attempts t
  join public.assignments a on a.id = t.assignment_id
  where a.owner_id = auth.uid()
  group by t.assignment_id;
$$;

revoke all on function public.get_assignment_public(text) from public;
revoke all on function public.submit_attempt(text,text,text,integer,integer,integer,integer,integer,integer,jsonb) from public;
grant execute on function public.get_assignment_public(text) to anon, authenticated;
grant execute on function public.submit_attempt(text,text,text,integer,integer,integer,integer,integer,integer,jsonb) to anon, authenticated;
grant execute on function public.my_assignment_stats() to authenticated;

-- ---------- Resim deposu ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 3145728, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true;

drop policy if exists "resim yukleme" on storage.objects;
create policy "resim yukleme" on storage.objects for insert to authenticated
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "resim guncelleme" on storage.objects;
create policy "resim guncelleme" on storage.objects for update to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "resim silme" on storage.objects;
create policy "resim silme" on storage.objects for delete to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

-- Bitti. "Success. No rows returned" yazısını görürsen kurulum tamamdır.
