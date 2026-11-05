-- BTS Studio | Directorio de tarjetas NFC
-- Ejecutar una sola vez en Supabase SQL Editor, proyecto BTS Studio.
-- No requiere una service_role key en GitHub ni en el navegador.
create extension if not exists pgcrypto;

create table if not exists public.bts_nfc_cards (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (length(slug) between 3 and 48
      and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      and slug not in ('admin','assets','nfc','api','dashboard','inicio','index','contacto','servicios','paquetes','proyectos','robots','sitemap','favicon','404','login','auth','panel','bts')),
  business_name text not null check (char_length(business_name) between 2 and 90),
  tagline text not null default '' check (char_length(tagline) <= 180),
  avatar_url text not null default '' check (char_length(avatar_url) <= 1000),
  accent_color text not null default '#ff0037'
    check (accent_color ~ '^#[A-Fa-f0-9]{6}$'),
  links jsonb not null default '[]'::jsonb
    check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 15),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bts_nfc_cards_active_slug_idx
 on public.bts_nfc_cards(slug) where is_active;

create or replace function public.bts_nfc_cards_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists bts_nfc_touch on public.bts_nfc_cards;
create trigger bts_nfc_touch
 before update on public.bts_nfc_cards
 for each row execute procedure public.bts_nfc_cards_touch();

alter table public.bts_nfc_cards enable row level security;
-- Public access: only cards that are published and active.
drop policy if exists "bts_nfc_public_select" on public.bts_nfc_cards;
create policy "bts_nfc_public_select"
on public.bts_nfc_cards for select to anon, authenticated
using (is_active);

-- Administration: only users already included in BTS Studio's admin table.
drop policy if exists "bts_nfc_admin_manage" on public.bts_nfc_cards;
create policy "bts_nfc_admin_manage"
on public.bts_nfc_cards for all to authenticated
using (exists (
 select 1 from public.bts_admins a where a.user_id = (select auth.uid())
))
with check (exists (
 select 1 from public.bts_admins a where a.user_id = (select auth.uid())
));

grant select on public.bts_nfc_cards to anon, authenticated;
grant insert, update, delete on public.bts_nfc_cards to authenticated;

-- Prueba posterior: SELECT * FROM public.bts_nfc_cards LIMIT 5;
