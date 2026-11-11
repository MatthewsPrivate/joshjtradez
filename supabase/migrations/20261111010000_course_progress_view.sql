-- Per-student, per-course progress for dashboards.
-- security_invoker: evaluated with the caller's RLS, so students see only their
-- own rows, teachers only their courses, staff per their permissions.
create view public.course_progress
with (security_invoker = true) as
select
  e.user_id,
  e.course_id,
  count(l.id)::int as total_lessons,
  count(lp.completed_at)::int as completed_lessons,
  max(lp.updated_at) as last_activity_at
from public.enrolments e
left join public.lessons l
  on l.course_id = e.course_id and l.status = 'published'
left join public.lesson_progress lp
  on lp.lesson_id = l.id and lp.user_id = e.user_id
where e.status = 'active'
group by e.user_id, e.course_id;

grant select on public.course_progress to authenticated;
