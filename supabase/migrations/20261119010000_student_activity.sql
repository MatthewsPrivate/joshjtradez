-- ---------------------------------------------------------------------------
-- Student activity: powers the "students who need attention" list for Josh
-- and teachers.
--
--   profiles.last_seen_at   bumped (at most every 10 min) when a user opens a portal page
--   touch_last_seen()       the only way to set it — users can't write it directly
--   student_contacts(ids)   email / last sign-in / staff flag for students the caller
--                           may see (owner & students.read admins: everyone;
--                           teachers: students enrolled in their courses)
-- ---------------------------------------------------------------------------

alter table public.profiles add column last_seen_at timestamptz;

create function public.touch_last_seen()
returns void language sql volatile security definer set search_path = '' as $$
  update public.profiles
     set last_seen_at = now()
   where id = auth.uid()
     and (last_seen_at is null or last_seen_at < now() - interval '10 minutes');
$$;
revoke all on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;

create function public.student_contacts(ids uuid[])
returns table (id uuid, email text, last_sign_in_at timestamptz, last_seen_at timestamptz, joined_at timestamptz, is_staff boolean)
language sql stable security definer set search_path = '' as $$
  select
    u.id,
    u.email::text,
    u.last_sign_in_at,
    p.last_seen_at,
    p.created_at,
    exists (
      select 1 from public.user_roles r
      where r.user_id = u.id and r.role in ('owner', 'admin', 'teacher', 'developer')
    )
  from auth.users u
  join public.profiles p on p.id = u.id
  where u.id = any (ids)
    and u.id <> auth.uid()
    and (public.has_permission('students.read') or public.teaches_student(u.id));
$$;
revoke all on function public.student_contacts(uuid[]) from public, anon;
grant execute on function public.student_contacts(uuid[]) to authenticated;

-- Everyone who holds the plain student role and nothing else (owner view uses
-- this to include sign-ups who haven't been enrolled in a course yet).
create function public.student_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select r.user_id from public.user_roles r
  where public.has_permission('students.read')
    and r.role = 'student'
    and not exists (
      select 1 from public.user_roles s
      where s.user_id = r.user_id and s.role in ('owner', 'admin', 'teacher', 'developer')
    );
$$;
revoke all on function public.student_ids() from public, anon;
grant execute on function public.student_ids() to authenticated;
