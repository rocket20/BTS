-- BTS Studio · Separación NFC normal / corporativo
-- Las tarjetas existentes continúan como NFC normal por defecto.
alter table public.bts_nfc_cards
 add column if not exists nfc_category text not null default 'normal';
alter table public.bts_nfc_cards
 drop constraint if exists bts_nfc_cards_category_check;
alter table public.bts_nfc_cards
 add constraint bts_nfc_cards_category_check
 check (nfc_category in ('normal','corporate'));
-- Conservar empresas que ya administran ejecutivos, si las hubiese.
update public.bts_nfc_cards c set nfc_category='corporate'
 where nfc_category='normal' and exists
 (select 1 from public.bts_nfc_executives e where e.company_id=c.id);
create index if not exists bts_nfc_cards_category_created_idx
 on public.bts_nfc_cards(nfc_category,created_at desc);
