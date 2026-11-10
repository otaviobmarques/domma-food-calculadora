-- Domma Calculadora iFood — esquema inicial
-- Taxas ficam versionadas no banco: nada fixo no código.

create extension if not exists pgcrypto;

-- ───────────── Perfis (1 por usuário) ─────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  restaurant_name text not null default '',
  is_admin boolean not null default false,
  plan_choice jsonb not null default '{"ifood":"basico","99food":"campanha"}'::jsonb,
  custom_fees jsonb not null default '{}'::jsonb,     -- { "ifood": {"enabled":true,"commission":10,"online":2.9} }
  ack_versions jsonb not null default '{}'::jsonb,    -- última versão de taxa que o cliente viu, por app
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, restaurant_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'restaurant_name', new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────── Tabela central de taxas, com versões ─────────────
create table public.fee_versions (
  id uuid primary key default gen_random_uuid(),
  app text not null check (app in ('ifood','keeta','99food','aiqfome')),
  label text not null,                                  -- "nov/2026"
  kind text not null check (kind in ('oficial','estimativa')),
  plans jsonb not null check (jsonb_typeof(plans) = 'array' and jsonb_array_length(plans) > 0),
  source_url text not null check (source_url ~* '^https?://'),   -- toda publicação precisa de fonte
  source_label text,
  notes text,
  valid_from date not null default current_date,
  status text not null default 'draft' check (status in ('draft','published')),
  notify boolean not null default true,
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index fee_versions_current_idx on public.fee_versions (app, status, valid_from desc, published_at desc);

create or replace function public.fee_versions_set_published_at() returns trigger
language plpgsql as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    new.published_at := now();
  end if;
  return new;
end $$;
create trigger fee_versions_published_at before insert or update on public.fee_versions
  for each row execute function public.fee_versions_set_published_at();

-- Versão em vigor por app (consulta pronta para relatórios / integrações)
create or replace view public.current_fee_versions with (security_invoker = true) as
  select distinct on (app) *
  from public.fee_versions
  where status = 'published' and valid_from <= current_date
  order by app, valid_from desc, published_at desc;

-- ───────────── Cardápio ─────────────
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  target_net numeric(10,2) not null check (target_net > 0),
  current_price numeric(10,2) check (current_price is null or current_price >= 0),
  ideal_price numeric(10,2),
  ideal_rate numeric(8,6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index menu_items_user_idx on public.menu_items (user_id, created_at);

-- ───────────── Verificação automática dos sites ─────────────
create table public.fee_sources (
  app text primary key check (app in ('ifood','keeta','99food','aiqfome')),
  url text not null,
  auto_check boolean not null default false
);
create table public.source_checks (
  id uuid primary key default gen_random_uuid(),
  app text not null,
  url text not null,
  fingerprint text,
  changed boolean not null default false,
  error text,
  checked_at timestamptz not null default now()
);
create index source_checks_app_idx on public.source_checks (app, checked_at desc);

-- ───────────── Segurança (RLS) ─────────────
alter table public.profiles enable row level security;
alter table public.fee_versions enable row level security;
alter table public.menu_items enable row level security;
alter table public.fee_sources enable row level security;
alter table public.source_checks enable row level security;

create policy "perfil: ler o próprio" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "perfil: editar o próprio" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- o cliente não pode se promover a admin
revoke update on public.profiles from authenticated;
grant update (restaurant_name, plan_choice, custom_fees, ack_versions) on public.profiles to authenticated;

create policy "taxas: todos leem as publicadas" on public.fee_versions for select to anon, authenticated
  using (status = 'published' or public.is_admin());
create policy "taxas: admin cria" on public.fee_versions for insert to authenticated with check (public.is_admin());
create policy "taxas: admin edita" on public.fee_versions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "taxas: admin apaga rascunho" on public.fee_versions for delete to authenticated using (public.is_admin() and status = 'draft');

create policy "cardápio: dono" on public.menu_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "fontes: admin" on public.fee_sources for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "verificações: admin lê" on public.source_checks for select to authenticated using (public.is_admin());

-- Indicadores do painel
create or replace function public.admin_stats() returns json
language plpgsql stable security definer set search_path = public as $$
declare r json;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select json_build_object(
    'client_count', (select count(*) from profiles where not is_admin),
    'custom_count', (select count(*) from profiles p where exists (
        select 1 from jsonb_each(p.custom_fees) e where coalesce((e.value->>'enabled')::boolean, false))),
    'last_check', (select row_to_json(s) from source_checks s order by checked_at desc limit 1)
  ) into r;
  return r;
end $$;
grant execute on function public.admin_stats() to authenticated;

-- Atualização automática nos apps dos clientes (Supabase Realtime)
alter publication supabase_realtime add table public.fee_versions;

-- ───────────── Dados iniciais: tabelas de referência nov/2026 ─────────────
insert into public.fee_sources (app, url, auto_check) values
  ('ifood',   'https://parceiros.ifood.com.br/', true),
  ('keeta',   'https://www.meioemensagem.com.br/', false),
  ('99food',  'https://www.infomoney.com.br/', false),
  ('aiqfome', 'https://neofeed.com.br/', false);

insert into public.fee_versions (app, label, kind, plans, source_url, source_label, valid_from, status, notify) values
  ('ifood', 'nov/2026', 'oficial',
   '[{"key":"basico","name":"Básico","subtitle":"você entrega","commission":12,"online":3.2,"monthly":110,"monthly_threshold":1800},
     {"key":"entrega","name":"Entrega","subtitle":"entregador iFood","commission":23,"online":3.2,"monthly":150,"monthly_threshold":1800}]',
   'https://parceiros.ifood.com.br/', 'Tabela pública', '2026-11-10', 'published', false),
  ('keeta', 'nov/2026', 'estimativa',
   '[{"key":"padrao","name":"Padrão","commission":9,"online":3.2}]',
   'https://www.meioemensagem.com.br/', 'Sem tabela pública (2 a 3 pontos abaixo do líder)', '2026-11-10', 'published', false),
  ('99food', 'nov/2026', 'estimativa',
   '[{"key":"campanha","name":"Campanha","subtitle":"comissão zero","commission":0,"online":3.2},
     {"key":"depois","name":"Depois","subtitle":"após a campanha","commission":12,"online":3.2}]',
   'https://www.infomoney.com.br/', 'Campanha de entrada (até 24 meses)', '2026-11-10', 'published', false),
  ('aiqfome', 'nov/2026', 'estimativa',
   '[{"key":"padrao","name":"Padrão","commission":10,"online":3.2}]',
   'https://neofeed.com.br/', 'Média declarada (9% a 10%)', '2026-11-10', 'published', false);

-- Para tornar alguém admin da Domma (rodar no SQL Editor):
--   update public.profiles set is_admin = true where id = (select id from auth.users where email = 'equipe@domma.com.br');
