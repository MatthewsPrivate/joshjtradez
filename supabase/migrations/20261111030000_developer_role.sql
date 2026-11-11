-- Hidden "developer" role for the platform's developer.
-- Granted only via ACADEMY_DEVELOPER_EMAILS on the server; never offered in any
-- UI to other users. Holds every staff permission (like owner) so the developer
-- can test all portals.
--
-- The new enum value is compared as text below because Postgres won't let a
-- freshly added enum value be used as a literal in the same transaction.
alter type public.app_role add value if not exists 'developer';

create function public.is_developer()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid() and ur.role::text = 'developer' and p.status = 'active'
  );
$$;

create or replace function public.has_permission(perm public.staff_permission)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('owner')
    or public.is_developer()
    or (
      public.has_role('admin')
      and exists (
        select 1 from public.staff_permissions sp
        where sp.user_id = auth.uid() and sp.permission = perm
      )
    );
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('owner') or public.has_role('admin') or public.is_developer();
$$;
