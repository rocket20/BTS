-- BTS Studio · Habilitar lista de usuarios para owner/admin sin exponerla al público.
-- Ejecutar UNA VEZ desde Supabase > SQL Editor como propietario del proyecto.
-- La función SECURITY DEFINER evita recursividad entre políticas RLS.
CREATE OR REPLACE FUNCTION public.bts_can_list_admins()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bts_admins AS a
    WHERE a.user_id = (SELECT auth.uid())
      AND a.role IN ('owner', 'admin')
  );
$$;
REVOKE ALL ON FUNCTION public.bts_can_list_admins() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bts_can_list_admins() TO authenticated;

ALTER TABLE public.bts_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bts_admins_team_read ON public.bts_admins;
CREATE POLICY bts_admins_team_read
ON public.bts_admins
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT public.bts_can_list_admins())
);

-- La política existente de lectura individual puede permanecer; las políticas
-- SELECT permisivas se combinan con OR.
-- No modifica permisos de INSERT, UPDATE o DELETE.
-- Verificá que exista GRANT SELECT a authenticated como en tu configuración actual.
