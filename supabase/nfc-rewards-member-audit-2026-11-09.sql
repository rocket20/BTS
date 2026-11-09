-- Historial de emisión, reasignación y renovación de clientes VIP/fidelización.
create table if not exists public.bts_reward_member_audit (
 id bigint generated always as identity primary key,
 member_id uuid not null,
 program_id uuid not null,
 operation text not null check(operation in ('INSERT','UPDATE','DELETE')),
 old_data jsonb,
 new_data jsonb,
 actor_id uuid,
 occurred_at timestamptz not null default now()
);
create index if not exists bts_reward_member_audit_program_idx on public.bts_reward_member_audit(program_id,occurred_at desc);
alter table public.bts_reward_member_audit enable row level security;
drop policy if exists bts_reward_member_audit_admin on public.bts_reward_member_audit;
create policy bts_reward_member_audit_admin on public.bts_reward_member_audit
 for select to authenticated
 using (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())));
revoke all on public.bts_reward_member_audit from anon,authenticated;
grant select on public.bts_reward_member_audit to authenticated;

create schema if not exists bts_private;
create or replace function bts_private.reward_member_log()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_op='DELETE' then
  insert into public.bts_reward_member_audit(member_id,program_id,operation,old_data,actor_id)
  values(old.id,old.program_id,tg_op,to_jsonb(old),auth.uid());
  return old;
 end if;
 insert into public.bts_reward_member_audit(member_id,program_id,operation,old_data,new_data,actor_id)
 values(new.id,new.program_id,tg_op,
 case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new),auth.uid());
 return new;
end;
$$;
revoke all on function bts_private.reward_member_log() from public,anon,authenticated;
drop trigger if exists bts_reward_member_audit_trigger on public.bts_reward_members;
create trigger bts_reward_member_audit_trigger
 after insert or update or delete on public.bts_reward_members
 for each row execute function bts_private.reward_member_log();
