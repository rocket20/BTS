
-- Preservar URLs ya grabadas en tarjetas físicas.
create or replace function bts_private.nfc_guard_company_slug()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.slug is distinct from old.slug and exists(
  select 1 from public.bts_nfc_executives e where e.company_id=old.id
 ) then
   raise exception 'Esta empresa tiene NFC ejecutivos. No se permite cambiar su identificador.';
 end if;
 return new;
end;
$$;
revoke all on function bts_private.nfc_guard_company_slug() from public,anon,authenticated;
drop trigger if exists bts_nfc_company_slug_guard on public.bts_nfc_cards;
create trigger bts_nfc_company_slug_guard before update on public.bts_nfc_cards
 for each row execute function bts_private.nfc_guard_company_slug();

create or replace function bts_private.nfc_executive_before_update()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.card_code is distinct from old.card_code or new.company_id is distinct from old.company_id then
   raise exception 'No se puede cambiar el código o la empresa de una tarjeta física NFC';
 end if;
 new.updated_at=now();
 return new;
end;
$$;
revoke all on function bts_private.nfc_executive_before_update() from public,anon,authenticated;
-- Se conserva el trigger existente que usa esta función.

alter table public.bts_nfc_payments add column if not exists currency text not null default 'USD';
alter table public.bts_nfc_payments drop constraint if exists bts_nfc_payments_currency_check;
alter table public.bts_nfc_payments add constraint bts_nfc_payments_currency_check check (currency in ('USD','NIO'));
