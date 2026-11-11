-- JoshJTradez Academy — full platform schema
-- Catalogue extras, assessments, certificates, journals, trading journal,
-- toolkit library, community, messaging, notifications, announcements,
-- live classes, support, refunds, settings, storage buckets.
-- Same security model as the foundation migration: RLS everywhere; privileged
-- writes are server-only (service role) and audited.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('owner') or public.has_role('admin');
$$;

create function public.is_active_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active');
$$;

-- Supabase grants new objects to anon by default; nothing here is for anon
-- unless explicitly granted below.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;

-- ---------------------------------------------------------------------------
-- Catalogue extras
-- ---------------------------------------------------------------------------
alter table public.courses
  add column category text,
  add column is_featured boolean not null default false;

alter table public.lessons
  add column video_url text check (video_url is null or video_url ~ '^https://');

alter table public.profiles
  add column weekly_lesson_goal int not null default 5 check (weekly_lesson_goal between 1 and 50);
grant update (weekly_lesson_goal) on public.profiles to authenticated;

create table public.course_bookmarks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);
alter table public.course_bookmarks enable row level security;
create policy course_bookmarks_own on public.course_bookmarks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Names/avatars of active members, for community, messaging and rosters.
-- Runs with owner rights (bypasses profiles RLS) but exposes only safe columns.
create view public.member_directory as
select
  p.id,
  coalesce(nullif(p.display_name, ''), nullif(p.full_name, ''), 'Member') as name,
  p.avatar_path,
  p.headline,
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = p.id and ur.role in ('owner', 'admin', 'teacher')
  ) as is_staff
from public.profiles p
where p.status = 'active';
revoke all on public.member_directory from anon, public;
grant select on public.member_directory to authenticated;

-- ---------------------------------------------------------------------------
-- Commerce extras
-- ---------------------------------------------------------------------------
create type public.refund_status as enum ('requested', 'succeeded', 'failed');

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  amount_minor int not null check (amount_minor > 0),
  reason text not null default '',
  status public.refund_status not null default 'requested',
  provider_refund_reference text,
  requested_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.refunds enable row level security;
create policy refunds_select on public.refunds for select to authenticated
  using (public.has_permission('payments.read'));
create trigger refunds_touch before update on public.refunds
  for each row execute function public.touch_updated_at();

alter table public.products add column is_featured boolean not null default false;

-- Every order status change is written to the audit log automatically.
create function public.audit_order_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
    values (
      auth.uid(),
      'order.status_changed',
      'order',
      new.id::text,
      jsonb_build_object(
        'from', case when tg_op = 'INSERT' then null else old.status end,
        'to', new.status,
        'provider', new.provider,
        'provider_reference', new.provider_reference
      )
    );
  end if;
  return new;
end;
$$;
create trigger orders_audit_status after insert or update of status on public.orders
  for each row execute function public.audit_order_status();

-- ---------------------------------------------------------------------------
-- Notifications (written only via notify(), from triggers or the server)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  link text check (link is null or link like '/academy/%'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create function public.notify(recipient uuid, n_kind text, n_title text, n_body text, n_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, body, link)
  values (recipient, n_kind, left(n_title, 200), left(coalesce(n_body, ''), 500), n_link);
$$;
revoke all on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.notify(uuid, text, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Assessments: quizzes, exams, assignments
-- ---------------------------------------------------------------------------
create type public.assessment_kind as enum ('quiz', 'exam', 'assignment');
create type public.question_kind as enum ('single', 'multiple', 'written');
create type public.attempt_status as enum ('in_progress', 'submitted', 'graded');

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  module_id uuid references public.modules (id) on delete set null,
  lesson_id uuid references public.lessons (id) on delete set null,
  kind public.assessment_kind not null,
  title text not null,
  instructions text not null default '',
  pass_pct int not null default 70 check (pass_pct between 0 and 100),
  time_limit_minutes int check (time_limit_minutes is null or time_limit_minutes > 0),
  max_attempts int check (max_attempts is null or max_attempts > 0),
  due_at timestamptz,
  counts_toward_completion boolean not null default true,
  status public.content_status not null default 'draft',
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assessments_course_idx on public.assessments (course_id);
create trigger assessments_touch before update on public.assessments
  for each row execute function public.touch_updated_at();

create table public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  position int not null default 0,
  kind public.question_kind not null,
  prompt text not null,
  -- [{ "id": "a", "text": "..." }]; empty for written questions
  options jsonb not null default '[]'::jsonb,
  points int not null default 1 check (points > 0),
  created_at timestamptz not null default now()
);
create index assessment_questions_idx on public.assessment_questions (assessment_id, position);

-- Correct answers live apart from the questions so students can never select them.
create table public.assessment_answer_keys (
  question_id uuid primary key references public.assessment_questions (id) on delete cascade,
  correct jsonb not null default '[]'::jsonb
);

create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status public.attempt_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score_points numeric,
  max_points numeric,
  score_pct numeric,
  passed boolean,
  submission_text text,
  attachments jsonb not null default '[]'::jsonb,
  feedback text,
  graded_by uuid references auth.users (id),
  graded_at timestamptz
);
create index assessment_attempts_user_idx on public.assessment_attempts (user_id, assessment_id);
create index assessment_attempts_status_idx on public.assessment_attempts (assessment_id, status);

create table public.attempt_answers (
  attempt_id uuid not null references public.assessment_attempts (id) on delete cascade,
  question_id uuid not null references public.assessment_questions (id) on delete cascade,
  answer jsonb not null,
  awarded_points numeric,
  feedback text,
  primary key (attempt_id, question_id)
);

create function public.assessment_course(a uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select course_id from public.assessments where id = a;
$$;

create function public.can_manage_assessment(a uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.teaches_course(public.assessment_course(a))
    or public.has_permission('assessments.manage')
    or public.has_permission('courses.manage');
$$;

alter table public.assessments enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_answer_keys enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.attempt_answers enable row level security;

create policy assessments_select on public.assessments for select to authenticated using (
  public.can_manage_assessment(id)
  or (status = 'published' and public.is_enrolled(course_id))
);
create policy assessments_write on public.assessments for all to authenticated
  using (public.teaches_course(course_id) or public.has_permission('assessments.manage') or public.has_permission('courses.manage'))
  with check (public.teaches_course(course_id) or public.has_permission('assessments.manage') or public.has_permission('courses.manage'));

create policy questions_select on public.assessment_questions for select to authenticated
  using (exists (select 1 from public.assessments a where a.id = assessment_id));
create policy questions_write on public.assessment_questions for all to authenticated
  using (public.can_manage_assessment(assessment_id)) with check (public.can_manage_assessment(assessment_id));

create policy answer_keys_manage on public.assessment_answer_keys for all to authenticated using (
  public.can_manage_assessment((select q.assessment_id from public.assessment_questions q where q.id = question_id))
) with check (
  public.can_manage_assessment((select q.assessment_id from public.assessment_questions q where q.id = question_id))
);

create policy attempts_select on public.assessment_attempts for select to authenticated
  using (user_id = auth.uid() or public.can_manage_assessment(assessment_id));
create policy attempt_answers_select on public.attempt_answers for select to authenticated
  using (exists (select 1 from public.assessment_attempts t where t.id = attempt_id));

-- ---------------------------------------------------------------------------
-- Certificates
-- ---------------------------------------------------------------------------
create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  credential_id text not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete restrict,
  recipient_name text not null,
  course_title text not null,
  final_score_pct numeric,
  issued_at timestamptz not null default now(),
  issued_by uuid references auth.users (id),
  revoked_at timestamptz,
  revoked_reason text,
  unique (user_id, course_id)
);
alter table public.certificates enable row level security;
create policy certificates_select on public.certificates for select to authenticated using (
  user_id = auth.uid() or public.has_permission('students.read') or public.teaches_course(course_id)
);

-- Public credential lookup for the /verify page. Returns only what is printed on the certificate.
create function public.verify_certificate(cred text)
returns table (credential_id text, recipient_name text, course_title text, issued_at timestamptz, revoked boolean)
language sql stable security definer set search_path = '' as $$
  select c.credential_id, c.recipient_name, c.course_title, c.issued_at, c.revoked_at is not null
  from public.certificates c where c.credential_id = upper(trim(cred));
$$;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Learning journal
-- ---------------------------------------------------------------------------
create type public.journal_kind as enum ('note', 'takeaway', 'reflection', 'question', 'goal', 'resource');

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  lesson_id uuid references public.lessons (id) on delete set null,
  kind public.journal_kind not null default 'note',
  title text not null default 'Untitled note' check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 100000),
  tags text[] not null default '{}',
  resource_url text check (resource_url is null or resource_url ~ '^https?://'),
  attachments jsonb not null default '[]'::jsonb,
  is_pinned boolean not null default false,
  -- Private by default; the student opts in to sharing with their teachers.
  shared_with_teacher boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index journal_entries_user_idx on public.journal_entries (user_id, updated_at desc);
create trigger journal_entries_touch before update on public.journal_entries
  for each row execute function public.touch_updated_at();
alter table public.journal_entries enable row level security;
create policy journal_own on public.journal_entries for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy journal_shared_read on public.journal_entries for select to authenticated
  using (shared_with_teacher and public.teaches_student(user_id));

-- ---------------------------------------------------------------------------
-- Trading journal
-- ---------------------------------------------------------------------------
create type public.trade_direction as enum ('long', 'short');

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  instrument text not null check (char_length(instrument) between 1 and 40),
  market text not null default 'forex',
  direction public.trade_direction not null,
  entry_price numeric not null check (entry_price > 0),
  exit_price numeric check (exit_price is null or exit_price > 0),
  stop_loss numeric check (stop_loss is null or stop_loss > 0),
  take_profit numeric check (take_profit is null or take_profit > 0),
  position_size numeric check (position_size is null or position_size > 0),
  size_unit text not null default 'lots',
  account_currency char(3) not null default 'GBP',
  risk_pct numeric check (risk_pct is null or (risk_pct >= 0 and risk_pct <= 100)),
  pnl numeric,
  strategy text,
  session text,
  entry_at timestamptz not null default now(),
  exit_at timestamptz,
  emotional_state text,
  notes text not null default '',
  mistakes text[] not null default '{}',
  lessons_learned text not null default '',
  screenshots jsonb not null default '[]'::jsonb,
  shared_with_teacher boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  planned_rr numeric generated always as (
    case when stop_loss is not null and take_profit is not null and entry_price <> stop_loss
      then abs(take_profit - entry_price) / abs(entry_price - stop_loss) end
  ) stored,
  r_multiple numeric generated always as (
    case when stop_loss is not null and exit_price is not null and entry_price <> stop_loss
      then (case when direction = 'long' then exit_price - entry_price else entry_price - exit_price end)
           / abs(entry_price - stop_loss) end
  ) stored,
  check (exit_at is null or exit_at >= entry_at)
);
create index trades_user_idx on public.trades (user_id, entry_at desc);
create trigger trades_touch before update on public.trades
  for each row execute function public.touch_updated_at();
alter table public.trades enable row level security;
create policy trades_own on public.trades for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy trades_shared_read on public.trades for select to authenticated
  using (shared_with_teacher and public.teaches_student(user_id));

create table public.trade_journal_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  starting_balance numeric check (starting_balance is null or starting_balance >= 0),
  currency char(3) not null default 'GBP',
  strategies text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.trade_journal_settings enable row level security;
create policy trade_settings_own on public.trade_journal_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Toolkit knowledge library (editable by staff)
-- ---------------------------------------------------------------------------
create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in (
    'glossary', 'candlesticks', 'chart_patterns', 'market_structure', 'psychology', 'templates', 'checklists'
  )),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  summary text not null default '',
  body text not null default '',
  position int not null default 0,
  status public.content_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section, slug)
);
create trigger library_items_touch before update on public.library_items
  for each row execute function public.touch_updated_at();
alter table public.library_items enable row level security;
create policy library_select on public.library_items for select to authenticated
  using (status = 'published' or public.has_permission('courses.manage') or public.has_role('teacher'));
create policy library_write on public.library_items for all to authenticated
  using (public.has_permission('courses.manage') or public.has_role('teacher'))
  with check (public.has_permission('courses.manage') or public.has_role('teacher'));

-- ---------------------------------------------------------------------------
-- Community
-- ---------------------------------------------------------------------------
create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null default 'General' check (char_length(category) <= 60),
  title text not null check (char_length(title) between 3 and 200),
  body text not null check (char_length(body) between 1 and 20000),
  course_id uuid references public.courses (id) on delete set null,
  lesson_id uuid references public.lessons (id) on delete set null,
  is_pinned boolean not null default false,
  is_locked boolean not null default false,
  is_hidden boolean not null default false,
  moderated_by uuid references auth.users (id),
  moderated_at timestamptz,
  reply_count int not null default 0,
  vote_count int not null default 0,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index community_posts_activity_idx on public.community_posts (is_pinned desc, last_activity_at desc);
create index community_posts_lesson_idx on public.community_posts (lesson_id);
create trigger community_posts_touch before update on public.community_posts
  for each row execute function public.touch_updated_at();

create table public.community_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 10000),
  is_answer boolean not null default false,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index community_replies_post_idx on public.community_replies (post_id, created_at);
create trigger community_replies_touch before update on public.community_replies
  for each row execute function public.touch_updated_at();

create table public.community_votes (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (post_id, user_id)
);
create table public.community_bookmarks (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.community_posts (id) on delete cascade,
  reply_id uuid references public.community_replies (id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 1000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references auth.users (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check ((post_id is null) <> (reply_id is null))
);

create function public.community_post_visible(p uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.community_posts cp
    where cp.id = p and (not cp.is_hidden or cp.author_id = auth.uid() or public.has_permission('community.moderate'))
  );
$$;

alter table public.community_posts enable row level security;
alter table public.community_replies enable row level security;
alter table public.community_votes enable row level security;
alter table public.community_bookmarks enable row level security;
alter table public.community_reports enable row level security;

create policy posts_select on public.community_posts for select to authenticated using (
  public.is_active_member()
  and (not is_hidden or author_id = auth.uid() or public.has_permission('community.moderate'))
);
create policy posts_insert on public.community_posts for insert to authenticated with check (
  author_id = auth.uid() and public.is_active_member()
  and (lesson_id is null or exists (select 1 from public.lessons l where l.id = lesson_id))
);
create policy posts_update on public.community_posts for update to authenticated
  using (author_id = auth.uid() and not is_locked) with check (author_id = auth.uid());
create policy posts_delete on public.community_posts for delete to authenticated
  using (author_id = auth.uid() or public.has_permission('community.moderate'));
-- Authors can only set content; pin/lock/hide/counters are server- or trigger-managed.
revoke insert, update on public.community_posts from authenticated;
grant insert (category, title, body, course_id, lesson_id) on public.community_posts to authenticated;
grant update (category, title, body) on public.community_posts to authenticated;

create policy replies_select on public.community_replies for select to authenticated using (
  public.community_post_visible(post_id)
  and (not is_hidden or author_id = auth.uid() or public.has_permission('community.moderate'))
);
create policy replies_insert on public.community_replies for insert to authenticated with check (
  author_id = auth.uid() and public.is_active_member()
  and exists (select 1 from public.community_posts p where p.id = post_id and not p.is_locked and not p.is_hidden)
);
create policy replies_update on public.community_replies for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy replies_delete on public.community_replies for delete to authenticated
  using (author_id = auth.uid() or public.has_permission('community.moderate'));
revoke insert, update on public.community_replies from authenticated;
grant insert (post_id, body) on public.community_replies to authenticated;
grant update (body) on public.community_replies to authenticated;

create policy votes_own on public.community_votes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.community_post_visible(post_id));
create policy bookmarks_own on public.community_bookmarks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.community_post_visible(post_id));

create policy reports_insert on public.community_reports for insert to authenticated
  with check (reporter_id = auth.uid());
create policy reports_select on public.community_reports for select to authenticated
  using (reporter_id = auth.uid() or public.has_permission('community.moderate'));

-- Counters + reply notifications
create function public.community_reply_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  p public.community_posts;
begin
  if tg_op = 'INSERT' then
    update public.community_posts
      set reply_count = reply_count + 1, last_activity_at = now()
      where id = new.post_id returning * into p;
    if p.author_id <> new.author_id then
      perform public.notify(p.author_id, 'community.reply', 'New reply to your post', p.title,
        '/academy/student/community/' || p.id);
    end if;
  elsif tg_op = 'DELETE' then
    update public.community_posts set reply_count = greatest(reply_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;
create trigger community_reply_changed after insert or delete on public.community_replies
  for each row execute function public.community_reply_changed();

create function public.community_vote_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.community_posts
    set vote_count = (select count(*) from public.community_votes v where v.post_id = coalesce(new.post_id, old.post_id))
    where id = coalesce(new.post_id, old.post_id);
  return null;
end;
$$;
create trigger community_vote_changed after insert or delete on public.community_votes
  for each row execute function public.community_vote_changed();

-- ---------------------------------------------------------------------------
-- Messaging (conversations are created server-side, which enforces who may
-- message whom; members read and post through RLS)
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  subject text not null default '' check (char_length(subject) <= 200),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create function public.is_conversation_member(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversation_members m where m.conversation_id = c and m.user_id = auth.uid());
$$;

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
create policy conversations_select on public.conversations for select to authenticated
  using (public.is_conversation_member(id));
create policy members_select on public.conversation_members for select to authenticated
  using (public.is_conversation_member(conversation_id));
create policy members_update_own on public.conversation_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.conversation_members from authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;
create policy messages_select on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id) and public.is_active_member());
revoke insert on public.messages from authenticated;
grant insert (conversation_id, body) on public.messages to authenticated;

create function public.message_posted()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  m record;
  sender_name text;
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.conversation_members set last_read_at = new.created_at
    where conversation_id = new.conversation_id and user_id = new.sender_id;
  select name into sender_name from public.member_directory where id = new.sender_id;
  for m in select user_id from public.conversation_members
           where conversation_id = new.conversation_id and user_id <> new.sender_id loop
    perform public.notify(m.user_id, 'message', 'New message from ' || coalesce(sender_name, 'a member'),
      left(new.body, 140), '/academy/messages/' || new.conversation_id);
  end loop;
  return null;
end;
$$;
create trigger message_posted after insert on public.messages
  for each row execute function public.message_posted();

-- ---------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------
create type public.announcement_audience as enum ('everyone', 'students', 'staff', 'course');

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '',
  audience public.announcement_audience not null default 'everyone',
  course_id uuid references public.courses (id) on delete cascade,
  author_id uuid default auth.uid() references auth.users (id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  check ((audience = 'course') = (course_id is not null))
);
alter table public.announcements enable row level security;
create policy announcements_select on public.announcements for select to authenticated using (
  public.has_permission('announcements.manage')
  or author_id = auth.uid()
  or (
    published_at is not null and published_at <= now() and (
      audience = 'everyone'
      or (audience = 'students' and public.has_role('student'))
      or (audience = 'staff' and (public.is_staff() or public.has_role('teacher')))
      or (audience = 'course' and (public.is_enrolled(course_id) or public.teaches_course(course_id)))
    )
  )
);
create policy announcements_write on public.announcements for all to authenticated using (
  public.has_permission('announcements.manage') or (audience = 'course' and public.teaches_course(course_id))
) with check (
  public.has_permission('announcements.manage') or (audience = 'course' and public.teaches_course(course_id))
);

-- ---------------------------------------------------------------------------
-- Live classes & attendance
-- ---------------------------------------------------------------------------
create type public.live_class_status as enum ('scheduled', 'live', 'completed', 'cancelled');

create table public.live_classes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  -- null = open to every student; otherwise enrolled students of that course
  course_id uuid references public.courses (id) on delete cascade,
  host_id uuid not null references auth.users (id),
  starts_at timestamptz not null,
  duration_minutes int not null default 60 check (duration_minutes between 5 and 600),
  join_url text check (join_url is null or join_url ~ '^https://'),
  recording_url text check (recording_url is null or recording_url ~ '^https://'),
  status public.live_class_status not null default 'scheduled',
  capacity int check (capacity is null or capacity > 0),
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index live_classes_start_idx on public.live_classes (starts_at);
create trigger live_classes_touch before update on public.live_classes
  for each row execute function public.touch_updated_at();

create table public.live_class_attendance (
  class_id uuid not null references public.live_classes (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'registered' check (status in ('registered', 'attended', 'absent', 'excused')),
  joined_at timestamptz,
  marked_by uuid references auth.users (id),
  primary key (class_id, user_id)
);

create function public.can_manage_live_class(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_permission('live_classes.manage')
    or exists (select 1 from public.live_classes lc where lc.id = c and lc.host_id = auth.uid());
$$;

alter table public.live_classes enable row level security;
alter table public.live_class_attendance enable row level security;
create policy live_classes_select on public.live_classes for select to authenticated using (
  public.has_permission('live_classes.manage')
  or host_id = auth.uid()
  or public.has_role('teacher')
  or (course_id is null and public.has_role('student'))
  or (course_id is not null and public.is_enrolled(course_id))
);
create policy live_classes_write on public.live_classes for all to authenticated using (
  public.has_permission('live_classes.manage') or (host_id = auth.uid() and public.has_role('teacher'))
) with check (
  public.has_permission('live_classes.manage')
  or (host_id = auth.uid() and public.has_role('teacher') and (course_id is null or public.teaches_course(course_id)))
);

create policy attendance_select on public.live_class_attendance for select to authenticated
  using (user_id = auth.uid() or public.can_manage_live_class(class_id));
create policy attendance_register on public.live_class_attendance for insert to authenticated with check (
  user_id = auth.uid() and status = 'registered'
  and exists (select 1 from public.live_classes lc where lc.id = class_id and lc.status in ('scheduled', 'live'))
);
create policy attendance_unregister on public.live_class_attendance for delete to authenticated
  using (user_id = auth.uid() and status = 'registered');
create policy attendance_mark on public.live_class_attendance for update to authenticated
  using (public.can_manage_live_class(class_id)) with check (public.can_manage_live_class(class_id));

-- ---------------------------------------------------------------------------
-- Support tickets
-- ---------------------------------------------------------------------------
create type public.ticket_status as enum ('open', 'pending', 'resolved', 'closed');

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('SUP-' || upper(substr(md5(gen_random_uuid()::text), 1, 6))),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 200),
  category text not null default 'General',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status public.ticket_status not null default 'open',
  assigned_to uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);
create index support_tickets_status_idx on public.support_tickets (status, last_activity_at desc);
create trigger support_tickets_touch before update on public.support_tickets
  for each row execute function public.touch_updated_at();

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 10000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
create policy tickets_select on public.support_tickets for select to authenticated
  using (user_id = auth.uid() or public.has_permission('support.manage'));
create policy tickets_insert on public.support_tickets for insert to authenticated
  with check (user_id = auth.uid());
revoke insert, update on public.support_tickets from authenticated;
grant insert (subject, category, priority) on public.support_tickets to authenticated;

create policy support_messages_select on public.support_messages for select to authenticated using (
  public.has_permission('support.manage')
  or (not is_internal and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()))
);
create policy support_messages_insert on public.support_messages for insert to authenticated with check (
  author_id = auth.uid() and (
    public.has_permission('support.manage')
    or (not is_internal and exists (
      select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid() and t.status <> 'closed'
    ))
  )
);
revoke insert on public.support_messages from authenticated;
grant insert (ticket_id, body, is_internal) on public.support_messages to authenticated;

create function public.support_message_posted()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  t public.support_tickets;
begin
  update public.support_tickets
    set last_activity_at = now(),
        status = case
          when new.is_internal then status
          when new.author_id = user_id and status in ('pending', 'resolved') then 'open'
          when new.author_id <> user_id and status = 'open' then 'pending'
          else status end
    where id = new.ticket_id returning * into t;
  if not new.is_internal and new.author_id <> t.user_id then
    perform public.notify(t.user_id, 'support.reply', 'Support replied: ' || t.subject, left(new.body, 140),
      '/academy/student/support/' || t.id);
  end if;
  return null;
end;
$$;
create trigger support_message_posted after insert on public.support_messages
  for each row execute function public.support_message_posted();

-- ---------------------------------------------------------------------------
-- Platform settings (non-secret configuration only — credentials live in env vars)
-- ---------------------------------------------------------------------------
create table public.platform_settings (
  key text primary key check (key ~ '^[a-z0-9_.]+$'),
  value jsonb not null,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
create policy settings_select on public.platform_settings for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Storage buckets
--   course-covers  public  <course_id>/<file>        course managers write
--   avatars        public  <user_id>/<file>          owner writes
--   user-files     private <user_id>/<area>/<file>   owner reads/writes; server signs for teachers
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('course-covers', 'course-covers', true),
  ('avatars', 'avatars', true),
  ('user-files', 'user-files', false)
on conflict (id) do nothing;

create policy course_covers_manage on storage.objects for all to authenticated using (
  bucket_id = 'course-covers' and public.can_manage_course(nullif((storage.foldername(name))[1], '')::uuid)
) with check (
  bucket_id = 'course-covers' and public.can_manage_course(nullif((storage.foldername(name))[1], '')::uuid)
);
create policy avatars_own on storage.objects for all to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy user_files_own on storage.objects for all to authenticated using (
  bucket_id = 'user-files' and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'user-files' and (storage.foldername(name))[1] = auth.uid()::text
);
