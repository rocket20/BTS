-- Agregar plantilla Logistics Premium al catálogo permitido, sin cambiar otras reglas.
alter table public.bts_nfc_cards
 drop constraint bts_nfc_template_id_check,
 add constraint bts_nfc_template_id_check
 check(template_id in (
 'classic','glass','logistics','creator','business','food','beauty',
 'portfolio','realestate','wellness'
 ));
