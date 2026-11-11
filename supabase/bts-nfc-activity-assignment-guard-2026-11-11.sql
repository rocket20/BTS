-- Solo tarjetas asignadas pueden registrar movimientos, compras y accesos VIP.
-- La verificación se hace en la base de datos: no depende de botones ocultos.
create or replace function bts_private.reject_unassigned_nfc_activity()
returns trigger language plpgsql security definer set search_path='' as $reject_pending$
begin
 if exists(select 1 from public.bts_nfc_inventory i
   where i.member_id=new.member_id and i.status<>'assigned') then
  raise exception 'La tarjeta NFC aún no está asignada o ha sido suspendida por BTS';
 end if;
 return new;
end $reject_pending$;
revoke all on function bts_private.reject_unassigned_nfc_activity() from public,anon,authenticated;
create trigger bts_nfc_require_assignment_for_movements before insert on public.bts_reward_movements
 for each row execute function bts_private.reject_unassigned_nfc_activity();
create trigger bts_nfc_require_assignment_for_checkins before insert on public.bts_vip_checkins
 for each row execute function bts_private.reject_unassigned_nfc_activity();
