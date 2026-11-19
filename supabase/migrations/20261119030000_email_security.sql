-- ---------------------------------------------------------------------------
-- Email verification codes. After a guest pays, we email a 6-digit code to the
-- address they gave Stripe; they must enter it before choosing a password, so
-- only the owner of that inbox can create the account.
--
-- Codes are stored hashed, expire after 10 minutes, allow 5 wrong attempts and
-- are single use. Service role only (RLS on, no policies).
-- Run after 20261119020000_guest_checkout.sql.
-- ---------------------------------------------------------------------------

create table public.email_codes (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('purchase_claim')),
  order_id uuid references public.orders (id) on delete cascade,
  email text not null,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index email_codes_order_idx on public.email_codes (order_id, created_at desc);
alter table public.email_codes enable row level security;
