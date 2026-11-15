-- BTS Studio · Tómbola empresarial por compañía
-- Selección aleatoria del lado de PostgreSQL, historial privado y sin mezclar empresas.
create table if not exists public.bts_business_raffle_draws (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.bts_nfc_cards(id) on delete cascade,
  company_slug text not null,
  winner_contact_id uuid not null references public.bts_business_contacts(id) on delete restrict,
  winner_identity text not null,
  winner_name text not null,
  winner_email text not null default '',
  winner_phone text not null default '',
  participant_count integer not null check (participant_count > 0),
  scope text not null check (scope in ('raffle','all')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists bts_raffle_draws_company_time
  on public.bts_business_raffle_draws(company_id,created_at desc);

alter table public.bts_business_raffle_draws enable row level security;

revoke all on public.bts_business_raffle_draws from public, anon, authenticated;
grant select on public.bts_business_raffle_draws to authenticated;
grant all on public.bts_business_raffle_draws to service_role;

drop policy if exists bts_raffle_admin_read on public.bts_business_raffle_draws;
create policy bts_raffle_admin_read on public.bts_business_raffle_draws
for select to authenticated
using (exists (
  select 1 from public.bts_admins a
  where a.user_id = (select auth.uid())
));

-- Solo esta RPC registra ganadores. Los clientes nunca pueden crear ni alterar resultados.
create or replace function public.bts_draw_business_raffle(
  p_company_slug text,
  p_include_all boolean default false,
  p_exclude_previous boolean default true
)
returns table (
  draw_id uuid,
  winner_contact_id uuid,
  full_name text,
  email text,
  phone text,
  participant_count integer,
  drawn_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := auth.uid();
  v_company_id uuid;
  v_contact_id uuid;
  v_identity text;
  v_name text;
  v_email text;
  v_phone text;
  v_count integer;
  v_draw_id uuid;
  v_created_at timestamptz;
begin
  if v_admin_id is null or not exists (
    select 1 from public.bts_admins a where a.user_id = v_admin_id
  ) then
    raise exception 'No tenés permisos para realizar sorteos.' using errcode = '42501';
  end if;

  select c.id into v_company_id
  from public.bts_nfc_cards c
  where c.slug = trim(coalesce(p_company_slug,'')) and c.is_active = true
  limit 1;

  if v_company_id is null then
    raise exception 'La empresa no existe o está inactiva.';
  end if;

  -- Una sola oportunidad por número telefónico normalizado (últimos 8 dígitos)
  -- o por correo en minúsculas. La inscripción más antigua representa a la persona.
  with eligible as (
    select c.id, c.full_name, c.email, c.phone, c.created_at,
      case
        when length(regexp_replace(coalesce(c.phone,''),'[^0-9]','','g')) >= 8
        then 'p:' || right(regexp_replace(c.phone,'[^0-9]','','g'),8)
        when trim(coalesce(c.email,'')) <> ''
        then 'e:' || lower(trim(c.email))
        else 'i:' || c.id::text
      end as identity_key
    from public.bts_business_contacts c
    where c.company_id = v_company_id
      and (
        coalesce(p_include_all,false)
        or c.subject ~* 'rifa|sorteo|t[oó]mbola|particip|ganar'
        or c.message ~* 'rifa|sorteo|t[oó]mbola'
      )
  ), unique_people as (
    select distinct on (identity_key)
      id, full_name, email, phone, identity_key
    from eligible
    order by identity_key, created_at, id
  ), available as (
    select u.* from unique_people u
    where not coalesce(p_exclude_previous,true)
      or not exists (
        select 1 from public.bts_business_raffle_draws d
        where d.company_id = v_company_id and d.winner_identity = u.identity_key
      )
  )
  select a.id,a.identity_key,a.full_name,a.email,a.phone,
         (select count(*)::integer from available)
    into v_contact_id,v_identity,v_name,v_email,v_phone,v_count
  from available a
  order by gen_random_uuid()
  limit 1;

  if v_contact_id is null then
    raise exception 'No hay participantes disponibles. Revisá el tipo de registros o la opción de excluir ganadores anteriores.';
  end if;

  insert into public.bts_business_raffle_draws (
    company_id,company_slug,winner_contact_id,winner_identity,
    winner_name,winner_email,winner_phone,participant_count,scope,created_by
  )
  values (
    v_company_id,trim(p_company_slug),v_contact_id,v_identity,
    v_name,coalesce(v_email,''),coalesce(v_phone,''),v_count,
    case when coalesce(p_include_all,false) then 'all' else 'raffle' end,v_admin_id
  )
  returning id,created_at into v_draw_id,v_created_at;

  return query select v_draw_id,v_contact_id,v_name,v_email,v_phone,v_count,v_created_at;
end;
$$;

revoke all on function public.bts_draw_business_raffle(text,boolean,boolean)
  from public, anon, authenticated;
grant execute on function public.bts_draw_business_raffle(text,boolean,boolean)
  to authenticated, service_role;
