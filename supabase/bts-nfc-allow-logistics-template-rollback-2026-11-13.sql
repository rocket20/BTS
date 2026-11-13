-- Reversión: primero retirar la plantilla nueva de los negocios que la usen.
-- No ejecutar automáticamente si hay clientes usando Logistics Premium.
-- Después de restaurar la plantilla de esos negocios:
alter table public.bts_nfc_cards
 drop constraint bts_nfc_template_id_check,
 add constraint bts_nfc_template_id_check
 check(template_id in (
 'classic','glass','creator','business','food','beauty',
 'portfolio','realestate','wellness'
 ));
