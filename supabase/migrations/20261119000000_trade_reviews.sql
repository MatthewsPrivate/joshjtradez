-- ---------------------------------------------------------------------------
-- Trade reviews: a student sends a journalled trade to Josh (or their teacher)
-- for feedback, and both sides talk about it in a thread under the trade.
--
--   trades.review_requested_at  set by the student ("Send to Josh")
--   trades.reviewed_at          set automatically when a reviewer replies
--   trade_reviews               the comment thread (reviewer + student)
--
-- Who can review: teachers of a course the student is actively enrolled in
-- (existing teaches_student rule) and the academy owner (Josh), who can see
-- any trade a student has chosen to share.
-- ---------------------------------------------------------------------------

alter table public.trades
  add column review_requested_at timestamptz,
  add column reviewed_at timestamptz;

create index trades_review_queue_idx on public.trades (review_requested_at)
  where review_requested_at is not null;

create function public.can_review_trades_of(student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select student <> auth.uid() and (public.has_role('owner') or public.teaches_student(student));
$$;

create policy trades_reviewer_read on public.trades for select to authenticated
  using (shared_with_teacher and public.can_review_trades_of(user_id));

-- A student can't mark their own trade as reviewed. Re-requesting a review
-- clears the previous "reviewed" marker so the trade re-enters the queue.
create function public.trades_guard_review()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and auth.uid() = old.user_id then
    if new.review_requested_at is distinct from old.review_requested_at then
      new.reviewed_at := null;
    else
      new.reviewed_at := old.reviewed_at;
    end if;
  end if;
  -- Asking for a review means sharing the trade.
  if new.review_requested_at is not null then
    new.shared_with_teacher := true;
  end if;
  return new;
end;
$$;
create trigger trades_guard_review before update on public.trades
  for each row execute function public.trades_guard_review();

create table public.trade_reviews (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now()
);
create index trade_reviews_trade_idx on public.trade_reviews (trade_id, created_at);
alter table public.trade_reviews enable row level security;

create policy trade_reviews_select on public.trade_reviews for select to authenticated using (
  exists (
    select 1 from public.trades t
    where t.id = trade_id
      and (t.user_id = auth.uid() or (t.shared_with_teacher and public.can_review_trades_of(t.user_id)))
  )
);
create policy trade_reviews_insert on public.trade_reviews for insert to authenticated with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.trades t
    where t.id = trade_id
      and (t.user_id = auth.uid() or (t.shared_with_teacher and public.can_review_trades_of(t.user_id)))
  )
);
create policy trade_reviews_delete on public.trade_reviews for delete to authenticated
  using (author_id = auth.uid());

-- On a new comment: a reviewer's reply marks the trade reviewed and notifies
-- the student; a student's reply puts the trade back in the review queue.
create function public.trade_reviews_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  t public.trades;
begin
  select * into t from public.trades where id = new.trade_id;
  if new.author_id = t.user_id then
    update public.trades set review_requested_at = now(), reviewed_at = null where id = t.id;
  else
    update public.trades set reviewed_at = now() where id = t.id;
    insert into public.notifications (user_id, kind, title, body, link)
    values (
      t.user_id, 'trade_review',
      'Feedback on your ' || t.instrument || ' trade',
      left(new.body, 160),
      '/academy/student/trading-journal/' || t.id
    );
  end if;
  return new;
end;
$$;
create trigger trade_reviews_after_insert after insert on public.trade_reviews
  for each row execute function public.trade_reviews_after_insert();

-- When a student asks for a review, notify everyone who can give one.
create function public.trades_notify_review_request()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.review_requested_at is not null
     and new.review_requested_at is distinct from old.review_requested_at
     and (old.review_requested_at is null or old.reviewed_at is not null) then
    insert into public.notifications (user_id, kind, title, body, link)
    select distinct r.user_id, 'trade_review_request',
      coalesce(nullif(p.display_name, ''), nullif(p.full_name, ''), 'A student') || ' sent a trade for review',
      new.instrument || ' · ' || upper(new.direction::text),
      '/academy/teacher/trade-reviews/' || new.id
    from public.user_roles r
    left join public.profiles p on p.id = new.user_id
    where r.user_id <> new.user_id
      and (
        r.role = 'owner'
        or (r.role = 'teacher' and exists (
          select 1 from public.enrolments e
          join public.course_teachers ct on ct.course_id = e.course_id
          where e.user_id = new.user_id and e.status = 'active' and ct.teacher_id = r.user_id
        ))
      );
  end if;
  return new;
end;
$$;
create trigger trades_notify_review_request after update of review_requested_at on public.trades
  for each row execute function public.trades_notify_review_request();
