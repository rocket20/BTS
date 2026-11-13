-- BTS · Personalización segura de tarjetas VIP y fidelización.
-- Es una migración aditiva: ninguna tarjeta existente cambia su apariencia.
alter table public.bts_reward_programs
 add column if not exists card_gradient_enabled boolean not null default false,
 add column if not exists card_gradient_from text not null default '#22242f',
 add column if not exists card_gradient_to text not null default '#16171f',
 add column if not exists card_gradient_angle integer not null default 145,
 add column if not exists card_logo_path text,
 add column if not exists card_logo_opacity numeric(4,2) not null default 0.16,
 add column if not exists card_logo_scale integer not null default 72,
 add column if not exists card_text_color text not null default 'light';

alter table public.bts_reward_programs
 add constraint bts_card_design_valid_colors check (
 card_gradient_from ~ '^#[[:xdigit:]]{6}$'
 and card_gradient_to ~ '^#[[:xdigit:]]{6}$'
 and card_gradient_angle between 0 and 360
 and card_logo_opacity between 0.05 and 0.40
 and card_logo_scale between 30 and 95
 and card_text_color in ('light','dark')
 ),
 add constraint bts_card_design_logo_scope check (
 card_logo_path is null or (
  card_logo_path ~ '^businesses/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-f0-9]{32}\.(png|jpg|jpeg|webp)$'
  and split_part(card_logo_path,'/',2)=business_id::text
 )
 );

-- Subida sin sobrescritura y limitada a carpeta del negocio/usuario.
-- El bucket bts-nfc-media ya es público solo para mostrar imágenes y limita a 4 MB y PNG/JPEG/WEBP.
create policy bts_card_branding_upload on storage.objects
 for insert to authenticated
 with check (
   bucket_id='bts-nfc-media'
   and (storage.foldername(name))[1]='businesses'
   and (storage.foldername(name))[3]=(select auth.uid())::text
   and name ~ '^businesses/[0-9a-f-]{36}/[0-9a-f-]{36}/[a-f0-9]{32}\.(png|jpg|jpeg|webp)$'
   and (
     exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid()) and a.role in ('owner','admin'))
     or exists(select 1 from public.bts_business_users u
       where u.user_id=(select auth.uid()) and u.business_id::text=(storage.foldername(name))[2]
       and u.is_active and u.role in ('owner','manager'))
   )
 );

-- El mini panel puede modificar ÚNICAMENTE el diseño de un programa suyo,
-- nunca meta, compras, beneficios, tipo, vencimiento ni códigos.
create or replace function bts_scan_impl.bts_business_set_card_design_impl(
 p_program_id uuid, p_gradient_enabled boolean, p_gradient_from text,
 p_gradient_to text, p_gradient_angle integer, p_logo_path text,
 p_logo_opacity numeric, p_logo_scale integer, p_text_color text)
returns uuid language plpgsql security definer set search_path='' as $bts_design$
declare v_business uuid;
begin
 if (select auth.uid()) is null then raise exception 'Iniciá sesión para modificar la tarjeta'; end if;
 select p.business_id into v_business from public.bts_reward_programs p where p.id=p_program_id for update;
 if v_business is null then raise exception 'No se encontró el programa'; end if;
 if not exists (select 1 from public.bts_business_users u
  where u.business_id=v_business and u.user_id=(select auth.uid())
    and u.is_active and u.role in ('owner','manager')) then
  raise exception 'No tenés permiso para modificar el diseño de este negocio';
 end if;
 if coalesce(p_gradient_from,'') !~ '^#[[:xdigit:]]{6}$'
   or coalesce(p_gradient_to,'') !~ '^#[[:xdigit:]]{6}$'
   or p_gradient_angle not between 0 and 360
   or p_logo_opacity not between 0.05 and 0.40
   or p_logo_scale not between 30 and 95
   or coalesce(p_text_color,'') not in ('light','dark') then
  raise exception 'Valores de diseño incorrectos';
 end if;
 if p_logo_path is not null and (
   p_logo_path !~ '^businesses/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-f0-9]{32}\.(png|jpg|jpeg|webp)$'
   or split_part(p_logo_path,'/',2)<>v_business::text
 ) then raise exception 'El logo debe pertenecer al mismo negocio'; end if;
 update public.bts_reward_programs
 set card_gradient_enabled=coalesce(p_gradient_enabled,false),
 card_gradient_from=lower(p_gradient_from),card_gradient_to=lower(p_gradient_to),
 card_gradient_angle=p_gradient_angle,card_logo_path=p_logo_path,
 card_logo_opacity=p_logo_opacity,card_logo_scale=p_logo_scale,
 card_text_color=p_text_color,updated_at=now()
 where id=p_program_id;
 return p_program_id;
end $bts_design$;
revoke all on function bts_scan_impl.bts_business_set_card_design_impl(uuid,boolean,text,text,integer,text,numeric,integer,text) from public,anon,authenticated;
grant execute on function bts_scan_impl.bts_business_set_card_design_impl(uuid,boolean,text,text,integer,text,numeric,integer,text) to authenticated;

create or replace function public.bts_business_set_card_design(
 p_program_id uuid, p_gradient_enabled boolean, p_gradient_from text,
 p_gradient_to text, p_gradient_angle integer, p_logo_path text,
 p_logo_opacity numeric, p_logo_scale integer, p_text_color text)
returns uuid language sql security invoker set search_path='' as $wrapper$
 select bts_scan_impl.bts_business_set_card_design_impl(
   p_program_id,p_gradient_enabled,p_gradient_from,p_gradient_to,p_gradient_angle,
   p_logo_path,p_logo_opacity,p_logo_scale,p_text_color);
$wrapper$;
revoke all on function public.bts_business_set_card_design(uuid,boolean,text,text,integer,text,numeric,integer,text) from public,anon,authenticated;
grant execute on function public.bts_business_set_card_design(uuid,boolean,text,text,integer,text,numeric,integer,text) to authenticated;

-- Consulta pública limitada a la estética de UNA tarjeta NFC activa, entregada y asignada.
-- No se cambia la firma existente de bts_reward_public_card.
create or replace function bts_scan_impl.bts_reward_public_style(p_card_code text)
returns table(gradient_enabled boolean,gradient_from text,gradient_to text,gradient_angle integer,
 logo_path text,logo_opacity numeric,logo_scale integer,text_color text)
language sql stable security definer set search_path='' as $style_query$
 select p.card_gradient_enabled,p.card_gradient_from,p.card_gradient_to,p.card_gradient_angle,
 p.card_logo_path,p.card_logo_opacity,p.card_logo_scale,p.card_text_color
 from public.bts_reward_members m
 join public.bts_reward_programs p on p.id=m.program_id and p.is_active
 join public.bts_nfc_cards b on b.id=p.business_id and b.is_active
 join public.bts_nfc_inventory i on i.member_id=m.id and i.status='assigned'
 join public.bts_nfc_batches bat on bat.id=i.batch_id and bat.released_at is not null
 where p_card_code ~ '^[a-f0-9]{20}$' and m.card_code=p_card_code and m.is_active
 limit 1
$style_query$;
revoke all on function bts_scan_impl.bts_reward_public_style(text) from public,anon,authenticated;
grant execute on function bts_scan_impl.bts_reward_public_style(text) to anon,authenticated;

create or replace function public.bts_reward_public_style(p_card_code text)
returns table(gradient_enabled boolean,gradient_from text,gradient_to text,gradient_angle integer,
 logo_path text,logo_opacity numeric,logo_scale integer,text_color text)
language sql stable security invoker set search_path='' as $style_wrapper$
 select * from bts_scan_impl.bts_reward_public_style(p_card_code);
$style_wrapper$;
revoke all on function public.bts_reward_public_style(text) from public,anon,authenticated;
grant execute on function public.bts_reward_public_style(text) to anon,authenticated;
