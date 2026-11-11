-- BTS ERP: hardening aditivo y permisos de compra verificada
-- Preservamos funciones y registros existentes; no se borran tarjetas.
create policy bts_purchase_refs_admin_insert on public.bts_reward_purchase_refs
for insert to authenticated
with check (
 actor_id=(select auth.uid()) AND
 exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid()))
);
grant insert on public.bts_reward_purchase_refs to authenticated;

-- El administrador ya está autorizado vía RLS: no hace falta escalar privilegios.
alter function public.bts_reward_record_purchase(uuid,text,integer) security invoker;

-- Evitamos vincular un servicio de un cliente con una transacción o tarjeta de otro.
create or replace function bts_private.erp_check_client_service()
returns trigger language plpgsql set search_path='' as $$
declare service_client uuid;
begin
 if new.service_id is not null then
   select s.client_id into service_client from public.bts_erp_services s where s.id=new.service_id;
   if service_client is null then raise exception 'Servicio inexistente'; end if;
   if new.client_id is distinct from service_client then
      raise exception 'El servicio no pertenece al cliente seleccionado';
   end if;
 end if;
 return new;
end $$;
revoke all on function bts_private.erp_check_client_service() from public,anon,authenticated;

create trigger bts_erp_transactions_client_check before insert or update on public.bts_erp_transactions
 for each row execute function bts_private.erp_check_client_service();
create trigger bts_erp_cards_client_check before insert or update on public.bts_erp_cards
 for each row execute function bts_private.erp_check_client_service();
create trigger bts_erp_tickets_client_check before insert or update on public.bts_erp_tickets
 for each row execute function bts_private.erp_check_client_service();
