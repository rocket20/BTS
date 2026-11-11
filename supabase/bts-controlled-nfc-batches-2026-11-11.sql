-- BTS / Control de lotes NFC 2026-11-11
-- Únicamente BTS genera códigos y activa inventario. El cliente solo asigna nombre/beneficio.
-- RLS + permisos de columna: el código real NO se expone a usuarios empresariales.
create table if not exists public.bts_nfc_batches (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.bts_nfc_cards(id) on delete restrict,
 program_id uuid not null references public.bts_reward_programs(id) on delete restrict,
 quantity integer not null check (quantity between 1 and 200),
 created_by uuid not null,
 note text not null default '' check(char_length(note)<=200),
 created_at timestamptz not null default now()
);
create index if not exists bts_nfc_batches_business_idx on public.bts_nfc_batches(business_id,created_at desc);
alter table public.bts_nfc_batches enable row level security;

create table if not exists public.bts_nfc_inventory (
 id uuid primary key default gen_random_uuid(),
 batch_id uuid not null references public.bts_nfc_batches(id) on delete restrict,
 business_id uuid not null references public.bts_nfc_cards(id) on delete restrict,
 program_id uuid not null references public.bts_reward_programs(id) on delete restrict,
 member_id uuid not null unique references public.bts_reward_members(id) on delete restrict,
 number integer not null check(number>=1),
 reference text not null check(char_length(reference) between 6 and 24),
 status text not null default 'available' check(status in ('available','assigned','suspended')),
 benefit_label text not null default '' check(char_length(benefit_label)<=160),
 assigned_at timestamptz,
 assigned_by uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(batch_id,number)
);
create index if not exists bts_nfc_inventory_business_idx on public.bts_nfc_inventory(business_id,status);
create index if not exists bts_nfc_inventory_program_idx on public.bts_nfc_inventory(program_id,status);
alter table public.bts_nfc_inventory enable row level security;

-- Empresas consultan solo el inventario asignado a su propio negocio.
create policy bts_nfc_batch_admin on public.bts_nfc_batches for select to authenticated
 using (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())));
create policy bts_nfc_batch_business on public.bts_nfc_batches for select to authenticated
 using (exists(select 1 from public.bts_business_users u
 where u.business_id=bts_nfc_batches.business_id and u.user_id=(select auth.uid()) and u.is_active));
create policy bts_nfc_inv_admin on public.bts_nfc_inventory for select to authenticated
 using (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())));
create policy bts_nfc_inv_business on public.bts_nfc_inventory for select to authenticated
 using (exists(select 1 from public.bts_business_users u
 where u.business_id=bts_nfc_inventory.business_id and u.user_id=(select auth.uid()) and u.is_active));
revoke all on public.bts_nfc_batches,public.bts_nfc_inventory from anon,authenticated;
grant select on public.bts_nfc_batches,public.bts_nfc_inventory to authenticated;

-- Denegar de manera permanente la RPC antigua que dejaba crear tarjetas sin límite al negocio.
revoke execute on function public.bts_business_card_admin(uuid,text,uuid,text,text,text) from public,anon,authenticated;
revoke execute on function bts_private.business_card_admin_impl(uuid,text,uuid,text,text,text) from public,anon,authenticated;

-- El personal puede consultar clientes, pero NO card_code (token de NFC).
-- BTS sigue consultando el código a través de una función propia limitada a administradores.
revoke select on public.bts_reward_members from authenticated;
grant select (
 id,program_id,full_name,phone,email,card_label,current_units,lifetime_units,
 redeemed_count,vip_tier,expires_at,is_active,notes,created_at,updated_at
) on public.bts_reward_members to authenticated;

-- Función para consulta histórica en dashboard BTS sin exponer códigos a empresas.
create or replace function bts_private.admin_member_list_impl(p_program_id uuid)
returns setof public.bts_reward_members
language plpgsql security definer set search_path='' as $admin_member_list$
begin
 if (select auth.uid()) is null or not exists(
   select 1 from public.bts_admins a where a.user_id=(select auth.uid())
 ) then raise exception 'Acceso BTS requerido'; end if;
 return query select m.* from public.bts_reward_members m
  where m.program_id=p_program_id order by m.created_at desc limit 1000;
end $admin_member_list$;
revoke all on function bts_private.admin_member_list_impl(uuid) from public,anon,authenticated;
grant execute on function bts_private.admin_member_list_impl(uuid) to authenticated;
create or replace function public.bts_admin_member_list(p_program_id uuid)
returns setof public.bts_reward_members
language sql security invoker set search_path='' as $admin_member_bridge$
 select * from bts_private.admin_member_list_impl(p_program_id)
$admin_member_bridge$;
revoke all on function public.bts_admin_member_list(uuid) from public,anon,authenticated;
grant execute on function public.bts_admin_member_list(uuid) to authenticated;

-- Alta masiva exclusivamente BTS: toda la transacción o nada.
-- El token NFC se genera en Postgres, la empresa no lo conoce ni recibe.
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
   values(p_program_id,'Pendiente de asignación','Tarjeta '+lpad(i::text,3,'0'),true,p.vip_default_tier,null)
   returning * into new_member;
   insert into public.bts_nfc_inventory(batch_id,business_id,program_id,member_id,number,reference)
   values(batch,p_business_id,p_program_id,new_member.id,i,'BTS-'+left(replace(batch::text,'-',''),6)+'-'+lpad(i::text,3,'0'))
   returning id into new_slot;
   batch_id:=batch;slot_id:=new_slot;reference:='BTS-'+left(replace(batch::text,'-',''),6)+'-'+lpad(i::text,3,'0');card_code:=new_member.card_code;
   return next;
 end loop;
end $issue_batch$;
revoke all on function bts_private.issue_nfc_batch_impl(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function bts_private.issue_nfc_batch_impl(uuid,uuid,integer,text) to authenticated;
create or replace function public.bts_issue_nfc_batch(
 p_business_id uuid,p_program_id uuid,p_quantity integer,p_note text default ''
) returns table(batch_id uuid,slot_id uuid,reference text,card_code text)
language sql security invoker set search_path='' as $issue_bridge$
 select * from bts_private.issue_nfc_batch_impl(p_business_id,p_program_id,p_quantity,p_note)
$issue_bridge$;
revoke all on function public.bts_issue_nfc_batch(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.bts_issue_nfc_batch(uuid,uuid,integer,text) to authenticated;

-- Descarga de códigos solo BTS para impresión/programación de NFC, nunca portal comercial.
create or replace function bts_private.admin_batch_codes_impl(p_batch_id uuid)
returns table(reference text,card_code text)
language plpgsql security definer set search_path='' as $admin_codes$
begin
 if (select auth.uid()) is null or not exists(
  select 1 from public.bts_admins a
  where a.user_id=(select auth.uid()) and a.role in ('owner','admin')
 ) then raise exception 'Solo BTS puede consultar códigos NFC'; end if;
 return query select inv.reference,m.card_code from public.bts_nfc_inventory inv
  join public.bts_reward_members m on m.id=inv.member_id
  where inv.batch_id=p_batch_id order by inv.number;
end $admin_codes$;
revoke all on function bts_private.admin_batch_codes_impl(uuid) from public,anon,authenticated;
grant execute on function bts_private.admin_batch_codes_impl(uuid) to authenticated;
create or replace function public.bts_admin_batch_codes(p_batch_id uuid)
returns table(reference text,card_code text)
language sql security invoker set search_path='' as $admin_codes_bridge$
 select * from bts_private.admin_batch_codes_impl(p_batch_id)
$admin_codes_bridge$;
revoke all on function public.bts_admin_batch_codes(uuid) from public,anon,authenticated;
grant execute on function public.bts_admin_batch_codes(uuid) to authenticated;

-- Empresa: únicamente asignar una tarjeta ya existente y activada por BTS.
-- No crea tokens, no cambia status y no puede reasignar después.
create or replace function bts_private.assign_nfc_inventory_impl(
 p_slot_id uuid,p_full_name text,p_benefit_label text
) returns table(slot_id uuid,card_reference text,card_holder text,card_benefit text)
language plpgsql security definer set search_path='' as $assign_inventory$
declare inv public.bts_nfc_inventory%rowtype;
begin
 if (select auth.uid()) is null then raise exception 'Iniciá sesión'; end if;
 if char_length(trim(coalesce(p_full_name,''))) not between 2 and 100 then
  raise exception 'Nombre del cliente inválido'; end if;
 if char_length(trim(coalesce(p_benefit_label,''))) not between 2 and 160 then
  raise exception 'Ingresá el beneficio de 2 a 160 caracteres'; end if;
 select * into inv from public.bts_nfc_inventory where id=p_slot_id for update;
 if not found then raise exception 'Tarjeta no encontrada'; end if;
 if inv.status <> 'available' then raise exception 'La tarjeta ya fue asignada o suspendida por BTS'; end if;
 if not exists(select 1 from public.bts_business_users u
   where u.business_id=inv.business_id and u.user_id=(select auth.uid()) and u.is_active
    and u.role in ('owner','manager')) then
  raise exception 'No tenés permiso para asignar tarjetas de esta empresa'; end if;
 if not exists(select 1 from public.bts_nfc_cards b where b.id=inv.business_id and b.is_active) then
  raise exception 'Empresa suspendida'; end if;
 update public.bts_reward_members m
   set full_name=trim(p_full_name)
   where m.id=inv.member_id;
 update public.bts_nfc_inventory
  set status='assigned',benefit_label=trim(p_benefit_label),assigned_at=now(),assigned_by=(select auth.uid()),updated_at=now()
  where id=inv.id;
 slot_id:=inv.id;card_reference:=inv.reference;card_holder:=trim(p_full_name);card_benefit:=trim(p_benefit_label);
 return next;
end $assign_inventory$;
revoke all on function bts_private.assign_nfc_inventory_impl(uuid,text,text) from public,anon,authenticated;
grant execute on function bts_private.assign_nfc_inventory_impl(uuid,text,text) to authenticated;
create or replace function public.bts_business_assign_nfc(p_slot_id uuid,p_full_name text,p_benefit_label text)
returns table(slot_id uuid,card_reference text,card_holder text,card_benefit text)
language sql security invoker set search_path='' as $assign_bridge$
 select * from bts_private.assign_nfc_inventory_impl(p_slot_id,p_full_name,p_benefit_label)
$assign_bridge$;
revoke all on function public.bts_business_assign_nfc(uuid,text,text) from public,anon,authenticated;
grant execute on function public.bts_business_assign_nfc(uuid,text,text) to authenticated;

-- Tarjeta pública: una tarjeta física del lote no se muestra hasta ser asignada.
-- Beneficio personalizado no cambia reglas de acumulación (p. ej. meta 6).
create or replace function public.bts_reward_public_card(p_card_code text)
 returns table(member_name text, card_label text, kind text, brand_name text,
 program_title text, program_description text, card_theme text, accent_color text,
 goal_units integer, unit_name text, reward_label text, current_units integer,
 lifetime_units integer, redeemed_count integer, vip_tier text, vip_benefits text,
 expires_at date, member_active boolean)
 language sql stable security definer set search_path='' as $public_card_inventory$
 select m.full_name,m.card_label,p.kind,b.business_name,p.title,p.description,p.card_theme,p.accent_color,
        p.goal_units,p.unit_name,coalesce(nullif(inv.benefit_label,''),p.reward_label),m.current_units,
        m.lifetime_units,m.redeemed_count,m.vip_tier,
        case when p.kind='vip' then coalesce(nullif(inv.benefit_label,''),p.vip_benefits) else p.vip_benefits end,
        m.expires_at,m.is_active
 from public.bts_reward_members m
 join public.bts_reward_programs p on p.id=m.program_id
 join public.bts_nfc_cards b on b.id=p.business_id
 left join public.bts_nfc_inventory inv on inv.member_id=m.id
 where p_card_code ~ '^[a-f0-9]{20}$'
   and m.card_code=p_card_code and p.is_active and b.is_active
   and (inv.id is null or inv.status='assigned')
 limit 1
$public_card_inventory$;
-- Se conservan los permisos actuales de la RPC pública.
