# Módulo Usuarios y actividad (rama de desarrollo)

Este módulo agrega únicamente al dashboard `/admin/` las pantallas de usuarios, roles e historial.

**No está listo para producción.** Antes de fusionarlo:
- Añadir en Supabase una columna `role` a `public.bts_admins` y asignar manualmente el propietario.
- Crear `public.bts_audit_logs` con RLS y disparadores para `bts_leads` y `bts_admins`.
- Implementar una RPC `bts_set_user_role(target_user_id, new_role)` con comprobación de propietario.
- Verificar permisos RLS de lectura de administradores y permisos de escritura de cada rol.
- Adaptar la función Edge `publicar-bts` para registrar publicaciones y exigir roles autorizados.
- No almacenar secretos ni datos sensibles en el registro de cambios.
- Probar inicios de sesión y roles en ambiente de prueba antes de fusionar a `main`.

Las pantallas actuales muestran un error claro hasta que la configuración de Supabase exista.
