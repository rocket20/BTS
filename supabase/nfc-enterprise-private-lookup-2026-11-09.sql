
-- Consultas públicas por código NFC solamente; prohibimos listar empleados por API anónima.
drop policy if exists bts_nfc_executives_public on public.bts_nfc_executives;
revoke select on public.bts_nfc_executives from anon;
create or replace function public.bts_nfc_public_executive(p_company_slug text,p_card_code text)
returns table(id uuid,full_name text,job_title text,whatsapp_number text,phone_number text,email text,avatar_url text,extra_links jsonb)
language sql stable security definer set search_path='' as $$
  select e.id,e.full_name,e.job_title,e.whatsapp_number,e.phone_number,e.email,e.avatar_url,e.extra_links
  from public.bts_nfc_executives e
  join public.bts_nfc_cards c on c.id=e.company_id
  where c.slug=p_company_slug and c.is_active and e.card_code=p_card_code and e.is_active
  limit 1
$$;
revoke all on function public.bts_nfc_public_executive(text,text) from public;
grant execute on function public.bts_nfc_public_executive(text,text) to anon,authenticated;

-- A private-lookup check for anonymous telemetry. Returns only a boolean.
create or replace function public.bts_nfc_can_log_event(p_executive_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.bts_nfc_executives e
    join public.bts_nfc_cards c on c.id=e.company_id
    where e.id=p_executive_id and e.is_active and c.is_active
  )
$$;
revoke all on function public.bts_nfc_can_log_event(uuid) from public;
grant execute on function public.bts_nfc_can_log_event(uuid) to anon,authenticated;
drop policy if exists bts_nfc_events_public_insert on public.bts_nfc_events;
create policy bts_nfc_events_public_insert on public.bts_nfc_events
for insert to anon,authenticated
with check (public.bts_nfc_can_log_event(executive_id));
