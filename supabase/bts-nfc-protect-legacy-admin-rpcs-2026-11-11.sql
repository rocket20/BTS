-- Protege los códigos privados sin romper el dashboard BTS.
CREATE OR REPLACE FUNCTION bts_private.bts_reward_apply_event_impl(p_member_id uuid, p_action text, p_units integer DEFAULT 1)
 RETURNS TABLE(new_balance integer, total_redemptions integer, lifetime_total integer)
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare m public.bts_reward_members%rowtype;
        p public.bts_reward_programs%rowtype;
        next_balance integer;
        next_redeems integer;
        next_lifetime integer;
        delta_amount integer;
begin
 if not exists(select 1 from public.bts_admins a where a.user_id=auth.uid()) then
   raise exception 'Acceso administrativo requerido';
 end if;
 select * into m from public.bts_reward_members where id=p_member_id for update;
 if not found then raise exception 'Tarjeta no encontrada';end if;
 select * into p from public.bts_reward_programs where id=m.program_id;
 if p.kind<>'loyalty' then raise exception 'Esta operación solo corresponde a fidelización';end if;
 if not p.is_active or not m.is_active then raise exception 'Programa o tarjeta suspendida';end if;
 next_balance=m.current_units;next_redeems=m.redeemed_count;next_lifetime=m.lifetime_units;
 if p_action='earn' then
   if p_units<1 or p_units>1000 then raise exception 'Cantidad fuera de rango';end if;
   if m.current_units+p_units>1000000 then raise exception 'Máximo de unidades alcanzado';end if;
   next_balance=m.current_units+p_units;next_lifetime=m.lifetime_units+p_units;
   delta_amount=p_units;
 elsif p_action='redeem' then
   if m.current_units<p.goal_units then raise exception 'Aún no alcanza la meta del premio';end if;
   next_balance=0;next_redeems=m.redeemed_count+1;delta_amount=-m.current_units;
 elsif p_action='adjust' then
   if p_units=0 or p_units< -1000 or p_units>1000 then raise exception 'Ajuste fuera de rango';end if;
   next_balance=m.current_units+p_units;
   if next_balance<0 or next_balance>1000000 then raise exception 'El ajuste deja un saldo inválido';end if;
   delta_amount=p_units;
 else
   raise exception 'Operación desconocida';
 end if;
 update public.bts_reward_members set current_units=next_balance,
    redeemed_count=next_redeems,lifetime_units=next_lifetime where id=m.id;
 insert into public.bts_reward_movements(member_id,program_id,action,delta,balance_after,actor_id)
 values(m.id,p.id,p_action,delta_amount,next_balance,auth.uid());
 return query select next_balance,next_redeems,next_lifetime;
end;
$function$
;
revoke all on function bts_private.bts_reward_apply_event_impl(uuid,text,integer) from public,anon,authenticated;
grant execute on function bts_private.bts_reward_apply_event_impl(uuid,text,integer) to authenticated;
create or replace function public.bts_reward_apply_event(p_member_id uuid,p_action text,p_units integer default 1) returns table(new_balance integer,total_redemptions integer,lifetime_total integer) language sql security invoker set search_path='' as $wrap_bts_reward_apply_event$ select * from bts_private.bts_reward_apply_event_impl(p_member_id,p_action,p_units) $wrap_bts_reward_apply_event$;
CREATE OR REPLACE FUNCTION bts_private.bts_reward_record_purchase_impl(p_member_id uuid, p_receipt_ref text, p_units integer DEFAULT 1)
 RETURNS TABLE(new_balance integer, total_redemptions integer, lifetime_total integer)
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare m public.bts_reward_members%rowtype;
        p public.bts_reward_programs%rowtype;
        reference_clean text;
begin
 if auth.uid() is null or not exists(select 1 from public.bts_admins a where a.user_id=auth.uid()) then
   raise exception 'Acceso administrativo requerido';
 end if;
 reference_clean := upper(trim(coalesce(p_receipt_ref,'')));
 if char_length(reference_clean) < 3 or char_length(reference_clean) > 80 then
   raise exception 'Ingresá el número único de compra (3 a 80 caracteres)';
 end if;
 if p_units not between 1 and 1000 then raise exception 'Cantidad fuera de rango'; end if;
 select * into m from public.bts_reward_members where id=p_member_id for update;
 if not found then raise exception 'Cliente no encontrado'; end if;
 select * into p from public.bts_reward_programs where id=m.program_id;
 if p.kind<>'loyalty' or not p.is_active or not m.is_active then
   raise exception 'Tarjeta o programa de fidelización inactivo';
 end if;
 if exists(select 1 from public.bts_reward_purchase_refs r where r.member_id=m.id and r.receipt_ref=reference_clean) then
   raise exception 'La compra ya fue registrada para este cliente';
 end if;
 insert into public.bts_reward_purchase_refs(member_id,program_id,receipt_ref,units,actor_id)
 values(m.id,p.id,reference_clean,p_units,auth.uid());
 return query select r.new_balance,r.total_redemptions,r.lifetime_total
 from public.bts_reward_apply_event(p_member_id,'earn',p_units) as r;
end;
$function$
;
revoke all on function bts_private.bts_reward_record_purchase_impl(uuid,text,integer) from public,anon,authenticated;
grant execute on function bts_private.bts_reward_record_purchase_impl(uuid,text,integer) to authenticated;
create or replace function public.bts_reward_record_purchase(p_member_id uuid,p_receipt_ref text,p_units integer default 1) returns table(new_balance integer,total_redemptions integer,lifetime_total integer) language sql security invoker set search_path='' as $wrap_bts_reward_record_purchase$ select * from bts_private.bts_reward_record_purchase_impl(p_member_id,p_receipt_ref,p_units) $wrap_bts_reward_record_purchase$;
CREATE OR REPLACE FUNCTION bts_private.bts_vip_checkin_impl(p_program_id uuid, p_card_code text, p_note text DEFAULT ''::text)
 RETURNS TABLE(member_name text, tier text, expires_on date, checked_at timestamp with time zone)
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_member public.bts_reward_members%rowtype;
        v_program public.bts_reward_programs%rowtype;
        v_id bigint;
        v_code text;
begin
  if (select auth.uid()) is null
     or not exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())) then
    raise exception 'No tenés permisos para validar membresías';
  end if;
  v_code := lower(trim(coalesce(p_card_code,'')));
  if v_code !~ '^[a-f0-9]{20}$' then raise exception 'Código NFC inválido'; end if;
  if char_length(coalesce(p_note,'')) > 180 then raise exception 'La nota es demasiado extensa'; end if;
  select * into v_program from public.bts_reward_programs where id=p_program_id;
  if not found or v_program.kind <> 'vip' or not v_program.is_active then
    raise exception 'Programa VIP no disponible';
  end if;
  if not exists(select 1 from public.bts_nfc_cards b where b.id=v_program.business_id and b.is_active) then
    raise exception 'El negocio está suspendido';
  end if;
  select * into v_member from public.bts_reward_members
    where program_id=p_program_id and card_code=v_code for update;
  if not found then raise exception 'Tarjeta no encontrada en este negocio'; end if;
  if not v_member.is_active then raise exception 'Tarjeta suspendida'; end if;
  if v_member.expires_at is null or v_member.expires_at < current_date then
    raise exception 'Membresía VIP vencida o sin fecha de vigencia';
  end if;
  if exists(
    select 1 from public.bts_vip_checkins c
    where c.member_id=v_member.id and c.created_at>now()-interval '60 seconds'
  ) then
    raise exception 'Esta tarjeta ya fue validada hace menos de un minuto';
  end if;
  insert into public.bts_vip_checkins(member_id,program_id,checked_by,note)
  values(v_member.id,v_program.id,(select auth.uid()),trim(coalesce(p_note,''))) returning id into v_id;
  return query select v_member.full_name,v_member.vip_tier,v_member.expires_at,c.created_at
    from public.bts_vip_checkins c where c.id=v_id;
end $function$
;
revoke all on function bts_private.bts_vip_checkin_impl(uuid,text,text) from public,anon,authenticated;
grant execute on function bts_private.bts_vip_checkin_impl(uuid,text,text) to authenticated;
create or replace function public.bts_vip_checkin(p_program_id uuid,p_card_code text,p_note text default '') returns table(member_name text,tier text,expires_on date,checked_at timestamptz) language sql security invoker set search_path='' as $wrap_bts_vip_checkin$ select * from bts_private.bts_vip_checkin_impl(p_program_id,p_card_code,p_note) $wrap_bts_vip_checkin$;
