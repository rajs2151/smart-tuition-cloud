-- Multi-user team support, part 2: RPCs, RLS, and invite auto-linking.
--
-- Depends on 20260714120000_team_members_schema.sql having run first.

-- ---------------------------------------------------------------------
-- 0. Helper (kept for future use / consistency with is_member/is_owner;
--    not currently required by the RPCs below since they all restrict
--    user-management to the owner specifically, matching the product's
--    permission table where "Manage users" is listed only under Owner).
-- ---------------------------------------------------------------------
create or replace function public.is_owner_or_admin(_institute uuid, _user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.institute_members
    where institute_id = _institute
      and user_id = _user
      and status = 'active'
      and role in ('owner', 'admin')
  );
$$;

grant execute on function public.is_owner_or_admin(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 1. RLS on institute_members
-- ---------------------------------------------------------------------
-- All mutations now go through the SECURITY DEFINER RPCs below instead
-- of direct table INSERT/UPDATE/DELETE. This is required, not just
-- stylistic: inviting someone needs to check auth.users for a matching
-- existing account, and authenticated clients cannot SELECT auth.users
-- directly.
--
-- The original schema migration (20260703064918) named these policies
-- "Owners add members", "Owners update members", and "Owners remove
-- members or user removes self" — not the generic
-- institute_members_insert_owner-style names a first draft of this
-- migration assumed. DROP POLICY IF EXISTS on a name that doesn't
-- exist is a silent no-op, so getting these names right matters: with
-- the wrong names, the old, more permissive direct-write policies
-- would stay active and an owner could bypass invite_member's
-- validation (5-seat cap, duplicate-invite check, email format) by
-- writing to institute_members directly. Using the real names here so
-- the RPCs are actually the only mutation path, as intended.
drop policy if exists "Owners add members" on public.institute_members;
drop policy if exists "Owners update members" on public.institute_members;
drop policy if exists "Owners remove members or user removes self" on public.institute_members;

-- SELECT is unchanged: the original schema migration's "Members read
-- memberships in their institute" policy already does exactly this
-- (any active member of the institute can see every row, pending
-- invites included — needed for the Team Members list and its
-- "4 / 5 Users" usage counter), so it's left in place rather than
-- dropped and recreated under a different name.

-- ---------------------------------------------------------------------
-- 2. Auto-populate display_name / invited_email on any new row
-- ---------------------------------------------------------------------
-- Covers rows inserted by paths this migration doesn't control directly
-- (e.g. the existing create_institute_with_owner RPC's owner-row
-- insert), so every member always has a usable name/email without
-- having to edit that function's SQL here.
create or replace function public.backfill_member_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null then
    if new.invited_email is null then
      select email into new.invited_email from auth.users where id = new.user_id;
    end if;
    if new.display_name is null then
      select split_part(email, '@', 1) into new.display_name from auth.users where id = new.user_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists institute_members_backfill_identity on public.institute_members;
create trigger institute_members_backfill_identity
  before insert on public.institute_members
  for each row execute function public.backfill_member_identity();

-- ---------------------------------------------------------------------
-- 3. invite_member
-- ---------------------------------------------------------------------
-- Owner-only (see permission table: Admin/Teacher/Accountant are all
-- explicitly "cannot manage users"). Enforces the 5-seat cap (pending +
-- active count together — an outstanding invite reserves a seat), and
-- immediately links to an existing auth account if one already exists
-- for that email, instead of leaving it pending unnecessarily.
create or replace function public.invite_member(
  _institute uuid,
  _email text,
  _name text,
  _role public.member_role
)
returns public.institute_members
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller uuid := auth.uid();
  _normalized_email text := lower(trim(_email));
  _existing_user uuid;
  _member_count int;
  _row public.institute_members;
begin
  if _caller is null then
    raise exception 'Not authenticated';
  end if;
  if _normalized_email is null or _normalized_email = '' or position('@' in _normalized_email) = 0 then
    raise exception 'A valid email is required';
  end if;
  if _role = 'owner' then
    raise exception 'The owner role cannot be assigned via invitation';
  end if;
  if not public.is_owner(_institute, _caller) then
    raise exception 'Only the institute owner can invite team members';
  end if;

  select count(*) into _member_count
  from public.institute_members
  where institute_id = _institute;

  if _member_count >= 5 then
    raise exception 'This institute already has the maximum of 5 users';
  end if;

  select id into _existing_user from auth.users where lower(email) = _normalized_email limit 1;

  if exists (
    select 1 from public.institute_members
    where institute_id = _institute
      and (
        lower(invited_email) = _normalized_email
        or (_existing_user is not null and user_id = _existing_user)
      )
  ) then
    raise exception 'This person is already a member or has a pending invite';
  end if;

  insert into public.institute_members
    (institute_id, user_id, role, access_enabled, invited_email, display_name, status, invited_by, invited_at)
  values
    (
      _institute,
      _existing_user,
      _role,
      true,
      _normalized_email,
      nullif(trim(_name), ''),
      case when _existing_user is not null then 'active' else 'pending' end,
      _caller,
      now()
    )
  returning * into _row;

  return _row;
end;
$$;

grant execute on function public.invite_member(uuid, text, text, public.member_role) to authenticated;

-- ---------------------------------------------------------------------
-- 4. change_member_role
-- ---------------------------------------------------------------------
create or replace function public.change_member_role(
  _institute uuid,
  _member_id uuid,
  _role public.member_role
)
returns public.institute_members
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller uuid := auth.uid();
  _target public.institute_members;
  _row public.institute_members;
begin
  if not public.is_owner(_institute, _caller) then
    raise exception 'Only the institute owner can change roles';
  end if;

  select * into _target from public.institute_members
    where id = _member_id and institute_id = _institute;
  if not found then
    raise exception 'Member not found';
  end if;
  if _target.role = 'owner' then
    raise exception 'The owner''s role cannot be changed';
  end if;
  if _role = 'owner' then
    raise exception 'Ownership cannot be transferred here';
  end if;

  update public.institute_members
    set role = _role
    where id = _member_id
    returning * into _row;

  return _row;
end;
$$;

grant execute on function public.change_member_role(uuid, uuid, public.member_role) to authenticated;

-- ---------------------------------------------------------------------
-- 5. remove_member
-- ---------------------------------------------------------------------
create or replace function public.remove_member(_institute uuid, _member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller uuid := auth.uid();
  _target public.institute_members;
begin
  if not public.is_owner(_institute, _caller) then
    raise exception 'Only the institute owner can remove team members';
  end if;

  select * into _target from public.institute_members
    where id = _member_id and institute_id = _institute;
  if not found then
    raise exception 'Member not found';
  end if;
  if _target.role = 'owner' then
    raise exception 'The owner cannot be removed';
  end if;

  delete from public.institute_members where id = _member_id;
end;
$$;

grant execute on function public.remove_member(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Auto-link a pending invitation the first time that email signs in
-- ---------------------------------------------------------------------
-- Provider-agnostic: keyed purely on auth.users.email, so this works
-- with the project's actual auth setup (email/password only — Google
-- OAuth was deliberately removed, see docs/HANDOVER.md "Important
-- Decisions: Email/password over OAuth") and would keep working
-- unchanged if Google OAuth is ever reconfigured later.
--
-- Verified no name collision: there is no pre-existing trigger on
-- auth.users anywhere in this project's migrations (the only other
-- auth-adjacent trigger, add_creator_as_owner, fires on public.institutes,
-- not auth.users), so this is a genuinely new trigger, not a replacement.
create or replace function public.link_pending_invitations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.institute_members
    set user_id = new.id,
        status = 'active'
    where status = 'pending'
      and lower(invited_email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_link_invitations on auth.users;
create trigger on_auth_user_created_link_invitations
  after insert on auth.users
  for each row execute function public.link_pending_invitations();
