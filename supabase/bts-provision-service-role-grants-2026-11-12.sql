-- BTS Studio: corregir permisos de la Edge Function de creación de mini paneles.
-- Root cause: role service_role carecía de SELECT sobre public.bts_admins,
-- aunque /auth/v1/user validaba correctamente el JWT del administrador.
-- El service_role solo se utiliza del lado servidor; nunca se entrega al navegador.
grant select on public.bts_admins to service_role;
grant select,insert,delete on public.bts_nfc_cards to service_role;
grant select,insert on public.bts_business_users to service_role;
grant select,insert on public.bts_reward_programs to service_role;
-- Nota: las políticas RLS para usuarios empresariales no se modifican.
