-- BTS Studio · Publicación controlada de lotes al mini panel empresarial
-- Estado: generado -> enviado. La emisión de códigos y el envío son operaciones distintas.
-- Mantener visible cualquier lote anterior: ya estaba disponible para empresas antes de esta mejora.
alter table public.bts_nfc_batches
 add column if not exists released_at timestamptz,
 add column if not exists released_by uuid;
-- Compatibilidad con el inventario existente (no despublicar tarjetas ya emitidas).
update public.bts_nfc_batches set released_at=created_at,released_by=created_by
 where released_at is null;

-- Las nuevas emisiones empiezan pendientes; el cliente solo verá los lotes enviados.
drop policy if exists bts_nfc_batch_business on public.bts_nfc_batches;
create policy bts_nfc_batch_business on public.bts_nfc_batches for select to authenticated
 using (
   released_at is not null and
   exists(select 1 from public.bts_business_users u
    where u.business_id=bts_nfc_batches.business_id and u.user_id=(select auth.uid()) and u.is_active)
 );
drop policy if exists bts_nfc_inv_business on public.bts_nfc_inventory;
create policy bts_nfc_inv_business on public.bts_nfc_inventory for select to authenticated
 using (
   exists(select 1 from public.bts_nfc_batches batch where batch.id=bts_nfc_inventory.batch_id
     and batch.released_at is not null) and
   exists(select 1 from public.bts_business_users u where u.business_id=bts_nfc_inventory.business_id
     and u.user_id=(select auth.uid()) and u.is_active)
 );
-- Sin esta política adicional el cliente podría ver nombres pendientes de tarjetas no enviadas.
drop policy if exists bts_business_member_read on public.bts_reward_members;
create policy bts_business_member_read on public.bts_reward_members for select to authenticated
 using (
   exists(select 1 from public.bts_reward_programs p
    join public.bts_business_users u on u.business_id=p.business_id
    where p.id=bts_reward_members.program_id
      and u.user_id=(select auth.uid()) and u.is_active
   ) and
   exists(select 1 from public.bts_nfc_inventory i
    join public.bts_nfc_batches batch on batch.id=i.batch_id
    where i.member_id=bts_reward_members.id and batch.released_at is not null)
 );

-- Publicación exclusiva para BTS owner/admin. No hay UPDATE directo para empresas.
create or replace function bts_private.release_nfc_batch_impl(p_batch_id uuid)
 returns table(batch_id uuid, released_at timestamptz, quantity integer)
 language plpgsql security definer set search_path='' as $release_nfc$
declare b public.bts_nfc_batches%rowtype; count_slots integer;
begin
 if (select auth.uid()) is null or not exists(
   select 1 from public.bts_admins a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')
 ) then raise exception 'Solo BTS puede enviar lotes NFC a los negocios'; end if;
 select * into b from public.bts_nfc_batches where id=p_batch_id for update;
 if not found then raise exception 'El lote no existe'; end if;
 if b.released_at is not null then raise exception 'Este lote ya fue enviado al mini panel'; end if;
 if not exists(select 1 from public.bts_nfc_cards c where c.id=b.business_id and c.is_active) then
   raise exception 'El negocio está suspendido o no existe'; end if;
 select count(*) into count_slots from public.bts_nfc_inventory i where i.batch_id=b.id;
 if count_slots<>b.quantity then raise exception 'El lote está incompleto; no se enviarán tarjetas'; end if;
 update public.bts_nfc_batches batch
 set released_at=now(),released_by=(select auth.uid()) where batch.id=b.id
 returning batch.released_at into b.released_at;
 return query select b.id,b.released_at,b.quantity;
end $release_nfc$;
revoke all on function bts_private.release_nfc_batch_impl(uuid) from public,anon,authenticated;
grant execute on function bts_private.release_nfc_batch_impl(uuid) to authenticated;
create or replace function public.bts_admin_release_nfc_batch(p_batch_id uuid)
 returns table(batch_id uuid, released_at timestamptz, quantity integer)
 language sql security invoker set search_path='' as $release_bridge$
 select * from bts_private.release_nfc_batch_impl(p_batch_id)
$release_bridge$;
revoke all on function public.bts_admin_release_nfc_batch(uuid) from public,anon,authenticated;
grant execute on function public.bts_admin_release_nfc_batch(uuid) to authenticated;

-- Mantener la validación en el servidor incluso si intentan invocar una RPC directamente.
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
 if not exists(select 1 from public.bts_nfc_batches batch
   where batch.id=inv.batch_id and batch.released_at is not null) then
   raise exception 'BTS todavía no envió este lote al mini panel de la empresa';
 end if;
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
CREATE OR REPLACE FUNCTION bts_private.reject_unassigned_nfc_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if exists(select 1 from public.bts_nfc_inventory i
   join public.bts_nfc_batches batch on batch.id=i.batch_id
   where i.member_id=new.member_id and (i.status<>'assigned' or batch.released_at is null)) then
  raise exception 'La tarjeta NFC aún no está asignada o ha sido suspendida por BTS';
 end if;
 return new;
end $function$
;
