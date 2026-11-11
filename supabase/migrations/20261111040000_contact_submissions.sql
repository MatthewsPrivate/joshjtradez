-- Website contact form ("Send My Details") submissions.
-- Inserted only by the server endpoint (service role); read and triaged by the
-- owner/developer, or admins granted support.manage.

create table public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 320),
  phone text check (phone is null or char_length(phone) <= 40),
  country text check (country is null or char_length(country) <= 80),
  -- Every answer as submitted: [{ "name": "...", "label": "...", "value": "..." }]
  answers jsonb not null default '[]'::jsonb,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed', 'spam')),
  notes text not null default '' check (char_length(notes) <= 5000),
  handled_by uuid references auth.users (id),
  ip inet,
  user_agent text,
  email_sent_at timestamptz,
  email_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contact_submissions_status_idx on public.contact_submissions (status, created_at desc);
create trigger contact_submissions_touch before update on public.contact_submissions
  for each row execute function public.touch_updated_at();

alter table public.contact_submissions enable row level security;
create policy contact_select on public.contact_submissions for select to authenticated
  using (public.has_permission('support.manage'));
create policy contact_update on public.contact_submissions for update to authenticated
  using (public.has_permission('support.manage')) with check (public.has_permission('support.manage'));
-- Staff may only change triage fields.
revoke insert, update, delete on public.contact_submissions from authenticated, anon;
grant update (status, notes, handled_by) on public.contact_submissions to authenticated;
