-- BTS Studio ERP · módulo central aditivo · 2026-11-11
-- No elimina ni modifica información NFC existente.
create schema if not exists bts_private;

create table if not exists public.bts_erp_clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null check (char_length(trim(business_name)) between 2 and 120),
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  client_type text not null default 'empresa' check (client_type in ('empresa','individuo','institucion')),
  status text not null default 'prospecto' check (status in ('prospecto','activo','pausado','archivado')),
  nfc_company_id uuid unique references public.bts_nfc_cards(id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bts_erp_services (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.bts_erp_clients(id) on delete restrict,
  service_type text not null check(service_type in ('nfc','corporativo','vip','fidelizacion','educativo','web','video','diseno','otro')),
  name text not null check(char_length(trim(name)) between 2 and 120),
  status text not null default 'preparacion' check(status in ('preparacion','activo','pausado','finalizado')),
  billing_cycle text not null default 'ninguno' check(billing_cycle in ('ninguno','mensual','anual')),
  recurring_fee numeric(12,2) not null default 0 check(recurring_fee >= 0),
  setup_fee numeric(12,2) not null default 0 check(setup_fee >= 0),
  currency text not null default 'USD' check(currency in ('USD','NIO')),
  next_renewal date,
  nfc_company_id uuid references public.bts_nfc_cards(id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bts_erp_service_renewal_consistency check (billing_cycle <> 'ninguno' or next_renewal is null)
);

create table if not exists public.bts_erp_transactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.bts_erp_clients(id) on delete restrict,
  service_id uuid references public.bts_erp_services(id) on delete set null,
  entry_type text not null check(entry_type in ('ingreso','gasto')),
  concept text not null check(char_length(trim(concept)) between 2 and 150),
  amount numeric(12,2) not null check(amount > 0),
  currency text not null default 'USD' check(currency in ('USD','NIO')),
  status text not null default 'pendiente' check(status in ('pendiente','pagado','cancelado')),
  due_on date,
  paid_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bts_erp_cards (
  id uuid primary key default gen_random_uuid(),
  serial text not null unique check(char_length(trim(serial)) between 3 and 100),
  client_id uuid references public.bts_erp_clients(id) on delete set null,
  service_id uuid references public.bts_erp_services(id) on delete set null,
  status text not null default 'inventario' check(status in ('inventario','asignada','suspendida','danada')),
  linked_url text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bts_erp_card_assigned_client check (status <> 'asignada' or client_id is not null)
);

create table if not exists public.bts_erp_tickets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.bts_erp_clients(id) on delete restrict,
  service_id uuid references public.bts_erp_services(id) on delete set null,
  subject text not null check(char_length(trim(subject)) between 2 and 150),
  details text not null default '',
  priority text not null default 'normal' check(priority in ('baja','normal','alta','critica')),
  status text not null default 'abierto' check(status in ('abierto','en_proceso','resuelto','cerrado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bts_erp_audit (
  id bigint generated always as identity primary key,
  actor_id uuid,
  table_name text not null,
  record_id uuid not null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists bts_erp_services_client_idx on public.bts_erp_services(client_id,status);
create index if not exists bts_erp_services_renewal_idx on public.bts_erp_services(next_renewal) where status='activo';
create index if not exists bts_erp_transactions_client_idx on public.bts_erp_transactions(client_id,created_at desc);
create index if not exists bts_erp_transactions_status_idx on public.bts_erp_transactions(status,due_on);
create index if not exists bts_erp_cards_client_idx on public.bts_erp_cards(client_id,status);
create index if not exists bts_erp_tickets_client_idx on public.bts_erp_tickets(client_id,status);
create index if not exists bts_erp_audit_time_idx on public.bts_erp_audit(occurred_at desc);

-- Por ahora solo los tres administradores BTS: no exponemos información entre negocios.
alter table public.bts_erp_clients enable row level security;
alter table public.bts_erp_services enable row level security;
alter table public.bts_erp_transactions enable row level security;
alter table public.bts_erp_cards enable row level security;
alter table public.bts_erp_tickets enable row level security;
alter table public.bts_erp_audit enable row level security;

create policy bts_erp_clients_admin on public.bts_erp_clients for all to authenticated
  using (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())))
  with check (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())));
create policy bts_erp_services_admin on public.bts_erp_services for all to authenticated
  using (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())))
  with check (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())));
create policy bts_erp_transactions_admin on public.bts_erp_transactions for all to authenticated
  using (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())))
  with check (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())));
create policy bts_erp_cards_admin on public.bts_erp_cards for all to authenticated
  using (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())))
  with check (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())));
create policy bts_erp_tickets_admin on public.bts_erp_tickets for all to authenticated
  using (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())))
  with check (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())));
create policy bts_erp_audit_admin on public.bts_erp_audit for select to authenticated
  using (exists(select 1 from public.bts_admins a where a.user_id=(select auth.uid())));

revoke all on public.bts_erp_clients,public.bts_erp_services,public.bts_erp_transactions,public.bts_erp_cards,public.bts_erp_tickets,public.bts_erp_audit from anon,authenticated;
grant select,insert,update,delete on public.bts_erp_clients,public.bts_erp_services,public.bts_erp_transactions,public.bts_erp_cards,public.bts_erp_tickets to authenticated;
grant select on public.bts_erp_audit to authenticated;

create or replace function bts_private.erp_maintain()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op = 'UPDATE' then new.updated_at = now(); end if;
  insert into public.bts_erp_audit(actor_id,table_name,record_id,action,before_data,after_data)
  values (
    auth.uid(),tg_table_name,
    case when tg_op='DELETE' then old.id else new.id end,
    tg_op,
    case when tg_op='INSERT' then null else to_jsonb(old) end,
    case when tg_op='DELETE' then null else to_jsonb(new) end
  );
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function bts_private.erp_maintain() from public,anon,authenticated;

create trigger bts_erp_clients_audit before insert or update or delete on public.bts_erp_clients for each row execute function bts_private.erp_maintain();
create trigger bts_erp_services_audit before insert or update or delete on public.bts_erp_services for each row execute function bts_private.erp_maintain();
create trigger bts_erp_transactions_audit before insert or update or delete on public.bts_erp_transactions for each row execute function bts_private.erp_maintain();
create trigger bts_erp_cards_audit before insert or update or delete on public.bts_erp_cards for each row execute function bts_private.erp_maintain();
create trigger bts_erp_tickets_audit before insert or update or delete on public.bts_erp_tickets for each row execute function bts_private.erp_maintain();
