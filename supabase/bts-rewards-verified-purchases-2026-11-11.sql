-- BTS Studio | créditos de fidelización verificables y no duplicables.
-- La referencia de compra es obligatoria y única por miembro; no se modifica la RPC anterior aún.
create table if not exists public.bts_reward_purchase_refs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.bts_reward_members(id) on delete cascade,
  program_id uuid not null references public.bts_reward_programs(id) on delete cascade,
  receipt_ref text not null check (char_length(trim(receipt_ref)) between 3 and 80),
  units integer not null check (units between 1 and 1000),
  actor_id uuid not null,
  created_at timestamptz not null default now(),
  unique(member_id,receipt_ref)
);
create index if not exists bts_reward_purchase_refs_member_idx on public.bts_reward_purchase_refs(member_id,created_at desc);
alter table public.bts_reward_purchase_refs enable row level security;
create policy bts_purchase_refs_admin_read on public.bts_reward_purchase_refs for select to authenticated
  using (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())));
revoke all on public.bts_reward_purchase_refs from anon,authenticated;
grant select on public.bts_reward_purchase_refs to authenticated;

-- Validación + registro en una misma transacción; los duplicados hacen rollback.
create or replace function public.bts_reward_record_purchase(
 p_member_id uuid,p_receipt_ref text,p_units integer default 1
)
returns table(new_balance integer,total_redemptions integer,lifetime_total integer)
language plpgsql security definer set search_path='' as $$
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
$$;
revoke all on function public.bts_reward_record_purchase(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.bts_reward_record_purchase(uuid,text,integer) to authenticated;
