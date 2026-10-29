-- Oracle worldwide catalog
-- Apply via: Dashboard SQL editor, or
--   DATABASE_URL=... node scripts/apply-supabase-schema.mjs
--   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-supabase-schema.mjs
--
-- Client uses publishable key only. Permissive RLS is intentional for this
-- private portal (anyone with the publishable key can R/W). Rotate the
-- project secret if it was pasted in chat; never ship the secret in the bundle.

create extension if not exists "pgcrypto";

-- Single JSON document (fast path — mirrors prior crudcrud shape)
create table if not exists public.oracle_catalog (
  id text primary key default 'main',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.oracle_catalog enable row level security;

drop policy if exists "oracle_catalog_select_all" on public.oracle_catalog;
drop policy if exists "oracle_catalog_insert_all" on public.oracle_catalog;
drop policy if exists "oracle_catalog_update_all" on public.oracle_catalog;
drop policy if exists "oracle_catalog_delete_all" on public.oracle_catalog;

create policy "oracle_catalog_select_all"
  on public.oracle_catalog for select
  to anon, authenticated
  using (true);

create policy "oracle_catalog_insert_all"
  on public.oracle_catalog for insert
  to anon, authenticated
  with check (true);

create policy "oracle_catalog_update_all"
  on public.oracle_catalog for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "oracle_catalog_delete_all"
  on public.oracle_catalog for delete
  to anon, authenticated
  using (true);

grant select, insert, update, delete on public.oracle_catalog to anon, authenticated, service_role;

insert into public.oracle_catalog (id, payload, updated_at)
values (
  'main',
  '{"keys":[],"reactivated":[],"eas":[],"activations":[],"mentors":[],"subscriptions":[],"updatedAt":"1970-01-01T00:00:00.000Z"}'::jsonb,
  now()
)
on conflict (id) do nothing;

-- Normalized tables (optional query surface; app still uses oracle_catalog JSON)
create table if not exists public.license_keys (
  id text primary key,
  key text not null unique,
  bound_email text,
  created_at timestamptz default now(),
  meta jsonb not null default '{}'::jsonb
);

create table if not exists public.eas (
  id text primary key,
  name text not null,
  image_uri text,
  created_at timestamptz default now(),
  meta jsonb not null default '{}'::jsonb
);

create table if not exists public.mentors (
  id text primary key,
  email text,
  name text,
  mentor_name text,
  whatsapp text,
  instagram text,
  status text not null default 'waiting' check (status in ('waiting', 'approved')),
  keys_allowed int not null default 0,
  keys_used int not null default 0,
  registered_at timestamptz default now(),
  meta jsonb not null default '{}'::jsonb
);

create table if not exists public.subscriptions (
  id text primary key,
  email text not null,
  status text not null default 'awaiting' check (status in ('awaiting', 'approved', 'declined')),
  paid_at timestamptz default now(),
  plan text,
  meta jsonb not null default '{}'::jsonb
);

create table if not exists public.reactivated_emails (
  email text primary key,
  status text not null default 'active',
  reactivated_at timestamptz default now(),
  meta jsonb not null default '{}'::jsonb
);

create table if not exists public.key_activations (
  id text primary key,
  email text not null,
  key text not null,
  activated_at timestamptz default now(),
  ea_id text,
  ea_name text,
  meta jsonb not null default '{}'::jsonb
);

alter table public.license_keys enable row level security;
alter table public.eas enable row level security;
alter table public.mentors enable row level security;
alter table public.subscriptions enable row level security;
alter table public.reactivated_emails enable row level security;
alter table public.key_activations enable row level security;

-- Permissive policies (private app tradeoff — same as open publishable write)
do $$
declare
  t text;
begin
  foreach t in array array[
    'license_keys', 'eas', 'mentors', 'subscriptions', 'reactivated_emails', 'key_activations'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (true) with check (true)',
      t || '_all', t
    );
    execute format(
      'grant select, insert, update, delete on public.%I to anon, authenticated, service_role',
      t
    );
  end loop;
end $$;

-- Storage: allow authenticated + anon R/W on oracle bucket objects (for catalog.json mirror)
-- Requires storage schema privileges; safe no-op if policy names collide.
do $$
begin
  begin
    drop policy if exists "oracle_storage_select" on storage.objects;
    drop policy if exists "oracle_storage_insert" on storage.objects;
    drop policy if exists "oracle_storage_update" on storage.objects;
    drop policy if exists "oracle_storage_delete" on storage.objects;

    create policy "oracle_storage_select"
      on storage.objects for select
      to anon, authenticated
      using (bucket_id = 'oracle');

    create policy "oracle_storage_insert"
      on storage.objects for insert
      to anon, authenticated
      with check (bucket_id = 'oracle');

    create policy "oracle_storage_update"
      on storage.objects for update
      to anon, authenticated
      using (bucket_id = 'oracle')
      with check (bucket_id = 'oracle');

    create policy "oracle_storage_delete"
      on storage.objects for delete
      to anon, authenticated
      using (bucket_id = 'oracle');
  exception when others then
    raise notice 'storage policies skipped: %', sqlerrm;
  end;
end $$;
