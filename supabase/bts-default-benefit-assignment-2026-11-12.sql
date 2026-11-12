-- BTS · Asignación directa: el negocio selecciona la tarjeta y el cliente; el programa determina el beneficio.
CREATE OR REPLACE FUNCTION bts_private.assign_nfc_inventory_impl(p_slot_id uuid, p_full_name text, p_benefit_label text)
 RETURNS TABLE(slot_id uuid, card_reference text, card_holder text, card_benefit text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare inv public.bts_nfc_inventory%rowtype;
 prog public.bts_reward_programs%rowtype;
 resolved text;
begin
 if (select auth.uid()) is null then raise exception 'Iniciá sesión'; end if;
 if char_length(trim(coalesce(p_full_name,''))) not between 2 and 100 then
  raise exception 'Nombre del cliente inválido'; end if;
 select * into inv from public.bts_nfc_inventory where id=p_slot_id for update;
 if not found then raise exception 'Tarjeta no encontrada'; end if;
 select * into prog from public.bts_reward_programs where id=inv.program_id and is_active;
 if not found then raise exception 'El programa de tarjetas no está activo'; end if;
 -- Cuando el cliente no escribe un beneficio, usar siempre la configuración de BTS.
 -- Para VIP se conserva un campo vacío para que la tarjeta digital muestre todos los beneficios
 -- configurados del programa, incluso cuando superan 160 caracteres.
 resolved:=case when btrim(coalesce(p_benefit_label,''))='' and prog.kind='vip'
   then ''
   when btrim(coalesce(p_benefit_label,''))='' then prog.reward_label
   else btrim(p_benefit_label) end;
 if char_length(resolved)>160 or (resolved<>'' and char_length(resolved)<2) then
   raise exception 'Beneficio inválido: máximo 160 caracteres'; end if;
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
   set full_name=trim(p_full_name),
       expires_at=case when p.kind='vip' then
          (current_date+make_interval(months=>p.vip_validity_months))::date
        else m.expires_at end
   from public.bts_reward_programs p
   where m.id=inv.member_id and p.id=inv.program_id;
 update public.bts_nfc_inventory
  set status='assigned',benefit_label=resolved,assigned_at=now(),assigned_by=(select auth.uid()),updated_at=now()
  where id=inv.id;
 slot_id:=inv.id;card_reference:=inv.reference;card_holder:=trim(p_full_name);card_benefit:=coalesce(nullif(resolved,''),prog.vip_benefits);
 return next;
end $function$
;
