-- JoshJTradez Academy — milestone 1 foundation
-- Identity, roles, permissions, course structure, enrolment, progress, payments, audit.
--
-- Security model:
--   * Every table has RLS enabled. The browser only ever holds the anon key + the
--     user's session, so these policies ARE the access control.
--   * Privileged writes (roles, enrolments, orders, payment events, audit) have no
--     client write policy at all — they happen in server endpoints with the
--     service-role key, which bypasses RLS, and are audited there.
--   * Helper functions are SECURITY DEFINER with an empty search_path so policies
--     can check roles without recursing through RLS.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('owner', 'admin', 'teacher', 'student');
create type public.account_status as enum ('active', 'suspended');
create type public.content_status as enum ('draft', 'published', 'archived');
create type public.enrolment_status as enum ('active', 'revoked', 'expired');
create type public.enrolment_source as enum ('purchase', 'manual', 'grant');
create type public.order_status as enum (
  'pending', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded'
);
create type public.resource_kind as enum ('pdf', 'image', 'video', 'file', 'link');

-- Granular staff permissions. Owners implicitly hold all of them; admins hold
-- only what has been granted. Keep in sync with src/lib/academy/roles.ts.
create type public.staff_permission as enum (
  'students.read', 'students.manage',
  'teachers.manage',
  'courses.manage',
  'enrolments.manage',
  'payments.read', 'payments.refund',
  'assessments.manage',
  'live_classes.manage',
  'community.moderate',
  'support.manage',
  'announcements.manage',
  'roles.manage',
  'reports.read',
  'audit.read'
);

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  display_name text,
  avatar_path text,
  headline text,
  status public.account_status not null default 'active',
  suspended_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users (id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.staff_permissions (
  user_id uuid not null references auth.users (id) on delete cascade,
  permission public.staff_permission not null,
  granted_by uuid references auth.users (id),
  granted_at timestamptz not null default now(),
  primary key (user_id, permission)
);

-- ---------------------------------------------------------------------------
-- Course structure: course -> module -> lesson -> resource
-- ---------------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  summary text not null default '',
  description text not null default '',
  level text,
  cover_path text,
  status public.content_status not null default 'draft',
  -- Configurable completion requirements, evaluated when issuing certificates.
  -- lessons_pct: % of published lessons completed; min_assessment_pct: null = no assessment gate.
  completion_rule jsonb not null default '{"lessons_pct": 100, "min_assessment_pct": null}'::jsonb,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.course_teachers (
  course_id uuid not null references public.courses (id) on delete cascade,
  teacher_id uuid not null references auth.users (id) on delete cascade,
  is_lead boolean not null default false,
  primary key (course_id, teacher_id)
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  summary text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index modules_course_idx on public.modules (course_id, position);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  -- Denormalised so RLS and progress queries avoid a join through modules.
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  summary text not null default '',
  body jsonb not null default '{}'::jsonb,
  video_path text,
  duration_seconds int check (duration_seconds is null or duration_seconds >= 0),
  position int not null default 0,
  is_preview boolean not null default false,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lessons_module_idx on public.lessons (module_id, position);
create index lessons_course_idx on public.lessons (course_id);

create table public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  title text not null,
  kind public.resource_kind not null,
  storage_path text,
  url text,
  size_bytes bigint,
  position int not null default 0,
  created_at timestamptz not null default now(),
  check ((kind = 'link') = (url is not null)),
  check ((kind = 'link') or storage_path is not null)
);

-- ---------------------------------------------------------------------------
-- Commerce (provider-agnostic; see src/lib/academy/payments)
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price_minor int not null check (price_minor >= 0),
  currency char(3) not null default 'GBP',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A product unlocks one or more courses (single course or bundle).
create table public.product_courses (
  product_id uuid not null references public.products (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete restrict,
  primary key (product_id, course_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  amount_minor int not null check (amount_minor >= 0),
  currency char(3) not null,
  status public.order_status not null default 'pending',
  provider text not null,
  provider_reference text,
  refunded_minor int not null default 0 check (refunded_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_reference)
);
create index orders_user_idx on public.orders (user_id, created_at desc);

-- Every verified webhook is recorded once. The unique constraint is what makes
-- repeated deliveries harmless.
create table public.payment_events (
  id bigint generated always as identity primary key,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  order_id uuid references public.orders (id),
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (provider, provider_event_id)
);

create table public.enrolments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  status public.enrolment_status not null default 'active',
  source public.enrolment_source not null,
  order_id uuid references public.orders (id),
  granted_by uuid references auth.users (id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  -- One row per (student, course): buying a second course adds a row, never replaces one;
  -- re-buying the same course re-activates the existing row.
  unique (user_id, course_id)
);
create index enrolments_course_idx on public.enrolments (course_id);

create table public.lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  last_position_seconds int not null default 0 check (last_position_seconds >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index lesson_progress_course_idx on public.lesson_progress (user_id, course_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip inet,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_target_idx on public.audit_log (target_type, target_id);

-- ---------------------------------------------------------------------------
-- Helper functions (used by RLS)
-- ---------------------------------------------------------------------------
create function public.has_role(r public.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid() and ur.role = r and p.status = 'active'
  );
$$;

create function public.has_permission(perm public.staff_permission)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('owner')
    or (
      public.has_role('admin')
      and exists (
        select 1 from public.staff_permissions sp
        where sp.user_id = auth.uid() and sp.permission = perm
      )
    );
$$;

create function public.teaches_course(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('teacher')
    and exists (
      select 1 from public.course_teachers ct
      where ct.course_id = c and ct.teacher_id = auth.uid()
    );
$$;

create function public.is_enrolled(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.enrolments e
    join public.profiles p on p.id = e.user_id
    where e.user_id = auth.uid() and e.course_id = c
      and e.status = 'active' and p.status = 'active'
  );
$$;

-- Teacher may see a student only if that student is enrolled in a course they teach.
create function public.teaches_student(student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('teacher')
    and exists (
      select 1 from public.enrolments e
      join public.course_teachers ct on ct.course_id = e.course_id
      where e.user_id = student and ct.teacher_id = auth.uid() and e.status = 'active'
    );
$$;

create function public.is_teacher(u uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles ur where ur.user_id = u and ur.role = 'teacher');
$$;

create function public.can_manage_course(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_permission('courses.manage') or public.teaches_course(c);
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger courses_touch before update on public.courses
  for each row execute function public.touch_updated_at();
create trigger modules_touch before update on public.modules
  for each row execute function public.touch_updated_at();
create trigger lessons_touch before update on public.lessons
  for each row execute function public.touch_updated_at();
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();
create trigger lesson_progress_touch before update on public.lesson_progress
  for each row execute function public.touch_updated_at();

-- Every new account gets a profile and the student role. Staff roles are granted
-- afterwards by an owner/admin through the audited server endpoint.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(left(new.raw_user_meta_data ->> 'full_name', 120), ''));
  insert into public.user_roles (user_id, role) values (new.id, 'student');
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep lessons.course_id consistent with its module.
create function public.lessons_sync_course()
returns trigger language plpgsql set search_path = '' as $$
begin
  select m.course_id into new.course_id from public.modules m where m.id = new.module_id;
  return new;
end;
$$;

create trigger lessons_sync_course before insert or update on public.lessons
  for each row execute function public.lessons_sync_course();

-- Progress rows take course_id from the lesson, not from the client.
create function public.progress_sync_course()
returns trigger language plpgsql set search_path = '' as $$
begin
  select l.course_id into new.course_id from public.lessons l where l.id = new.lesson_id;
  return new;
end;
$$;

create trigger progress_sync_course before insert or update on public.lesson_progress
  for each row execute function public.progress_sync_course();

-- A course is always attributed to its creator, and a teacher who creates a
-- course is assigned to it (otherwise they could not edit what they made).
create function public.courses_set_creator()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.created_by := auth.uid();
  return new;
end;
$$;

create trigger courses_set_creator before insert on public.courses
  for each row execute function public.courses_set_creator();

create function public.courses_assign_creator()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null and public.has_role('teacher') then
    insert into public.course_teachers (course_id, teacher_id, is_lead)
    values (new.id, new.created_by, true)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger courses_assign_creator after insert on public.courses
  for each row execute function public.courses_assign_creator();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.staff_permissions enable row level security;
alter table public.courses enable row level security;
alter table public.course_teachers enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_resources enable row level security;
alter table public.products enable row level security;
alter table public.product_courses enable row level security;
alter table public.orders enable row level security;
alter table public.payment_events enable row level security;
alter table public.enrolments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.audit_log enable row level security;

-- profiles: self, staff with students.read, teachers of the student.
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or public.has_permission('students.read')
  or public.teaches_student(id)
  or public.is_teacher(id)  -- instructor names/avatars are shown on courses
);
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Users may only edit presentational columns; status changes go through the server.
revoke update on public.profiles from authenticated;
grant update (full_name, display_name, avatar_path, headline) on public.profiles to authenticated;

-- roles & permissions: read own (portal routing); managers read all. No client writes.
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_permission('roles.manage'));
create policy staff_permissions_select on public.staff_permissions for select to authenticated
  using (user_id = auth.uid() or public.has_permission('roles.manage'));

-- courses: published catalogue is visible to signed-in users; drafts to managers/teachers.
create policy courses_select on public.courses for select to authenticated
  using (status = 'published' or created_by = auth.uid() or public.can_manage_course(id));
create policy courses_insert on public.courses for insert to authenticated
  with check (public.has_permission('courses.manage') or public.has_role('teacher'));
create policy courses_update on public.courses for update to authenticated
  using (public.can_manage_course(id)) with check (public.can_manage_course(id));
create policy courses_delete on public.courses for delete to authenticated
  using (public.has_permission('courses.manage'));

create policy course_teachers_select on public.course_teachers for select to authenticated using (true);
create policy course_teachers_write on public.course_teachers for all to authenticated
  using (public.has_permission('courses.manage')) with check (public.has_permission('courses.manage'));

-- modules: outline visible with the course; edits by course managers.
create policy modules_select on public.modules for select to authenticated using (
  public.can_manage_course(course_id)
  or exists (select 1 from public.courses c where c.id = course_id and c.status = 'published')
);
create policy modules_write on public.modules for all to authenticated
  using (public.can_manage_course(course_id)) with check (public.can_manage_course(course_id));

-- lessons: paid content — enrolled students (published only), free previews, managers.
create policy lessons_select on public.lessons for select to authenticated using (
  public.can_manage_course(course_id)
  or (
    status = 'published'
    and (is_preview or public.is_enrolled(course_id))
    and exists (select 1 from public.courses c where c.id = course_id and c.status = 'published')
  )
);
create policy lessons_write on public.lessons for all to authenticated
  using (public.can_manage_course(course_id)) with check (public.can_manage_course(course_id));

create policy lesson_resources_select on public.lesson_resources for select to authenticated using (
  exists (select 1 from public.lessons l where l.id = lesson_id)  -- inherits lessons RLS
);
create policy lesson_resources_write on public.lesson_resources for all to authenticated using (
  exists (select 1 from public.lessons l where l.id = lesson_id and public.can_manage_course(l.course_id))
) with check (
  exists (select 1 from public.lessons l where l.id = lesson_id and public.can_manage_course(l.course_id))
);

-- products: active catalogue readable; managed by course managers.
create policy products_select on public.products for select to authenticated
  using (active or public.has_permission('courses.manage'));
create policy products_write on public.products for all to authenticated
  using (public.has_permission('courses.manage')) with check (public.has_permission('courses.manage'));
create policy product_courses_select on public.product_courses for select to authenticated using (true);
create policy product_courses_write on public.product_courses for all to authenticated
  using (public.has_permission('courses.manage')) with check (public.has_permission('courses.manage'));

-- orders: own purchase history; finance staff. Writes are server-only.
-- Teachers deliberately have no access to orders or payment events.
create policy orders_select on public.orders for select to authenticated
  using (user_id = auth.uid() or public.has_permission('payments.read'));
-- payment_events: no policies => service role only.

-- enrolments: own, staff, and teachers of the course. Writes are server-only.
create policy enrolments_select on public.enrolments for select to authenticated using (
  user_id = auth.uid()
  or public.has_permission('enrolments.manage')
  or public.has_permission('students.read')
  or public.teaches_course(course_id)
);

-- progress: students write their own, only for courses they can access.
create policy progress_select on public.lesson_progress for select to authenticated using (
  user_id = auth.uid()
  or public.teaches_course(course_id)
  or public.has_permission('students.read')
);
create policy progress_insert on public.lesson_progress for insert to authenticated with check (
  user_id = auth.uid()
  and exists (select 1 from public.lessons l where l.id = lesson_id)  -- must be able to see the lesson
);
create policy progress_update on public.lesson_progress for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.lessons l where l.id = lesson_id));

create policy audit_select on public.audit_log for select to authenticated
  using (public.has_permission('audit.read'));

-- ---------------------------------------------------------------------------
-- Storage: private bucket for course media. Students never read objects
-- directly — the server checks enrolment and issues short-lived signed URLs.
-- Object paths are "<course_id>/<lesson_id>/<filename>".
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('course-media', 'course-media', false)
on conflict (id) do nothing;

create policy course_media_manage on storage.objects for all to authenticated
using (
  bucket_id = 'course-media'
  and public.can_manage_course(nullif((storage.foldername(name))[1], '')::uuid)
) with check (
  bucket_id = 'course-media'
  and public.can_manage_course(nullif((storage.foldername(name))[1], '')::uuid)
);
