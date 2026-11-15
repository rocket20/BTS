-- Campañas nuevas de rifas: contactos anteriores quedan archivados sin modificaciones.
create table if not exists public.bts_business_raffle_campaigns(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.bts_nfc_cards(id) on delete cascade,
 company_slug text not null,
 label text not null default 'Nueva rifa',
 started_at timestamptz not null default now(),
 ended_at timestamptz,
 created_by uuid references auth.users(id),
 constraint bts_business_raffle_campaigns_dates check (ended_at is null or ended_at>=started_at)
);
create unique index if not exists bts_business_raffle_one_active on public.bts_business_raffle_campaigns(company_id) where ended_at is null;
create index if not exists bts_business_raffle_history on public.bts_business_raffle_campaigns(company_id,started_at desc);
alter table public.bts_business_raffle_campaigns enable row level security;
revoke all on public.bts_business_raffle_campaigns from public,anon,authenticated;
grant select on public.bts_business_raffle_campaigns to authenticated;
grant all on public.bts_business_raffle_campaigns to service_role;
drop policy if exists bts_raffle_campaigns_admin_read on public.bts_business_raffle_campaigns;
create policy bts_raffle_campaigns_admin_read
on public.bts_business_raffle_campaigns for select to authenticated
using (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())));

alter table public.bts_business_contacts add column if not exists raffle_campaign_id uuid
 references public.bts_business_raffle_campaigns(id) on delete set null;
alter table public.bts_business_contacts add column if not exists raffle_opt_in boolean not null default false;
create index if not exists bts_business_contacts_campaign_index
 on public.bts_business_contacts(raffle_campaign_id,created_at desc);
-- Crear nuevas campañas SOLO para estas dos empresas; los contactos previos mantienen campaign_id NULL.
insert into public.bts_business_raffle_campaigns(company_id,company_slug,label)
select id,slug,'Nueva rifa'
from public.bts_nfc_cards
where slug in ('arcasupply','dante-nicaragua')
  and not exists(select 1 from public.bts_business_raffle_campaigns x where x.company_id=bts_nfc_cards.id and x.ended_at is null);

create or replace function public.bts_stamp_business_contact_raffle()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  -- Nunca confiar en un campaign_id enviado por un visitante.
  select c.id into new.raffle_campaign_id
  from public.bts_business_raffle_campaigns c
  where c.company_id=new.company_id and c.company_slug=new.company_slug and c.ended_at is null
  limit 1;
  return new;
end;
$$;
revoke all on function public.bts_stamp_business_contact_raffle() from public,anon,authenticated;
drop trigger if exists bts_contacts_assign_active_raffle on public.bts_business_contacts;
create trigger bts_contacts_assign_active_raffle before insert on public.bts_business_contacts
for each row execute function public.bts_stamp_business_contact_raffle();

alter table public.bts_business_raffle_draws add column if not exists campaign_id uuid
 references public.bts_business_raffle_campaigns(id) on delete restrict;
create index if not exists bts_raffle_draw_campaign on public.bts_business_raffle_draws(campaign_id,created_at desc);

create or replace function public.bts_start_business_raffle(p_company_slug text)
returns table(campaign_id uuid,started_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_admin uuid:=auth.uid(); v_company uuid; v_id uuid; v_when timestamptz;
begin
 if v_admin is null or not exists(select 1 from public.bts_admins a where a.user_id=v_admin)
 then raise exception 'No tenés permisos para crear rifas.' using errcode='42501'; end if;
 select c.id into v_company from public.bts_nfc_cards c
 where c.slug=trim(coalesce(p_company_slug,'')) and c.is_active=true for update;
 if v_company is null then raise exception 'Empresa no encontrada o inactiva'; end if;
 update public.bts_business_raffle_campaigns set ended_at=now()
 where company_id=v_company and ended_at is null;
 insert into public.bts_business_raffle_campaigns(company_id,company_slug,created_by)
 values(v_company,trim(p_company_slug),v_admin)
 returning id,public.bts_business_raffle_campaigns.started_at into v_id,v_when;
 return query select v_id,v_when;
end;
$$;
revoke all on function public.bts_start_business_raffle(text) from public,anon,authenticated;
grant execute on function public.bts_start_business_raffle(text) to authenticated,service_role;

create or replace function public.bts_draw_business_raffle(
 p_company_slug text,p_include_all boolean default false,p_exclude_previous boolean default true
)
returns table (
 draw_id uuid,winner_contact_id uuid,full_name text,email text,phone text,
 participant_count integer,drawn_at timestamptz
)
language plpgsql security definer set search_path='' as $$
declare
 v_admin uuid:=auth.uid(); v_company uuid; v_campaign uuid; v_contact uuid;
 v_key text; v_name text; v_email text; v_phone text; v_total int;
 v_draw uuid; v_time timestamptz;
begin
 if v_admin is null or not exists(select 1 from public.bts_admins a where a.user_id=v_admin)
 then raise exception 'No tenés permisos para sortear.' using errcode='42501'; end if;
 select c.id into v_company from public.bts_nfc_cards c
 where c.slug=trim(coalesce(p_company_slug,'')) and c.is_active=true;
 if v_company is null then raise exception 'Empresa no encontrada o inactiva.'; end if;
 -- Bloqueo de la campaña: dos administradores no pueden sacar el mismo ganador simultáneamente.
 select r.id into v_campaign from public.bts_business_raffle_campaigns r
 where r.company_id=v_company and r.ended_at is null for update;
 if v_campaign is null then raise exception 'Iniciá una nueva rifa antes de sortear.'; end if;
 with eligible as (
 select c.id,c.full_name,c.email,c.phone,c.created_at,
  case
   when length(regexp_replace(coalesce(c.phone,''),'[^0-9]','','g'))>=8
    then 'p:'||right(regexp_replace(c.phone,'[^0-9]','','g'),8)
   when trim(coalesce(c.email,''))<>'' then 'e:'||lower(trim(c.email))
   else 'i:'||c.id::text
  end as k
 from public.bts_business_contacts c
 where c.company_id=v_company and c.raffle_campaign_id=v_campaign
   and c.raffle_opt_in=true
 ), single_entry as(
 select distinct on(k) id,full_name,email,phone,k from eligible order by k,created_at,id
 ), available as(
 select s.* from single_entry s where not coalesce(p_exclude_previous,true)
  or not exists(select 1 from public.bts_business_raffle_draws d
    where d.campaign_id=v_campaign and d.winner_identity=s.k)
 )
 select a.id,a.k,a.full_name,a.email,a.phone,(select count(*)::int from available)
 into v_contact,v_key,v_name,v_email,v_phone,v_total
 from available a order by gen_random_uuid() limit 1;
 if v_contact is null then raise exception 'No hay nuevas inscripciones disponibles para esta rifa.'; end if;
 insert into public.bts_business_raffle_draws (
 campaign_id,company_id,company_slug,winner_contact_id,winner_identity,
 winner_name,winner_email,winner_phone,participant_count,scope,created_by)
 values(v_campaign,v_company,trim(p_company_slug),v_contact,v_key,v_name,
 coalesce(v_email,''),coalesce(v_phone,''),v_total,'raffle',v_admin)
 returning id,created_at into v_draw,v_time;
 return query select v_draw,v_contact,v_name,v_email,v_phone,v_total,v_time;
end;
$$;
revoke all on function public.bts_draw_business_raffle(text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.bts_draw_business_raffle(text,boolean,boolean) to authenticated,service_role;
