-- BTS Studio / preparación de tarjetas físicas — propuesta para revisión previa a QA
-- Guardada en rama de trabajo. NO se aplica todavía a la base de datos publicada.
alter table public.bts_nfc_inventory add column if not exists production_stage text not null default 'generated';
alter table public.bts_nfc_inventory drop constraint if exists bts_nfc_inventory_production_stage_check;
alter table public.bts_nfc_inventory add constraint bts_nfc_inventory_production_stage_check
 check(production_stage in ('generated','encoded','verified','delivered'));

create table if not exists public.bts_nfc_production_events (
  id bigint generated always as identity primary key,
  slot_id uuid not null references public.bts_nfc_inventory(id) on delete restrict,
  old_stage text not null,
  new_stage text not null,
  note text not null default '' check (char_length(note)<=200),
  changed_by uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists bts_nfc_production_events_slot_created
 on public.bts_nfc_production_events(slot_id,created_at desc);
alter table public.bts_nfc_production_events enable row level security;
create policy bts_nfc_production_events_admin on public.bts_nfc_production_events for select to authenticated
 using (exists(select 1 from public.bts_admins a
   where a.user_id=(select auth.uid()) and a.role in ('owner','admin')));
revoke all on public.bts_nfc_production_events from anon,authenticated;
grant select on public.bts_nfc_production_events to authenticated;

create or replace function bts_private.mark_nfc_production_impl(
 p_slot_id uuid,p_next_stage text,p_note text default ''
) returns table(slot_id uuid,stage text,reference text)
language plpgsql security definer set search_path='' as $production$
declare inv public.bts_nfc_inventory%rowtype;
begin
 if (select auth.uid()) is null or not exists(
  select 1 from public.bts_admins a
  where a.user_id=(select auth.uid()) and a.role in ('owner','admin')
 ) then raise exception 'Solo BTS puede registrar la preparación de tarjetas'; end if;
 if char_length(trim(coalesce(p_note,'')))>200 then raise exception 'Nota demasiado extensa'; end if;
 select * into inv from public.bts_nfc_inventory where id=p_slot_id for update;
 if not found then raise exception 'Tarjeta inexistente'; end if;
 if inv.status<>'available' then raise exception 'No se puede modificar la producción de una tarjeta asignada o suspendida'; end if;
 if not (
   (inv.production_stage='generated' and p_next_stage='encoded') or
   (inv.production_stage='encoded' and p_next_stage='verified') or
   (inv.production_stage='verified' and p_next_stage='delivered') or
   (inv.production_stage='verified' and p_next_stage='encoded' and char_length(trim(coalesce(p_note,'')))>=5)
 ) then raise exception 'Transición no permitida para esta tarjeta'; end if;
 update public.bts_nfc_inventory set production_stage=p_next_stage,updated_at=now() where id=inv.id;
 insert into public.bts_nfc_production_events(slot_id,old_stage,new_stage,note,changed_by)
 values(inv.id,inv.production_stage,p_next_stage,trim(coalesce(p_note,'')),(select auth.uid()));
 return query select inv.id,p_next_stage,inv.reference;
end $production$;
revoke all on function bts_private.mark_nfc_production_impl(uuid,text,text)
 from public,anon,authenticated;
grant execute on function bts_private.mark_nfc_production_impl(uuid,text,text) to authenticated;

create or replace function public.bts_admin_mark_nfc_production(
 p_slot_id uuid,p_next_stage text,p_note text default ''
) returns table(slot_id uuid,stage text,reference text)
language sql security invoker set search_path='' as $production_api$
 select * from bts_private.mark_nfc_production_impl(p_slot_id,p_next_stage,p_note)
$production_api$;
revoke all on function public.bts_admin_mark_nfc_production(uuid,text,text)
 from public,anon,authenticated;
grant execute on function public.bts_admin_mark_nfc_production(uuid,text,text) to authenticated;

-- Regla central: la empresa solo asigna tarjetas entregadas por BTS.
CREATE OR REPLACE FUNCTION bts_private.assign_nfc_inventory_impl(p_slot_id uuid, p_full_name text, p_benefit_label text)
 RETURNS TABLE(slot_id uuid, card_reference text, card_holder text, card_benefit text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare inv public.bts_nfc_inventory%rowtype;
begin
 if (select auth.uid()) is null then raise exception 'Iniciá sesión'; end if;
 if char_length(trim(coalesce(p_full_name,''))) not between 2 and 100 then
  raise exception 'Nombre del cliente inválido'; end if;
 if char_length(trim(coalesce(p_benefit_label,''))) not between 2 and 160 then
  raise exception 'Ingresá el beneficio de 2 a 160 caracteres'; end if;
 select * into inv from public.bts_nfc_inventory where id=p_slot_id for update;
 if not found then raise exception 'Tarjeta no encontrada'; end if;
 if inv.status <> 'available' then raise exception 'La tarjeta ya fue asignada o suspendida por BTS'; end if;
 if inv.production_stage <> 'delivered' then raise exception 'BTS todavía no entregó ni habilitó esta tarjeta'; end if;
 if not exists(select 1 from public.bts_business_users u
   where u.business_id=inv.business_id and u.user_id=(select auth.uid()) and u.is_active
    and u.role in ('owner','manager')) then
  raise exception 'No tenés permiso para asignar tarjetas de esta empresa'; end if;
 if not exists(select 1 from public.bts_nfc_cards b where b.id=inv.business_id and b.is_active) then
  raise exception 'Empresa suspendida'; end if;
 update public.bts_reward_members m
   set full_name=trim(p_full_name)
   where m.id=inv.member_id;
 update public.bts_nfc_inventory
  set status='assigned',benefit_label=trim(p_benefit_label),assigned_at=now(),assigned_by=(select auth.uid()),updated_at=now()
  where id=inv.id;
 slot_id:=inv.id;card_reference:=inv.reference;card_holder:=trim(p_full_name);card_benefit:=trim(p_benefit_label);
 return next;
end $function$
;
