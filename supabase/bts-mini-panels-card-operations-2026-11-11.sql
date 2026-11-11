-- BTS Studio: emisión y estado de tarjetas desde mini panel, sin entregar permisos UPDATE directos.
create or replace function bts_private.business_card_admin_impl(
  p_program_id uuid,
  p_action text,
  p_member_id uuid default null,
  p_full_name text default '',
  p_phone text default '',
  p_card_label text default ''
) returns table(member_id uuid,card_code text,card_active boolean)
language plpgsql security definer set search_path='' as $mini_card$
declare p public.bts_reward_programs%rowtype;
        m public.bts_reward_members%rowtype;
        new_id uuid;
begin
 if (select auth.uid()) is null then raise exception 'Iniciá sesión'; end if;
 select * into p from public.bts_reward_programs where id=p_program_id;
 if not found or not p.is_active then raise exception 'El programa no está disponible'; end if;
 if not exists(select 1 from public.bts_nfc_cards b where b.id=p.business_id and b.is_active) then
  raise exception 'La empresa no está activa';
 end if;
 if not exists(select 1 from public.bts_business_users u
    where u.business_id=p.business_id and u.user_id=(select auth.uid()) and u.is_active
      and u.role in ('owner','manager')) then
  raise exception 'No tenés permisos para administrar estas tarjetas';
 end if;
 if p_action='create' then
   if char_length(trim(p_full_name)) not between 2 and 100 then raise exception 'Nombre inválido'; end if;
   if char_length(p_phone)>25 or char_length(p_card_label)>80 then raise exception 'Datos demasiado extensos'; end if;
   insert into public.bts_reward_members(program_id,full_name,phone,card_label,vip_tier,expires_at,is_active)
   values (p_program_id,trim(p_full_name),trim(p_phone),
     case when trim(p_card_label)='' then 'Tarjeta nueva' else trim(p_card_label) end,
     p.vip_default_tier,
     case when p.kind='vip' then current_date + (p.vip_validity_months||' months')::interval else null end,
     true) returning id into new_id;
 elsif p_action in ('activate','suspend') then
   select * into m from public.bts_reward_members where id=p_member_id and program_id=p_program_id for update;
   if not found then raise exception 'La tarjeta no pertenece a esta empresa'; end if;
   update public.bts_reward_members
      set is_active=(p_action='activate') where id=m.id
      returning id into new_id;
 else
   raise exception 'Operación no permitida';
 end if;
 return query select x.id,x.card_code,x.is_active from public.bts_reward_members x where x.id=new_id;
end $mini_card$;
revoke all on function bts_private.business_card_admin_impl(uuid,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function bts_private.business_card_admin_impl(uuid,text,uuid,text,text,text) to authenticated;
create or replace function public.bts_business_card_admin(
  p_program_id uuid,p_action text,p_member_id uuid default null,
  p_full_name text default '',p_phone text default '',p_card_label text default ''
) returns table(member_id uuid,card_code text,card_active boolean)
language sql security invoker set search_path='' as $mini_card_api$
 select * from bts_private.business_card_admin_impl(p_program_id,p_action,p_member_id,p_full_name,p_phone,p_card_label)
$mini_card_api$;
revoke all on function public.bts_business_card_admin(uuid,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.bts_business_card_admin(uuid,text,uuid,text,text,text) to authenticated;
