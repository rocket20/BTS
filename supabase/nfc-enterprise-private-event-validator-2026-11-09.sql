
-- Event validation lives in an unexposed schema instead of public RPC.
create or replace function bts_private.nfc_can_log_event(p_executive_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.bts_nfc_executives e join public.bts_nfc_cards c on c.id=e.company_id
  where e.id=p_executive_id and e.is_active and c.is_active
 )
$$;
revoke all on function bts_private.nfc_can_log_event(uuid) from public;
grant usage on schema bts_private to anon,authenticated;
grant execute on function bts_private.nfc_can_log_event(uuid) to anon,authenticated;
drop policy if exists bts_nfc_events_public_insert on public.bts_nfc_events;
create policy bts_nfc_events_public_insert on public.bts_nfc_events for insert to anon,authenticated
with check (bts_private.nfc_can_log_event(executive_id));
drop function if exists public.bts_nfc_can_log_event(uuid);
