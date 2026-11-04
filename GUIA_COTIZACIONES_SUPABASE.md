# BTS Studio — Integración de cotizaciones (rama de prueba)

Esta rama conserva la web y el dashboard existentes. Todavía no funciona hasta configurar Supabase.

## Nuevos archivos
- `supabase/01_cotizaciones.sql`: tabla, estados, RLS y administradores.
- `assets/js/bts-supabase-config.js`: URL, clave publicable y WhatsApp comercial.
- `assets/js/bts-cotizaciones-web.js`: envío de cotizaciones desde el formulario.
- `assets/js/bts-cotizaciones-admin.js`: cotizaciones online dentro del dashboard existente.

## Archivos modificados
- `index.html`: carga scripts y conserva el generador de PDF.
- `admin/index.html`: muestra la tabla online en la misma página Cotizaciones; se conserva la tabla local previa.

## Activación
1. Abrir Supabase → SQL Editor y ejecutar `supabase/01_cotizaciones.sql`.
2. Crear un usuario administrador en Authentication → Users.
3. Copiar su User ID (UUID) y ejecutar en SQL Editor:
   `insert into public.bts_admins(user_id) values ('TU-USER-UUID') on conflict do nothing;`
4. En Project Settings → API Keys, obtener Project URL y la clave publishable `sb_publishable_...`.
5. Modificar `assets/js/bts-supabase-config.js` con URL y clave publicable. También indicar número WhatsApp comercial (505XXXXXXXX).
6. Probar desde un sitio HTTPS de staging antes de fusionar la rama: envío desde la web, acceso al dashboard, estados y comprobación RLS.
7. No fusionar a main ni recibir datos reales hasta probar permisos, configurar protección antispam y HTTPS.

## Funcionamiento
- Enviar cotización → guarda en `bts_quotes` y muestra confirmación si Supabase respondió sin error.
- Preparar WhatsApp → primero guarda y luego abre la conversación con mensaje precargado; el envío final depende del cliente.
- Generar brief en PDF → conserva su función independiente y no envía la solicitud.
- Dashboard Cotizaciones → bloque online con autenticación Supabase y tabla antigua local conservada.

## Seguridad y pendientes
- Nunca subir `service_role`, secret keys, contraseñas ni tokens GitHub a archivos públicos.
- La ruta HTML `/admin/` no está protegida por una contraseña; Supabase Auth + RLS protegen los datos online.
- La inserción pública necesita Turnstile con validación de servidor/Edge Function y rate limiting antes de producción.
- Los KPI de visitas siguen siendo ilustrativos hasta conectar mediciones reales de Google Analytics.
- No se integraron pagos ni importación de leads locales a Supabase.
- No se han ejecutado pruebas reales en tu proyecto Supabase porque aún falta configurar su URL y credenciales públicas.
