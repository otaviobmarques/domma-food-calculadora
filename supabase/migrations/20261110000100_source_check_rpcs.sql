-- Rotina diária sem service role: funções protegidas por admin logado OU pelo CRON_SECRET.
drop policy "taxas: todos leem as publicadas" on public.fee_versions;
create policy "taxas: anon lê publicadas" on public.fee_versions for select to anon using (status = 'published');
create policy "taxas: logados leem publicadas (admin tudo)" on public.fee_versions for select to authenticated
  using (status = 'published' or public.is_admin());
revoke execute on function public.is_admin() from anon, public;
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.admin_stats() from anon, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.app_config (key text primary key, value text not null);
-- Depois de rodar, grave o hash do seu CRON_SECRET (não commite o segredo):
--   insert into private.app_config values ('cron_secret_sha256', encode(extensions.digest('SEU_CRON_SECRET','sha256'),'hex'));

create or replace function private.can_check(p_secret text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select public.is_admin()
      or (p_secret is not null and encode(extensions.digest(p_secret, 'sha256'), 'hex')
          = (select value from private.app_config where key = 'cron_secret_sha256'))
$$;

create or replace function public.get_fee_sources(p_secret text default null)
returns setof public.fee_sources
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.can_check(p_secret) then raise exception 'not allowed'; end if;
  return query select * from public.fee_sources where auto_check;
end $$;

create or replace function public.record_source_check(p_app text, p_url text, p_fingerprint text, p_error text, p_secret text default null)
returns public.source_checks
language plpgsql security definer set search_path = public as $$
declare last_fp text; r public.source_checks;
begin
  if not private.can_check(p_secret) then raise exception 'not allowed'; end if;
  select fingerprint into last_fp from public.source_checks
    where app = p_app and fingerprint is not null order by checked_at desc limit 1;
  insert into public.source_checks (app, url, fingerprint, changed, error)
  values (p_app, p_url, p_fingerprint, p_fingerprint is not null and last_fp is not null and last_fp <> p_fingerprint, p_error)
  returning * into r;
  return r;
end $$;

revoke execute on function public.get_fee_sources(text) from public;
revoke execute on function public.record_source_check(text, text, text, text, text) from public;
grant execute on function public.get_fee_sources(text) to anon, authenticated;
grant execute on function public.record_source_check(text, text, text, text, text) to anon, authenticated;
