-- BTS Studio — endurecimiento seguro de la consulta de roles administrativos.
-- No cambia las políticas de bts_admins ni revoca permisos de las tarjetas NFC.
-- La función que omite RLS se ejecuta únicamente en el esquema privado.
create or replace function bts_private.can_list_admins_impl()
returns boolean
language sql
stable
security definer
set search_path = ''
as $roles$
  select exists (
    select 1 from public.bts_admins
    where user_id = (select auth.uid())
      and role in ('owner','admin')
  );
$roles$;

revoke all on function bts_private.can_list_admins_impl() from public, anon, authenticated;
grant execute on function bts_private.can_list_admins_impl() to authenticated;

-- La RPC pública mantiene el nombre, la firma y la respuesta boolean originales.
-- Se ejecuta con permisos del usuario y consulta al componente privado, evitando
-- la recursión RLS de bts_admins_team_read.
create or replace function public.bts_can_list_admins()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $public_wrapper$
  select bts_private.can_list_admins_impl();
$public_wrapper$;

-- Revocar explícitamente a visitantes anónimos sin quitar el acceso autenticado.
revoke execute on function public.bts_can_list_admins() from public,anon;
grant execute on function public.bts_can_list_admins() to authenticated;
