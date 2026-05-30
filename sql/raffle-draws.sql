create table if not exists public.raffle_draws (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  number_id uuid not null references public.raffle_numbers(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  winner_name text not null,
  winner_phone text,
  winning_number integer not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_raffle_draws_created_at
on public.raffle_draws(created_at desc);

create index if not exists idx_raffle_draws_winning_number
on public.raffle_draws(winning_number);

alter table public.raffle_draws enable row level security;

drop policy if exists "raffle draws no public access" on public.raffle_draws;

create policy "raffle draws no public access"
on public.raffle_draws
for all
to anon, authenticated
using (false)
with check (false);
