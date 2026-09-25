-- is_owner_or_admin(_institute, _user) is SECURITY DEFINER and executable by
-- authenticated, so any signed-in user could call
-- /rest/v1/rpc/is_owner_or_admin with someone else's id to learn whether
-- they own or administer an institute. Same guard as is_member / is_owner
-- (20260820120000): it only answers for the caller's own user id, and
-- COALESCE keeps the result false (never NULL) when there is no JWT.
-- Nothing calls it today; signature and grants are unchanged.
--
-- Rollback (restores production's definition byte for byte, CRLF body
-- included; CREATE OR REPLACE keeps grants):
--   CREATE OR REPLACE FUNCTION public.is_owner_or_admin(_institute uuid, _user uuid)
--    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
--   AS E'\r\n  select exists (\r\n    select 1 from public.institute_members\r\n    where institute_id = _institute\r\n      and user_id = _user\r\n      and status = \'active\'\r\n      and role in (\'owner\', \'admin\')\r\n  );\r\n';

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
      and role in ('owner', 'admin')
  );
$$;
