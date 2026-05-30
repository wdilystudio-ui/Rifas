-- Configurações administrativas: valor por número, imagem do prêmio e reembolso seguro.
-- Rode este arquivo no SQL Editor do Supabase depois do sql/supabase.sql base.

insert into public.app_settings (key, value)
values
  ('ticket_price', '0.49'),
  ('prize_image_url', ''),
  ('prize_image_path', '')
on conflict (key) do nothing;

create or replace function public.get_ticket_price()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select greatest(coalesce((select value::numeric from public.app_settings where key = 'ticket_price'), 0.49), 0.01);
$$;

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
  v_ticket_price numeric;
  v_expected_total numeric;
begin
  v_max_numbers := public.get_raffle_max_numbers();
  v_ticket_price := public.get_ticket_price();
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

  if v_original_count > 200 then
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

  v_expected_total := round((v_original_count * v_ticket_price)::numeric, 2);

  if p_total is null or round(p_total::numeric, 2) <> v_expected_total then
    return jsonb_build_object('success', false, 'message', 'Total inválido. Atualize a página e tente novamente.');
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
  values (v_customer_id, v_expected_total, 'reserved')
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
    'numbers', v_reserved,
    'total', v_expected_total
  );
end;
$$;

create or replace function public.refund_paid_reservation(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.reservations%rowtype;
  v_number_ids uuid[];
  v_customer_has_other_reservations boolean;
begin
  select *
  into v_reservation
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Reserva não encontrada.');
  end if;

  if v_reservation.status <> 'paid' then
    return jsonb_build_object('success', false, 'message', 'Apenas clientes pagantes podem ser apagados por reembolso.');
  end if;

  perform 1
  from public.reservations
  where status = 'paid'
    and (
      (v_reservation.group_id is not null and group_id = v_reservation.group_id)
      or (v_reservation.group_id is null and id = v_reservation.id)
    )
  for update;

  select coalesce(array_agg(number_id), '{}')
  into v_number_ids
  from public.reservations
  where status = 'paid'
    and (
      (v_reservation.group_id is not null and group_id = v_reservation.group_id)
      or (v_reservation.group_id is null and id = v_reservation.id)
    );

  update public.raffle_numbers
  set status = 'available', reserved_by = null, reserved_at = null
  where id = any(v_number_ids);

  delete from public.reservations
  where status = 'paid'
    and (
      (v_reservation.group_id is not null and group_id = v_reservation.group_id)
      or (v_reservation.group_id is null and id = v_reservation.id)
    );

  if v_reservation.group_id is not null then
    delete from public.reservation_groups where id = v_reservation.group_id;
  end if;

  select exists(
    select 1 from public.reservations where customer_id = v_reservation.customer_id
  ) into v_customer_has_other_reservations;

  if not v_customer_has_other_reservations then
    delete from public.customers where id = v_reservation.customer_id;
  end if;

  return jsonb_build_object('success', true, 'released_numbers', coalesce(array_length(v_number_ids, 1), 0));
end;
$$;

grant execute on function public.get_ticket_price() to anon, authenticated;
grant execute on function public.refund_paid_reservation(uuid) to service_role;

-- Bucket público para leitura da imagem do prêmio. O upload continua sendo feito pelo backend com SERVICE_ROLE_KEY.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'raffle-prizes',
  'raffle-prizes',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Public read raffle prize images" on storage.objects;

create policy "Public read raffle prize images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'raffle-prizes');
