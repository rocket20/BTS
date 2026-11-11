-- BTS Studio | Portal privado multiempresa | 2026-11-11
-- Aditivo: no cambia códigos NFC, datos actuales ni privilegios de administradores BTS.

create table if not exists public.bts_business_users (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.bts_nfc_cards(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'viewer' check(role in ('owner','manager','staff','viewer')),
 is_active boolean not null default true,
 display_email text not null default '' check(char_length(display_email)<=150),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (business_id,user_id)
);
create index if not exists bts_business_users_user_idx on public.bts_business_users(user_id,business_id) where is_active;
alter table public.bts_business_users enable row level security;

-- Los empleados solo ven sus asignaciones. Solo BTS puede crear o modificar permisos.
create policy bts_business_users_self on public.bts_business_users for select to authenticated
 using (user_id=(select auth.uid()));
create policy bts_business_users_admin on public.bts_business_users for all to authenticated
 using (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())))
 with check (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())));
revoke all on public.bts_business_users from anon,authenticated;
grant select,insert,update,delete on public.bts_business_users to authenticated;

-- Lectura exclusivamente de programas y miembros pertenecientes a la empresa asignada.
create policy bts_business_program_read on public.bts_reward_programs for select to authenticated
 using (exists(select 1 from public.bts_business_users u where u.user_id=(select auth.uid())
   and u.business_id=bts_reward_programs.business_id and u.is_active));
create policy bts_business_member_read on public.bts_reward_members for select to authenticated
 using (exists(select 1 from public.bts_reward_programs p
    join public.bts_business_users u on u.business_id=p.business_id
    where p.id=bts_reward_members.program_id and u.user_id=(select auth.uid()) and u.is_active));
create policy bts_business_movement_read on public.bts_reward_movements for select to authenticated
 using (exists(select 1 from public.bts_reward_programs p
    join public.bts_business_users u on u.business_id=p.business_id
    where p.id=bts_reward_movements.program_id and u.user_id=(select auth.uid()) and u.is_active));
create policy bts_business_checkin_read on public.bts_vip_checkins for select to authenticated
 using (exists(select 1 from public.bts_business_users u
    join public.bts_reward_programs p on p.business_id=u.business_id
    where p.id=bts_vip_checkins.program_id and u.user_id=(select auth.uid()) and u.is_active));

-- Ingresos VIP: staff autorizado, siempre por su negocio, y la función verifica vigencia.
create policy bts_business_checkin_insert on public.bts_vip_checkins for insert to authenticated
 with check (checked_by=(select auth.uid()) and exists(
    select 1 from public.bts_business_users u
    join public.bts_reward_programs p on p.business_id=u.business_id
    where p.id=bts_vip_checkins.program_id and u.user_id=(select auth.uid())
      and u.is_active and u.role in ('owner','manager','staff')
 ));
-- Lo anterior no concede actualización de tarjetas ni saldo al personal del negocio.

create schema if not exists bts_private;
revoke all on schema bts_private from public,anon;
grant usage on schema bts_private to authenticated;

create or replace function bts_private.business_vip_checkin_impl(
  p_program_id uuid, p_card_code text
) returns table(member_name text,tier text,expires_on date,checked_at timestamptz)
language plpgsql security definer set search_path='' as $
declare v_member public.bts_reward_members%rowtype;
        v_program public.bts_reward_programs%rowtype;
        v_id bigint;
        v_code text;
begin
  if (select auth.uid()) is null then raise exception 'Iniciá sesión'; end if;
  v_code := lower(trim(coalesce(p_card_code,'')));
  if v_code !~ '^[a-f0-9]{20}$' then raise exception 'Código NFC inválido'; end if;
  select * into v_program from public.bts_reward_programs where id=p_program_id;
  if not found or v_program.kind<>'vip' or not v_program.is_active then
     raise exception 'Programa VIP no disponible';
  end if;
  if not exists(
     select 1 from public.bts_business_users u
     where u.business_id=v_program.business_id and u.user_id=(select auth.uid())
       and u.is_active and u.role in ('owner','manager','staff')
  ) then raise exception 'No estás autorizado para validar entradas de este negocio'; end if;
  if not exists(select 1 from public.bts_nfc_cards c
    where c.id=v_program.business_id and c.is_active) then
     raise exception 'El negocio no está activo';
  end if;
  select * into v_member from public.bts_reward_members
    where program_id=p_program_id and card_code=v_code for update;
  if not found then raise exception 'La tarjeta no pertenece a este negocio'; end if;
  if not v_member.is_active then raise exception 'Tarjeta suspendida'; end if;
  if v_member.expires_at is null or v_member.expires_at<current_date then
    raise exception 'Membresía vencida o sin vigencia';
  end if;
  if exists(select 1 from public.bts_vip_checkins c
   where c.member_id=v_member.id and c.created_at>now()-interval '60 seconds') then
     raise exception 'Ya se registró un ingreso en el último minuto';
  end if;
  insert into public.bts_vip_checkins(member_id,program_id,checked_by,note)
    values(v_member.id,p_program_id,(select auth.uid()),'Portal empresarial')
    returning id into v_id;
  return query select v_member.full_name,v_member.vip_tier,v_member.expires_at,c.created_at
    from public.bts_vip_checkins c where c.id=v_id;
end $$;
revoke all on function bts_private.business_vip_checkin_impl(uuid,text) from public,anon,authenticated;
grant execute on function bts_private.business_vip_checkin_impl(uuid,text) to authenticated;
create or replace function public.bts_business_vip_checkin(p_program_id uuid,p_card_code text)
returns table(member_name text,tier text,expires_on date,checked_at timestamptz)
language sql security invoker set search_path='' as $
 select * from bts_private.business_vip_checkin_impl(p_program_id,p_card_code)
$;
revoke all on function public.bts_business_vip_checkin(uuid,text) from public,anon,authenticated;
grant execute on function public.bts_business_vip_checkin(uuid,text) to authenticated;

-- Promociones particulares: no se permite publicar en el negocio de otro usuario.
create table if not exists public.bts_business_promotions (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.bts_nfc_cards(id) on delete cascade,
 title text not null check(char_length(trim(title)) between 2 and 110),
 description text not null default '' check(char_length(description)<=500),
 starts_on date,
 ends_on date,
 is_active boolean not null default true,
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint bts_promo_date_range check(ends_on is null or starts_on is null or ends_on>=starts_on)
);
create index if not exists bts_business_promos_by_business on public.bts_business_promotions(business_id,created_at desc);
alter table public.bts_business_promotions enable row level security;
create policy bts_promos_business_read on public.bts_business_promotions for select to authenticated
 using (exists(select 1 from public.bts_business_users u where u.business_id=bts_business_promotions.business_id
    and u.user_id=(select auth.uid()) and u.is_active));
create policy bts_promos_business_insert on public.bts_business_promotions for insert to authenticated
 with check(created_by=(select auth.uid()) and exists(select 1 from public.bts_business_users u
    where u.business_id=bts_business_promotions.business_id and u.user_id=(select auth.uid())
    and u.is_active and u.role in ('owner','manager')));
create policy bts_promos_business_update on public.bts_business_promotions for update to authenticated
 using (exists(select 1 from public.bts_business_users u where u.business_id=bts_business_promotions.business_id
    and u.user_id=(select auth.uid()) and u.is_active and u.role in ('owner','manager')))
 with check (exists(select 1 from public.bts_business_users u where u.business_id=bts_business_promotions.business_id
    and u.user_id=(select auth.uid()) and u.is_active and u.role in ('owner','manager')));
create policy bts_promos_admin on public.bts_business_promotions for all to authenticated
 using (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())))
 with check (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())));
revoke all on public.bts_business_promotions from anon,authenticated;
grant select,insert,update on public.bts_business_promotions to authenticated;

-- Los negocios pueden abrir solicitudes de soporte; BTS responde y cambia su estado.
create table if not exists public.bts_business_support (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.bts_nfc_cards(id) on delete cascade,
 created_by uuid not null,
 subject text not null check(char_length(trim(subject)) between 2 and 140),
 details text not null check(char_length(trim(details)) between 5 and 2000),
 priority text not null default 'normal' check(priority in ('normal','alta')),
 status text not null default 'abierto' check(status in ('abierto','en_proceso','resuelto','cerrado')),
 bts_reply text not null default '' check(char_length(bts_reply)<=2000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists bts_business_support_business on public.bts_business_support(business_id,created_at desc);
alter table public.bts_business_support enable row level security;
create policy bts_support_business_read on public.bts_business_support for select to authenticated
 using (exists(select 1 from public.bts_business_users u where u.business_id=bts_business_support.business_id
    and u.user_id=(select auth.uid()) and u.is_active));
create policy bts_support_business_insert on public.bts_business_support for insert to authenticated
 with check (created_by=(select auth.uid()) and status='abierto' and bts_reply=''
   and exists(select 1 from public.bts_business_users u where u.business_id=bts_business_support.business_id
    and u.user_id=(select auth.uid()) and u.is_active));
create policy bts_support_admin on public.bts_business_support for all to authenticated
 using (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())))
 with check (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())));
revoke all on public.bts_business_support from anon,authenticated;
grant select,insert,update,delete on public.bts_business_support to authenticated;
-- Aunque hay UPDATE a nivel de tabla, solo BTS supera la política UPDATE de soporte.

-- Consultas del portal por proyecto quedan sujetas a RLS; ningún usuario externo
-- obtiene permisos sobre finanzas BTS, otras empresas o tablas de administradores.
