-- BTS Studio: categorías predefinidas y avisos visibles al escanear tarjetas NFC.
-- No se envían notificaciones push: se muestran en la página pública tras escanear la tarjeta.
alter table public.bts_reward_programs add column if not exists card_category text;
update public.bts_reward_programs
 set card_category=case when kind='vip' then 'vip'
   when unit_name='puntos' then 'points'
   when unit_name='visitas' then 'visits'
   else 'purchases' end
 where card_category is null;
alter table public.bts_reward_programs alter column card_category set default 'purchases';
alter table public.bts_reward_programs alter column card_category set not null;
alter table public.bts_reward_programs add constraint bts_reward_programs_card_category_check
 check (card_category in ('purchases','visits','points','vip'));
alter table public.bts_reward_programs add constraint bts_reward_programs_kind_matches_category
 check ((kind='vip' and card_category='vip') or (kind='loyalty' and card_category in ('purchases','visits','points')));
-- El sistema anterior permitía solo un programa loyalty por negocio.
-- Ahora cada categoría distinta puede venderse por separado, sin duplicar la misma categoría.
alter table public.bts_reward_programs drop constraint if exists bts_reward_programs_business_id_kind_key;
alter table public.bts_reward_programs add constraint bts_reward_programs_business_category_unique
 unique (business_id,card_category);

create table public.bts_nfc_card_notices (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.bts_nfc_cards(id) on delete cascade,
 program_id uuid not null references public.bts_reward_programs(id) on delete cascade,
 member_id uuid references public.bts_reward_members(id) on delete cascade,
 notice_type text not null check (notice_type in ('promotion','gift','info')),
 title text not null check (char_length(btrim(title)) between 2 and 90),
 message text not null check (char_length(btrim(message)) between 3 and 300),
 is_active boolean not null default true,
 starts_on date,
 ends_on date,
 created_by uuid not null default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint bts_nfc_notice_dates check (starts_on is null or ends_on is null or ends_on>=starts_on)
);
create index bts_nfc_card_notices_lookup on public.bts_nfc_card_notices(program_id,is_active,member_id,ends_on);

create or replace function bts_private.validate_nfc_card_notice()
returns trigger language plpgsql set search_path='' as $notice_validate$
begin
 if not exists (select 1 from public.bts_reward_programs p where p.id=new.program_id and p.business_id=new.business_id)
 then raise exception 'El programa no pertenece a la empresa'; end if;
 if new.member_id is not null and not exists(
  select 1 from public.bts_reward_members m where m.id=new.member_id and m.program_id=new.program_id
 ) then raise exception 'La tarjeta del destinatario no pertenece al programa'; end if;
 new.title=btrim(new.title);new.message=btrim(new.message);new.updated_at=now();
 return new;
end $notice_validate$;
create trigger bts_validate_nfc_card_notice before insert or update
 on public.bts_nfc_card_notices for each row execute function bts_private.validate_nfc_card_notice();

alter table public.bts_nfc_card_notices enable row level security;
create policy bts_notices_admin_select on public.bts_nfc_card_notices for select to authenticated
 using(exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())));
create policy bts_notices_business_select on public.bts_nfc_card_notices for select to authenticated
 using(exists(select 1 from public.bts_business_users u
  where u.user_id=(select auth.uid()) and u.business_id=bts_nfc_card_notices.business_id and u.is_active));
create policy bts_notices_admin_write on public.bts_nfc_card_notices for all to authenticated
 using(exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')))
 with check(exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')));
create policy bts_notices_business_insert on public.bts_nfc_card_notices for insert to authenticated
 with check(exists(select 1 from public.bts_business_users u
  where u.user_id=(select auth.uid()) and u.business_id=bts_nfc_card_notices.business_id
  and u.is_active and u.role in ('owner','manager')));
create policy bts_notices_business_update on public.bts_nfc_card_notices for update to authenticated
 using(exists(select 1 from public.bts_business_users u
  where u.user_id=(select auth.uid()) and u.business_id=bts_nfc_card_notices.business_id
  and u.is_active and u.role in ('owner','manager')))
 with check(exists(select 1 from public.bts_business_users u
  where u.user_id=(select auth.uid()) and u.business_id=bts_nfc_card_notices.business_id
  and u.is_active and u.role in ('owner','manager')));
create policy bts_notices_business_delete on public.bts_nfc_card_notices for delete to authenticated
 using(exists(select 1 from public.bts_business_users u
  where u.user_id=(select auth.uid()) and u.business_id=bts_nfc_card_notices.business_id
  and u.is_active and u.role in ('owner','manager')));

revoke all on public.bts_nfc_card_notices from anon,authenticated;
grant select,insert,update,delete on public.bts_nfc_card_notices to authenticated;

-- La página pública solo recibe mensajes para una tarjeta real, activa, ya asignada y enviada.
-- No devuelve identidad de otros clientes, tokens privados ni contenido no publicado.
create or replace function public.bts_reward_public_notices(p_card_code text)
returns table(notice_type text,notice_title text,notice_message text)
language sql stable security definer set search_path='' as $public_notices$
 select n.notice_type,n.title,n.message
 from public.bts_reward_members m
 join public.bts_reward_programs p on p.id=m.program_id and p.is_active
 join public.bts_nfc_cards b on b.id=p.business_id and b.is_active
 join public.bts_nfc_inventory inv on inv.member_id=m.id and inv.status='assigned'
 join public.bts_nfc_batches bat on bat.id=inv.batch_id and bat.released_at is not null
 join public.bts_nfc_card_notices n on n.program_id=p.id and n.business_id=b.id
   and (n.member_id is null or n.member_id=m.id)
 where p_card_code ~ '^[a-f0-9]{20}$' and m.card_code=p_card_code and m.is_active
   and n.is_active and (n.starts_on is null or n.starts_on<=current_date)
   and (n.ends_on is null or n.ends_on>=current_date)
 order by n.created_at desc limit 5
$public_notices$;
revoke all on function public.bts_reward_public_notices(text) from public;
grant execute on function public.bts_reward_public_notices(text) to anon,authenticated;
