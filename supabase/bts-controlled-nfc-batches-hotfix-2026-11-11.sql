-- Corregir concatenación del nombre físico sin modificar lotes existentes.
create or replace function bts_private.issue_nfc_batch_impl(
 p_business_id uuid,p_program_id uuid,p_quantity integer,p_note text default ''
) returns table(batch_id uuid,slot_id uuid,reference text,card_code text)
language plpgsql security definer set search_path='' as $issue_batch$
declare
 p public.bts_reward_programs%rowtype;
 batch uuid;
 new_member public.bts_reward_members%rowtype;
 new_slot uuid;
 i integer;
begin
 if (select auth.uid()) is null or not exists(
  select 1 from public.bts_admins a
  where a.user_id=(select auth.uid()) and a.role in ('owner','admin')
 ) then raise exception 'Solo BTS puede generar códigos NFC'; end if;
 if p_quantity is null or p_quantity not between 1 and 200 then
  raise exception 'La cantidad permitida es de 1 a 200 por lote'; end if;
 if char_length(coalesce(p_note,''))>200 then raise exception 'Nota demasiado extensa'; end if;
 select * into p from public.bts_reward_programs
   where id=p_program_id and business_id=p_business_id and is_active;
 if not found then raise exception 'Seleccioná un programa activo de esa empresa'; end if;
 if not exists(select 1 from public.bts_nfc_cards b where b.id=p_business_id and b.is_active) then
   raise exception 'Empresa no activa'; end if;
 insert into public.bts_nfc_batches(business_id,program_id,quantity,created_by,note)
 values(p_business_id,p_program_id,p_quantity,(select auth.uid()),trim(coalesce(p_note,'')))
 returning id into batch;
 for i in 1..p_quantity loop
   insert into public.bts_reward_members(program_id,full_name,card_label,is_active,vip_tier,expires_at)
   values(p_program_id,'Pendiente de asignación','Tarjeta '||lpad(i::text,3,'0'),true,p.vip_default_tier,null)
   returning * into new_member;
   insert into public.bts_nfc_inventory(batch_id,business_id,program_id,member_id,number,reference)
   values(batch,p_business_id,p_program_id,new_member.id,i,'BTS-'||left(replace(batch::text,'-',''),6)||'-'||lpad(i::text,3,'0'))
   returning id into new_slot;
   batch_id:=batch;slot_id:=new_slot;reference:='BTS-'||left(replace(batch::text,'-',''),6)||'-'||lpad(i::text,3,'0');card_code:=new_member.card_code;
   return next;
 end loop;
end $issue_batch$;
