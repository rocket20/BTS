-- BTS Studio | Restaurar el diseño de Incoex anterior a Logistics Premium.
-- Solo se ejecuta si hay que revertir la presentación visual.
update public.bts_nfc_cards
set template_id='classic',accent_color='#000000',background_color='#0a0a10',
 button_bg_color='#000000',button_text_color='#ffffff',button_border_color='#39faff',
 theme_options='{}'::jsonb
where slug='incoex-logistic' and template_id='logistics';
