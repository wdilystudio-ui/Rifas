create extension if not exists "pgcrypto";

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('raffle_max_numbers', '100000')
on conflict (key) do nothing;

create or replace function public.get_raffle_max_numbers()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select least(greatest(coalesce((select value::integer from public.app_settings where key = 'raffle_max_numbers'), 100000), 100), 100000);
$$;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.raffle_numbers (
  id uuid primary key default gen_random_uuid(),
  number integer not null unique,
  status text not null default 'available' check (status in ('available', 'reserved', 'paid')),
  reserved_by uuid references public.customers(id) on delete set null,
  reserved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.reservation_groups (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  total numeric(10,2) not null default 0,
  status text not null default 'reserved' check (status in ('reserved', 'paid', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.reservation_groups(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  number_id uuid not null references public.raffle_numbers(id) on delete cascade,
  status text not null default 'reserved' check (status in ('reserved', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  unique(number_id)
);

create index if not exists idx_raffle_numbers_number on public.raffle_numbers(number);
create index if not exists idx_raffle_numbers_status on public.raffle_numbers(status);
create index if not exists idx_reservations_status on public.reservations(status);
create index if not exists idx_reservations_created_at on public.reservations(created_at);

insert into public.raffle_numbers (number)
select generate_series(1, 100000)
on conflict (number) do nothing;

create or replace function public.reserve_numbers(
  p_name text,
  p_phone text,
  p_numbers integer[],
  p_total numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_group_id uuid;
  v_item record;
  v_unavailable integer[];
  v_reserved integer[] := '{}';
  v_original_count integer;
  v_unique_count integer;
  v_missing integer[];
  v_safe_name text;
  v_safe_phone text;
  v_max_numbers integer;
begin
  v_max_numbers := public.get_raffle_max_numbers();
  v_safe_name := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_safe_name := regexp_replace(v_safe_name, '[<>{}`]', '', 'g');
  v_safe_phone := regexp_replace(trim(coalesce(p_phone, '')), '[^0-9+]', '', 'g');

  if length(v_safe_name) < 2 or length(v_safe_name) > 80 or v_safe_name !~ '^[A-Za-zÀ-ÿ'' .-]+$' then
    return jsonb_build_object('success', false, 'message', 'Nome inválido.');
  end if;

  if length(v_safe_phone) < 10 or length(v_safe_phone) > 15 or v_safe_phone !~ '^\+?[0-9]{10,15}$' then
    return jsonb_build_object('success', false, 'message', 'Telefone inválido.');
  end if;

  if p_numbers is null or array_length(p_numbers, 1) is null then
    return jsonb_build_object('success', false, 'message', 'Nenhum número selecionado.');
  end if;

  v_original_count := array_length(p_numbers, 1);

  if v_original_count > 100000 then
    return jsonb_build_object('success', false, 'message', 'Selecione no máximo 200 números por reserva.');
  end if;

  if exists (
    select 1
    from unnest(p_numbers) as selected_number
    where selected_number is null or selected_number < 1 or selected_number > v_max_numbers
  ) then
    return jsonb_build_object('success', false, 'message', 'Número não disponível nesta rifa.');
  end if;

  select count(distinct selected_number)
  into v_unique_count
  from unnest(p_numbers) as selected_number;

  if v_unique_count <> v_original_count then
    return jsonb_build_object('success', false, 'message', 'A seleção contém números duplicados.');
  end if;

  if p_total is null or p_total < 0 then
    return jsonb_build_object('success', false, 'message', 'Total inválido.');
  end if;

  select coalesce(array_agg(selected_number order by selected_number), '{}')
  into v_missing
  from unnest(p_numbers) as selected_number
  where not exists (
    select 1
    from public.raffle_numbers rn
    where rn.number = selected_number
  );

  if array_length(v_missing, 1) is not null then
    return jsonb_build_object('success', false, 'message', 'A seleção contém números inexistentes.', 'missing', v_missing);
  end if;

  select coalesce(array_agg(number order by number), '{}')
  into v_unavailable
  from public.raffle_numbers
  where number = any(p_numbers)
  and status <> 'available';

  if array_length(v_unavailable, 1) is not null then
    return jsonb_build_object(
      'success', false,
      'message', 'Alguns números não estão mais disponíveis.',
      'unavailable', v_unavailable
    );
  end if;

  insert into public.customers (name, phone)
  values (v_safe_name, v_safe_phone)
  returning id into v_customer_id;

  insert into public.reservation_groups (customer_id, total, status)
  values (v_customer_id, p_total, 'reserved')
  returning id into v_group_id;

  for v_item in
    select *
    from public.raffle_numbers
    where number = any(p_numbers)
    order by number
    for update
  loop
    if v_item.status <> 'available' then
      return jsonb_build_object(
        'success', false,
        'message', 'O número ' || v_item.number || ' acabou de ser reservado por outra pessoa.'
      );
    end if;

    update public.raffle_numbers
    set status = 'reserved', reserved_by = v_customer_id, reserved_at = now()
    where id = v_item.id;

    insert into public.reservations (group_id, customer_id, number_id, status)
    values (v_group_id, v_customer_id, v_item.id, 'reserved');

    v_reserved := array_append(v_reserved, v_item.number);
  end loop;

  return jsonb_build_object(
    'success', true,
    'message', 'Números reservados com sucesso.',
    'customer_id', v_customer_id,
    'group_id', v_group_id,
    'numbers', v_reserved
  );
end;
$$;

alter table public.app_settings enable row level security;
alter table public.customers enable row level security;
alter table public.raffle_numbers enable row level security;
alter table public.reservation_groups enable row level security;
alter table public.reservations enable row level security;

drop policy if exists "app settings no public access" on public.app_settings;
drop policy if exists "customers insert public" on public.customers;
drop policy if exists "customers no public access" on public.customers;
drop policy if exists "numbers select public" on public.raffle_numbers;
drop policy if exists "numbers update public" on public.raffle_numbers;
drop policy if exists "reservation groups insert public" on public.reservation_groups;
drop policy if exists "reservation groups no public access" on public.reservation_groups;
drop policy if exists "reservations select public" on public.reservations;
drop policy if exists "reservations insert public" on public.reservations;
drop policy if exists "reservations update public" on public.reservations;
drop policy if exists "reservations delete public" on public.reservations;
drop policy if exists "reservations no public access" on public.reservations;

create policy "app settings no public access"
on public.app_settings
for all
to anon, authenticated
using (false)
with check (false);

create policy "numbers select public"
on public.raffle_numbers
for select
to anon, authenticated
using (number <= public.get_raffle_max_numbers());

grant execute on function public.get_raffle_max_numbers() to anon, authenticated;
grant execute on function public.reserve_numbers(text, text, integer[], numeric) to anon, authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.raffle_numbers;
  exception when duplicate_object then
    null;
  end;
end $$;
