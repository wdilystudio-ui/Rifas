-- Correção para permitir apagar/reembolsar cliente pagante que já foi sorteado como ganhador.
-- Execute este arquivo no Supabase: SQL Editor > New query > Run.
-- Ele preserva o histórico do sorteio (winner_name, winner_phone, winning_number, created_at)
-- e remove apenas os vínculos diretos que impedem a exclusão da reserva/cliente/número.

begin;

alter table public.raffle_draws
  drop constraint if exists raffle_draws_reservation_id_fkey,
  drop constraint if exists raffle_draws_number_id_fkey,
  drop constraint if exists raffle_draws_customer_id_fkey;

alter table public.raffle_draws
  alter column reservation_id drop not null,
  alter column number_id drop not null,
  alter column customer_id drop not null;

alter table public.raffle_draws
  add constraint raffle_draws_reservation_id_fkey
    foreign key (reservation_id) references public.reservations(id) on delete set null,
  add constraint raffle_draws_number_id_fkey
    foreign key (number_id) references public.raffle_numbers(id) on delete set null,
  add constraint raffle_draws_customer_id_fkey
    foreign key (customer_id) references public.customers(id) on delete set null;

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

  update public.raffle_draws
  set reservation_id = null,
      number_id = null,
      customer_id = null
  where reservation_id in (
      select id
      from public.reservations
      where status = 'paid'
        and (
          (v_reservation.group_id is not null and group_id = v_reservation.group_id)
          or (v_reservation.group_id is null and id = v_reservation.id)
        )
    )
    or number_id = any(v_number_ids)
    or customer_id = v_reservation.customer_id;

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

grant execute on function public.refund_paid_reservation(uuid) to service_role;

commit;
