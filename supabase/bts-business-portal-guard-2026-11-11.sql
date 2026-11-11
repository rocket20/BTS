-- Protecciones del portal empresarial: identidad de autor y negocio inmutables.
create or replace function bts_private.business_promotion_guard()
returns trigger language plpgsql set search_path='' as $portal_guard$
begin
 if new.business_id is distinct from old.business_id or new.created_by is distinct from old.created_by then
   raise exception 'No se puede cambiar el negocio ni el creador de una promoción';
 end if;
 new.updated_at=now();
 return new;
end $portal_guard$;
revoke all on function bts_private.business_promotion_guard() from public,anon,authenticated;
create trigger bts_business_promotions_guard before update on public.bts_business_promotions
for each row execute function bts_private.business_promotion_guard();

create or replace function bts_private.business_support_guard()
returns trigger language plpgsql set search_path='' as $support_guard$
begin
 if new.business_id is distinct from old.business_id or new.created_by is distinct from old.created_by then
   raise exception 'No se puede cambiar el negocio ni el autor de la solicitud';
 end if;
 new.updated_at=now();
 return new;
end $support_guard$;
revoke all on function bts_private.business_support_guard() from public,anon,authenticated;
create trigger bts_business_support_guard before update on public.bts_business_support
for each row execute function bts_private.business_support_guard();
