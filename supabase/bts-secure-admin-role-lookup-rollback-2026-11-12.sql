-- Rollback preciso del cambio de seguridad BTS #46.
-- Restaura el cuerpo anterior de bts_can_list_admins() y sus permisos.
create or replace function public.bts_can_list_admins()
returns boolean
language sql
stable security definer
set search_path to ''
as $previous$
 select exists (
   select 1 from public.bts_admins
   where user_id = auth.uid() and role in ('owner','admin')
 );
$previous$;
revoke execute on function public.bts_can_list_admins() from public,anon;
grant execute on function public.bts_can_list_admins() to authenticated;
drop function if exists bts_private.can_list_admins_impl();
