-- Gestão de usuários pelo Painel Domma (sem service role): criar, bloquear, excluir, link de acesso.
alter table public.profiles add column if not exists blocked boolean not null default false;

create table if not exists private.access_tokens (
  token_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create or replace function private.require_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
end $$;

-- Lista de usuários para o Painel
create or replace function public.admin_list_users()
returns table (id uuid, email text, restaurant_name text, is_admin boolean, blocked boolean,
               created_at timestamptz, last_sign_in_at timestamptz, items_count bigint, custom_fees boolean, has_password boolean)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform private.require_admin();
  return query
    select u.id, u.email::text, coalesce(p.restaurant_name, ''), coalesce(p.is_admin, false),
           coalesce(p.blocked, false) or (u.banned_until is not null and u.banned_until > now()),
           u.created_at, u.last_sign_in_at,
           (select count(*) from public.menu_items m where m.user_id = u.id),
           exists (select 1 from jsonb_each(coalesce(p.custom_fees, '{}'::jsonb)) e where coalesce((e.value->>'enabled')::boolean, false)),
           u.encrypted_password is not null and u.encrypted_password <> ''
    from auth.users u left join public.profiles p on p.id = u.id
    order by u.created_at desc;
end $$;

-- Criar usuário (e-mail já confirmado). Sem senha: o cliente define pelo link de acesso.
create or replace function public.admin_create_user(p_email text, p_restaurant text, p_is_admin boolean default false, p_password text default null)
returns uuid
language plpgsql security definer set search_path = public, auth, extensions as $$
declare uid uuid := gen_random_uuid(); e text := lower(trim(p_email));
begin
  perform private.require_admin();
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido'; end if;
  if exists (select 1 from auth.users where lower(email) = e) then raise exception 'Já existe um usuário com este e-mail'; end if;
  if p_password is not null and length(p_password) < 6 then raise exception 'A senha precisa ter pelo menos 6 caracteres'; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', e,
    case when p_password is null then '' else crypt(p_password, gen_salt('bf')) end, now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('restaurant_name', coalesce(p_restaurant, '')),
    now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', e, 'email_verified', true), 'email', null, now(), now());
  update public.profiles set is_admin = coalesce(p_is_admin, false), restaurant_name = coalesce(p_restaurant, '') where id = uid;
  return uid;
end $$;

-- Bloquear / desbloquear (encerra as sessões abertas)
create or replace function public.admin_set_blocked(p_user uuid, p_blocked boolean)
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  perform private.require_admin();
  if p_user = auth.uid() then raise exception 'Você não pode bloquear a própria conta'; end if;
  update auth.users set banned_until = case when p_blocked then timestamptz '2999-12-31 00:00:00+00' else null end, updated_at = now() where id = p_user;
  update public.profiles set blocked = p_blocked where id = p_user;
  if p_blocked then delete from auth.sessions where user_id = p_user; end if;
end $$;

create or replace function public.admin_set_admin(p_user uuid, p_is_admin boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_admin();
  if p_user = auth.uid() and not p_is_admin then raise exception 'Você não pode tirar o próprio acesso de admin'; end if;
  update public.profiles set is_admin = p_is_admin where id = p_user;
end $$;

-- Excluir (apaga perfil e cardápio junto)
create or replace function public.admin_delete_user(p_user uuid)
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  perform private.require_admin();
  if p_user = auth.uid() then raise exception 'Você não pode excluir a própria conta'; end if;
  delete from auth.users where id = p_user;
end $$;

-- Link de acesso: token de uso único (só o hash fica salvo)
create or replace function public.admin_create_access_link(p_user uuid, p_hours int default 72)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare t text := encode(gen_random_bytes(24), 'hex');
begin
  perform private.require_admin();
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'Usuário não encontrado'; end if;
  update private.access_tokens set used_at = now() where user_id = p_user and used_at is null; -- invalida links anteriores
  insert into private.access_tokens (token_hash, user_id, expires_at, created_by)
  values (encode(digest(t, 'sha256'), 'hex'), p_user, now() + make_interval(hours => greatest(1, least(p_hours, 720))), auth.uid());
  return t;
end $$;

-- O cliente abre o link, informa a senha nova e entra. Devolve o e-mail para o login.
create or replace function public.redeem_access_link(p_token text, p_password text)
returns text
language plpgsql security definer set search_path = public, auth, extensions as $$
declare r private.access_tokens; e text;
begin
  if p_password is null or length(p_password) < 6 then raise exception 'A senha precisa ter pelo menos 6 caracteres'; end if;
  select * into r from private.access_tokens where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') for update;
  if r.token_hash is null or r.used_at is not null or r.expires_at < now() then raise exception 'Link inválido ou expirado. Peça um novo link.'; end if;
  if exists (select 1 from public.profiles where id = r.user_id and blocked) then raise exception 'Acesso bloqueado. Fale com a Domma Food.'; end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
    where id = r.user_id returning email into e;
  update private.access_tokens set used_at = now() where token_hash = r.token_hash;
  return e;
end $$;

-- Usuário bloqueado não lê nem grava cardápio, mesmo com token ainda válido
drop policy if exists "cardápio: dono" on public.menu_items;
create policy "cardápio: dono" on public.menu_items for all to authenticated
  using (user_id = (select auth.uid()) and not exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.blocked))
  with check (user_id = (select auth.uid()) and not exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.blocked));

revoke all on function public.admin_list_users(), public.admin_create_user(text, text, boolean, text), public.admin_set_blocked(uuid, boolean),
  public.admin_set_admin(uuid, boolean), public.admin_delete_user(uuid), public.admin_create_access_link(uuid, int) from public, anon;
grant execute on function public.admin_list_users(), public.admin_create_user(text, text, boolean, text), public.admin_set_blocked(uuid, boolean),
  public.admin_set_admin(uuid, boolean), public.admin_delete_user(uuid), public.admin_create_access_link(uuid, int) to authenticated;
revoke all on function public.redeem_access_link(text, text) from public;
grant execute on function public.redeem_access_link(text, text) to anon, authenticated;
