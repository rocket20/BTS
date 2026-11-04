-- BTS Studio | Ejecutar en Supabase SQL Editor.
create extension if not exists pgcrypto;
create table if not exists public.bts_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.bts_admins enable row level security;
revoke all on public.bts_admins from anon, authenticated;
grant select on public.bts_admins to authenticated;
drop policy if exists bts_admin_self on public.bts_admins;
create policy bts_admin_self on public.bts_admins for select to authenticated
using (user_id = (select auth.uid()));

create table if not exists public.bts_quotes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nombre text not null check (length(nombre) between 2 and 100),
  empresa text not null default '' check (length(empresa) <= 150),
  email text not null check (length(email) between 5 and 150),
  telefono text not null default '' check (length(telefono) <= 40),
  evento text not null check (length(evento) between 1 and 120),
  fecha_evento date,
  paquete text not null default '' check (length(paquete) <= 100),
  detalles jsonb not null default '{}'::jsonb check (octet_length(detalles::text) <= 16000),
  origen text not null default 'web' check (origen in ('web','web_whatsapp')),
  estado text not null default 'nueva'
    check (estado in ('nueva','en_revision','contactada','propuesta_enviada','aceptada','cerrada')),
  notas_internas text not null default '' check (length(notas_internas) <= 3000)
);
create index if not exists bts_quotes_created_idx on public.bts_quotes(created_at desc);
alter table public.bts_quotes enable row level security;
revoke all on public.bts_quotes from anon,authenticated;
grant insert (nombre,empresa,email,telefono,evento,fecha_evento,paquete,detalles,origen)
 on public.bts_quotes to anon;
grant select on public.bts_quotes to authenticated;
grant update (estado,notas_internas) on public.bts_quotes to authenticated;
drop policy if exists bts_quotes_public_insert on public.bts_quotes;
create policy bts_quotes_public_insert on public.bts_quotes for insert to anon with check (true);
drop policy if exists bts_quotes_admin_select on public.bts_quotes;
create policy bts_quotes_admin_select on public.bts_quotes for select to authenticated
using (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())));
drop policy if exists bts_quotes_admin_update on public.bts_quotes;
create policy bts_quotes_admin_update on public.bts_quotes for update to authenticated
using (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())))
with check (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())));

-- Una vez creado TU usuario en Authentication > Users, sustituir el UUID:
-- insert into public.bts_admins(user_id) values ('TU-USER-ID-UUID') on conflict do nothing;
-- IMPORTANTE: antes de producción, implementar Turnstile + Edge Function y rate limiting.
