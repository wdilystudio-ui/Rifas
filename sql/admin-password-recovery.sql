-- Segurança do painel administrativo
-- Execute este arquivo no SQL Editor do Supabase antes de usar recuperação de senha.
-- Depois, acesse /admin com a senha temporária antiga e altere a senha pelo painel,
-- ou gere um hash bcrypt e insira em admin_users.password_hash.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  is_active boolean not null default true,
  password_changed_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_users_email_lowercase check (email = lower(email)),
  constraint admin_users_password_hash_not_plain check (password_hash <> '' and length(password_hash) >= 50)
);

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.admin_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  request_ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint password_reset_tokens_hash_length check (length(token_hash) = 64)
);

create index if not exists password_reset_tokens_admin_user_idx on public.password_reset_tokens(admin_user_id);
create index if not exists password_reset_tokens_expires_idx on public.password_reset_tokens(expires_at);
create index if not exists password_reset_tokens_unused_idx on public.password_reset_tokens(token_hash) where used_at is null;

alter table public.admin_users enable row level security;
alter table public.password_reset_tokens enable row level security;

-- Sem políticas públicas: somente a SERVICE_ROLE_KEY usada nas API routes do servidor deve acessar essas tabelas.
revoke all on public.admin_users from anon, authenticated;
revoke all on public.password_reset_tokens from anon, authenticated;

-- Limpeza opcional de tokens antigos. Pode ser executada periodicamente.
delete from public.password_reset_tokens
where used_at is not null
   or expires_at < now() - interval '1 day';
