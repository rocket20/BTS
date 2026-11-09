-- BTS Studio NFC | Fidelización y VIP | 2026-11-09
-- Programas privados por negocio, saldo controlado en base de datos y URL pública de consulta.
create extension if not exists pgcrypto;

create table if not exists public.bts_reward_programs (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.bts_nfc_cards(id) on delete cascade,
 kind text not null check (kind in ('loyalty','vip')),
 title text not null check (char_length(title) between 2 and 85),
 description text not null default '' check (char_length(description)<=200),
 card_theme text not null default 'midnight' check (card_theme in ('midnight','wine','champagne','forest','ivory')),
 accent_color text not null default '#b03b60' check(accent_color ~ '^#[0-9a-fA-F]{6}$'),
 goal_units integer not null default 6 check(goal_units between 1 and 10000),
 unit_name text not null default 'compras' check(unit_name in ('compras','puntos','visitas')),
 reward_label text not null default 'Premio de fidelidad' check(char_length(reward_label) between 1 and 130),
 units_per_visit integer not null default 1 check(units_per_visit between 1 and 1000),
 vip_default_tier text not null default 'Gold' check(char_length(vip_default_tier) between 1 and 40),
 vip_benefits text not null default 'Beneficios exclusivos' check(char_length(vip_benefits) between 1 and 600),
 vip_validity_months integer not null default 12 check(vip_validity_months between 1 and 60),
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (business_id,kind)
);
create index if not exists bts_reward_programs_kind_idx on public.bts_reward_programs(kind,business_id);
alter table public.bts_reward_programs enable row level security;
drop policy if exists bts_rewards_program_admin on public.bts_reward_programs;
create policy bts_rewards_program_admin on public.bts_reward_programs for all to authenticated
 using (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())))
 with check (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())));
revoke all on public.bts_reward_programs from anon,authenticated;
grant select,insert,update,delete on public.bts_reward_programs to authenticated;

create table if not exists public.bts_reward_members (
 id uuid primary key default gen_random_uuid(),
 program_id uuid not null references public.bts_reward_programs(id) on delete cascade,
 card_code text not null unique default substring(replace(gen_random_uuid()::text,'-','') from 1 for 20)
    check(card_code ~ '^[a-f0-9]{20}$'),
 full_name text not null check(char_length(full_name) between 2 and 100),
 phone text not null default '' check(char_length(phone)<=25),
 email text not null default '' check(char_length(email)<=150),
 card_label text not null default 'Tarjeta 001' check(char_length(card_label) between 1 and 80),
 current_units integer not null default 0 check(current_units between 0 and 1000000),
 lifetime_units integer not null default 0 check(lifetime_units between 0 and 100000000),
 redeemed_count integer not null default 0 check(redeemed_count between 0 and 1000000),
 vip_tier text not null default 'Gold' check(char_length(vip_tier) between 1 and 40),
 expires_at date,
 is_active boolean not null default true,
 notes text not null default '' check(char_length(notes)<=400),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists bts_reward_members_program_idx on public.bts_reward_members(program_id,created_at desc);
alter table public.bts_reward_members enable row level security;
drop policy if exists bts_rewards_members_admin on public.bts_reward_members;
create policy bts_rewards_members_admin on public.bts_reward_members for all to authenticated
 using (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())))
 with check (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())));
revoke all on public.bts_reward_members from anon,authenticated;
grant select,insert,update,delete on public.bts_reward_members to authenticated;

create table if not exists public.bts_reward_movements (
 id bigint generated always as identity primary key,
 member_id uuid not null references public.bts_reward_members(id) on delete cascade,
 program_id uuid not null references public.bts_reward_programs(id) on delete cascade,
 action text not null check(action in ('earn','redeem','adjust')),
 delta integer not null,
 balance_after integer not null check(balance_after>=0),
 actor_id uuid,
 created_at timestamptz not null default now()
);
create index if not exists bts_reward_movements_member_idx on public.bts_reward_movements(member_id,created_at desc);
create index if not exists bts_reward_movements_program_idx on public.bts_reward_movements(program_id,created_at desc);
alter table public.bts_reward_movements enable row level security;
drop policy if exists bts_reward_movements_admin_select on public.bts_reward_movements;
create policy bts_reward_movements_admin_select on public.bts_reward_movements
 for select to authenticated using (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())));
drop policy if exists bts_reward_movements_admin_insert on public.bts_reward_movements;
create policy bts_reward_movements_admin_insert on public.bts_reward_movements
 for insert to authenticated with check (actor_id=(select auth.uid()) and exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())));
revoke all on public.bts_reward_movements from anon,authenticated;
grant select,insert on public.bts_reward_movements to authenticated;
grant usage on sequence public.bts_reward_movements_id_seq to authenticated;

-- No se pueden reemplazar tarjetas NFC sin cambiar físicamente la programación:
create or replace function public.bts_reward_card_code_guard()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.card_code is distinct from old.card_code or new.program_id is distinct from old.program_id then
   raise exception 'El código y el programa de una tarjeta física son permanentes';
 end if;
 new.updated_at=now();
 return new;
end;$$;
revoke all on function public.bts_reward_card_code_guard() from public,anon,authenticated;
drop trigger if exists bts_reward_member_guard on public.bts_reward_members;
create trigger bts_reward_member_guard before update on public.bts_reward_members
 for each row execute function public.bts_reward_card_code_guard();

create or replace function public.bts_reward_program_touch()
returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now();return new;end;$$;
revoke all on function public.bts_reward_program_touch() from public,anon,authenticated;
drop trigger if exists bts_reward_program_update on public.bts_reward_programs;
create trigger bts_reward_program_update before update on public.bts_reward_programs
 for each row execute function public.bts_reward_program_touch();

-- Operación atómica: dos empleados no pueden acreditar sobre el mismo saldo a la vez.
-- SECURITY INVOKER + RLS: solo administradores BTS autorizados.
create or replace function public.bts_reward_apply_event(
 p_member_id uuid,p_action text,p_units integer default 1
)
returns table(new_balance integer,total_redemptions integer,lifetime_total integer)
language plpgsql security invoker set search_path='' as $$
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
$$;
revoke all on function public.bts_reward_apply_event(uuid,text,integer) from public,anon;
grant execute on function public.bts_reward_apply_event(uuid,text,integer) to authenticated;

-- Solo la persona con un código aleatorio podrá consultar su estado público.
-- No expone el teléfono, email, notas ni listado de otros clientes.
create or replace function public.bts_reward_public_card(p_card_code text)
returns table (
 member_name text,card_label text,kind text,brand_name text,
 program_title text,program_description text,card_theme text,accent_color text,
 goal_units integer,unit_name text,reward_label text,
 current_units integer,lifetime_units integer,redeemed_count integer,
 vip_tier text,vip_benefits text,expires_at date,member_active boolean
)
language sql stable security definer set search_path='' as $$
 select m.full_name,m.card_label,p.kind,b.business_name,p.title,p.description,p.card_theme,p.accent_color,
        p.goal_units,p.unit_name,p.reward_label,m.current_units,m.lifetime_units,m.redeemed_count,
        m.vip_tier,p.vip_benefits,m.expires_at,m.is_active
 from public.bts_reward_members m
 join public.bts_reward_programs p on p.id=m.program_id
 join public.bts_nfc_cards b on b.id=p.business_id
 where p_card_code ~ '^[a-f0-9]{20}$'
   and m.card_code=p_card_code and p.is_active and b.is_active
 limit 1
$$;
revoke all on function public.bts_reward_public_card(text) from public;
grant execute on function public.bts_reward_public_card(text) to anon,authenticated;
