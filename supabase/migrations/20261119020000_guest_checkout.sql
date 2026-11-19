-- ---------------------------------------------------------------------------
-- Guest checkout: buyers pay first (no account needed), then set a password.
--
--   orders.user_id is now optional until the buyer's account exists.
--   orders.customer_email   from the payment provider once the payment completes
--   orders.payment_reference provider's payment id (Stripe PaymentIntent), used for refunds
--   orders.paid_at / account_claimed_at  bookkeeping for the welcome page
--
-- Fulfilment helpers are service-role only (called by the webhook / server):
--   user_id_by_email(email)   find an existing account
--   grant_order(order)        give the order's courses to its user
--   revoke_order(order)       remove access granted by that order (full refund)
--   claim_orders_for(user)    attach paid guest orders whose email matches a
--                             CONFIRMED account email, then grant them
-- ---------------------------------------------------------------------------

alter table public.orders alter column user_id drop not null;
alter table public.orders
  add column customer_email text check (customer_email is null or char_length(customer_email) <= 320),
  add column payment_reference text,
  add column paid_at timestamptz,
  add column account_claimed_at timestamptz;
create index orders_guest_email_idx on public.orders (lower(customer_email)) where user_id is null;
create index orders_payment_ref_idx on public.orders (provider, payment_reference) where payment_reference is not null;

create function public.user_id_by_email(e text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(trim(e)) limit 1;
$$;

create function public.grant_order(o uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  insert into public.enrolments as e (user_id, course_id, status, source, order_id, granted_at)
  select ord.user_id, pc.course_id, 'active', 'purchase', ord.id, now()
  from public.orders ord
  join public.product_courses pc on pc.product_id = ord.product_id
  where ord.id = o and ord.user_id is not null and ord.status in ('paid', 'partially_refunded')
  on conflict (user_id, course_id) do update
    set status = 'active', source = 'purchase', order_id = excluded.order_id, revoked_at = null, granted_at = now()
    -- never take over an enrolment that's already active (e.g. a manual grant)
    where e.status <> 'active';
  get diagnostics n = row_count;
  return n;
end;
$$;

create function public.revoke_order(o uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  update public.enrolments set status = 'revoked', revoked_at = now()
  where order_id = o and status = 'active';
  get diagnostics n = row_count;
  return n;
end;
$$;

create function public.claim_orders_for(uid uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  claimed uuid[];
  oid uuid;
begin
  with u as (
    select id, email from auth.users where id = uid and email_confirmed_at is not null
  ), upd as (
    update public.orders ord set user_id = u.id, account_claimed_at = coalesce(ord.account_claimed_at, now())
    from u
    where ord.user_id is null
      and lower(ord.customer_email) = lower(u.email)
      and ord.status in ('paid', 'partially_refunded')
    returning ord.id
  )
  select coalesce(array_agg(id), '{}') into claimed from upd;
  foreach oid in array claimed loop
    perform public.grant_order(oid);
  end loop;
  return coalesce(array_length(claimed, 1), 0);
end;
$$;

revoke all on function public.user_id_by_email(text) from public, anon, authenticated;
revoke all on function public.grant_order(uuid) from public, anon, authenticated;
revoke all on function public.revoke_order(uuid) from public, anon, authenticated;
revoke all on function public.claim_orders_for(uuid) from public, anon, authenticated;
grant execute on function public.user_id_by_email(text) to service_role;
grant execute on function public.grant_order(uuid) to service_role;
grant execute on function public.revoke_order(uuid) to service_role;
grant execute on function public.claim_orders_for(uuid) to service_role;
