-- BTS Studio · Control de acceso VIP · 2026-11-11
-- Operación aditiva; conserva tarjetas, códigos NFC y programas existentes.
create table if not exists public.bts_vip_checkins (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.bts_reward_members(id) on delete restrict,
  program_id uuid not null references public.bts_reward_programs(id) on delete restrict,
  checked_by uuid not null,
  note text not null default '' check (char_length(note)<=180),
  created_at timestamptz not null default now()
);
create index if not exists bts_vip_checkins_program_time_idx on public.bts_vip_checkins (program_id,created_at desc);
create index if not exists bts_vip_checkins_member_time_idx on public.bts_vip_checkins (member_id,created_at desc);

alter table public.bts_vip_checkins enable row level security;
create policy bts_vip_checkins_admin_select on public.bts_vip_checkins for select to authenticated
 using (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())));
create policy bts_vip_checkins_admin_insert on public.bts_vip_checkins for insert to authenticated
 with check (checked_by=(select auth.uid()) and exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())));
revoke all on public.bts_vip_checkins from anon,authenticated;
grant select,insert on public.bts_vip_checkins to authenticated;
grant usage,select on sequence public.bts_vip_checkins_id_seq to authenticated;

-- Check-in: acceso administrativo, vigencia, estado del negocio y prevención de duplicaciones accidentales.
create or replace function public.bts_vip_checkin(
  p_program_id uuid,
  p_card_code text,
  p_note text default ''
)
returns table(member_name text,tier text,expires_on date,checked_at timestamptz)
language plpgsql security invoker set search_path='' as $$
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
end $$;
revoke all on function public.bts_vip_checkin(uuid,text,text) from public,anon,authenticated;
grant execute on function public.bts_vip_checkin(uuid,text,text) to authenticated;
