-- BTS Studio NFC: estilos por rubro y personalización persistente.
-- Aplicado a proyecto BTS Studio el 2026-11-09.
-- No altera ninguna URL, vínculo, foto, ni registro existente.
alter table public.bts_nfc_cards add column if not exists template_id text not null default 'classic';
alter table public.bts_nfc_cards add column if not exists theme_options jsonb not null default '{}'::jsonb;
alter table public.bts_nfc_cards drop constraint if exists bts_nfc_template_id_check;
alter table public.bts_nfc_cards add constraint bts_nfc_template_id_check
 check (template_id in ('classic','glass','creator','business','food','beauty','portfolio','realestate','wellness'));
alter table public.bts_nfc_cards drop constraint if exists bts_nfc_theme_options_check;
alter table public.bts_nfc_cards add constraint bts_nfc_theme_options_check
 check (jsonb_typeof(theme_options)='object' and octet_length(theme_options::text)<=4096);
