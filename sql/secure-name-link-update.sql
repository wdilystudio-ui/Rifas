-- Atualização incremental para vincular comprador aos números e proteger dados pessoais.
-- Este projeto já possui a estrutura correta:
-- customers.name / customers.phone armazenam os dados pessoais;
-- raffle_numbers.reserved_by vincula cada número diretamente ao comprador;
-- reservations.customer_id e reservations.number_id preservam o histórico do pedido.
-- Execute este SQL para garantir a função, índices e políticas compatíveis.

create extension if not exists "pgcrypto";

alter table public.raffle_numbers
  add column if not exists reserved_by uuid references public.customers(id) on delete set null,
  add column if not exists reserved_at timestamptz;

create index if not exists idx_raffle_numbers_reserved_by on public.raffle_numbers(reserved_by);
create index if not exists idx_reservations_customer_id on public.reservations(customer_id);
create index if not exists idx_reservations_number_id on public.reservations(number_id);

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
begin
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
    where selected_number is null or selected_number < 1 or selected_number > 100000
  ) then
    return jsonb_build_object('success', false, 'message', 'A seleção contém números inválidos.');
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
    set
      status = 'reserved',
      reserved_by = v_customer_id,
      reserved_at = now()
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

alter table public.customers enable row level security;
alter table public.raffle_numbers enable row level security;
alter table public.reservation_groups enable row level security;
alter table public.reservations enable row level security;

drop policy if exists "customers insert public" on public.customers;
drop policy if exists "customers no public access" on public.customers;
drop policy if exists "reservation groups insert public" on public.reservation_groups;
drop policy if exists "reservation groups no public access" on public.reservation_groups;
drop policy if exists "reservations select public" on public.reservations;
drop policy if exists "reservations insert public" on public.reservations;
drop policy if exists "reservations update public" on public.reservations;
drop policy if exists "reservations delete public" on public.reservations;
drop policy if exists "reservations no public access" on public.reservations;

-- Sem políticas públicas para customers, reservation_groups e reservations.
-- O público reserva apenas via função security definer reserve_numbers.

grant execute on function public.reserve_numbers(text, text, integer[], numeric) to anon, authenticated;
