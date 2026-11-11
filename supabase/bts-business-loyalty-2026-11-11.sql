-- BTS Studio · Fidelización con permisos por empresa · 2026-11-11.
-- Las tarjetas, los códigos NFC y los contadores anteriores se conservan.
create or replace function bts_private.business_loyalty_event_impl(
 p_member_id uuid,p_action text,p_receipt_ref text default ''
) returns table(new_balance integer,total_redemptions integer,lifetime_total integer)
language plpgsql security definer set search_path='' as $business_loyalty$
declare
 m public.bts_reward_members%rowtype;
 p public.bts_reward_programs%rowtype;
 units integer;
 balance_value integer;
 redeem_value integer;
 lifetime_value integer;
 receipt text;
begin
 if (select auth.uid()) is null then raise exception 'Iniciá sesión'; end if;
 if p_action not in ('earn','redeem') then raise exception 'Operación desconocida'; end if;
 select * into m from public.bts_reward_members where id=p_member_id for update;
 if not found then raise exception 'Tarjeta inexistente'; end if;
 select * into p from public.bts_reward_programs where id=m.program_id;
 if p.kind<>'loyalty' or not p.is_active or not m.is_active then
  raise exception 'Programa o tarjeta no disponible';
 end if;
 if not exists(select 1 from public.bts_nfc_cards b where b.id=p.business_id and b.is_active) then
  raise exception 'Negocio suspendido';
 end if;
 if not exists(select 1 from public.bts_business_users u
    where u.user_id=(select auth.uid()) and u.business_id=p.business_id and u.is_active
      and u.role in ('owner','manager','staff')) then
  raise exception 'No estás autorizado para operar este programa de fidelización';
 end if;
 balance_value:=m.current_units;
 redeem_value:=m.redeemed_count;
 lifetime_value:=m.lifetime_units;
 if p_action='earn' then
   receipt:=upper(trim(coalesce(p_receipt_ref,'')));
   if char_length(receipt) not between 3 and 80 then
     raise exception 'Ingresá un número de factura o referencia de compra de 3 a 80 caracteres';
   end if;
   units:=case when p.unit_name='puntos' then p.units_per_visit else 1 end;
   if units not between 1 and 1000 or balance_value+units>1000000 or lifetime_value+units>100000000 then
     raise exception 'Cantidad de puntos inválida o fuera de rango';
   end if;
   if exists(select 1 from public.bts_reward_purchase_refs r
     where r.member_id=m.id and r.receipt_ref=receipt) then
     raise exception 'Esta compra ya se acreditó a este cliente';
   end if;
   insert into public.bts_reward_purchase_refs(member_id,program_id,receipt_ref,units,actor_id)
     values(m.id,p.id,receipt,units,(select auth.uid()));
   balance_value:=balance_value+units;
   lifetime_value:=lifetime_value+units;
 else
   if balance_value<p.goal_units then raise exception 'La tarjeta aún no alcanza el premio'; end if;
   units:=-balance_value;
   balance_value:=0;
   redeem_value:=redeem_value+1;
 end if;
 update public.bts_reward_members set
   current_units=balance_value,redeemed_count=redeem_value,lifetime_units=lifetime_value
   where id=m.id;
 insert into public.bts_reward_movements(member_id,program_id,action,delta,balance_after,actor_id)
   values(m.id,p.id,p_action,units,balance_value,(select auth.uid()));
 return query select balance_value,redeem_value,lifetime_value;
end $business_loyalty$;
revoke all on function bts_private.business_loyalty_event_impl(uuid,text,text) from public,anon,authenticated;
grant execute on function bts_private.business_loyalty_event_impl(uuid,text,text) to authenticated;

create or replace function public.bts_business_loyalty_event(
 p_member_id uuid,p_action text,p_receipt_ref text default ''
) returns table(new_balance integer,total_redemptions integer,lifetime_total integer)
language sql security invoker set search_path='' as $loyalty_bridge$
 select * from bts_private.business_loyalty_event_impl(p_member_id,p_action,p_receipt_ref)
$loyalty_bridge$;
revoke all on function public.bts_business_loyalty_event(uuid,text,text) from public,anon,authenticated;
grant execute on function public.bts_business_loyalty_event(uuid,text,text) to authenticated;