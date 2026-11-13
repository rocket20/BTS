-- BTS Studio | Activación puntual de Logistics Premium para Incoex Logistic.
-- Conserva URL, avatar, cover actual, redes, usuarios y las demás empresas.
update public.bts_nfc_cards
set template_id='logistics',
 accent_color='#00c6ff',
 background_color='#071744',
 button_bg_color='#123b95',
 button_text_color='#ffffff',
 button_border_color='#7acbff',
 theme_options=coalesce(theme_options,'{}'::jsonb) || jsonb_build_object(
  'shape','pill','font','modern','align','center',
  'icons','brand','blur',22,'textColor','#ffffff',
  'mutedColor','#d5e5ff','surfaceColor','#14235a')
where slug='incoex-logistic' and template_id='classic';
