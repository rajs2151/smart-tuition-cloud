-- is_member / is_owner already refuse members whose access has been
-- disabled (20260820120000); is_owner_or_admin still let them through.
-- Signature, guard and grants are unchanged.
--
-- Rollback (restores 20260924120100):
--   create or replace function public.is_owner_or_admin(_institute uuid, _user uuid)
--   returns boolean language sql stable security definer set search_path = public
--   as $$
--     select coalesce(_user = auth.uid(), false) and exists (
--       select 1 from public.institute_members
--       where institute_id = _institute
--         and user_id = _user
--         and status = 'active'
--         and role in ('owner', 'admin')
--     );
--   $$;

create or replace function public.is_owner_or_admin(_institute uuid, _user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(_user = auth.uid(), false) and exists (
    select 1 from public.institute_members
    where institute_id = _institute
      and user_id = _user
      and status = 'active'
      and access_enabled = true
      and role in ('owner', 'admin')
  );
$$;
