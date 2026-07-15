-- Multi-user team support, part 1: schema.
--
-- Turns institute_members into the backing store for both active
-- members AND outstanding invitations, and widens the role model
-- beyond owner/staff.
--
-- Split from part 2 (RPCs/RLS/trigger) deliberately: adding enum values
-- and immediately depending on them in policies/functions in the same
-- transaction is safe on modern Postgres (17), but keeping schema and
-- behaviour changes in separate, independently-re-runnable files makes
-- this easier to review and to re-apply piecemeal if something needs a
-- fix later — consistent with this project's existing migration style
-- (see e.g. 20260709055109_fix_authenticated_execute_grants as its own
-- follow-up file rather than amending an earlier one).

-- ---------------------------------------------------------------------
-- 1. New role values.
-- ---------------------------------------------------------------------
-- 'owner' and 'staff' already exist. 'staff' is kept as-is for backward
-- compatibility with any existing rows — it is NOT removed — but the
-- new Team Members UI only offers admin / teacher / accountant for new
-- invitations. See src/lib/auth/roles.ts: 'staff' is treated the same
-- as 'admin' permission-wise going forward.
alter type public.member_role add value if not exists 'admin';
alter type public.member_role add value if not exists 'teacher';
alter type public.member_role add value if not exists 'accountant';

-- ---------------------------------------------------------------------
-- 2. institute_members: support "pending" rows (invited, no auth user
--    linked yet) alongside the existing "active" rows.
-- ---------------------------------------------------------------------
alter table public.institute_members
  alter column user_id drop not null;

alter table public.institute_members
  add column if not exists invited_email text,
  add column if not exists display_name text,
  add column if not exists status text not null default 'active',
  add column if not exists invited_by uuid references auth.users(id) on delete set null,
  add column if not exists invited_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'institute_members_status_check'
  ) then
    alter table public.institute_members
      add constraint institute_members_status_check
      check (status in ('pending', 'active'));
  end if;
end $$;

-- A pending row must carry the email it was invited with and must NOT
-- yet be linked to a user; an active row must be linked to a real auth
-- user. Keeps the two concepts (invited vs joined) from drifting apart.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'institute_members_status_consistency_check'
  ) then
    alter table public.institute_members
      add constraint institute_members_status_consistency_check
      check (
        (status = 'pending' and user_id is null and invited_email is not null)
        or
        (status = 'active' and user_id is not null)
      );
  end if;
end $$;

-- One outstanding pending invite per email per institute.
create unique index if not exists institute_members_institute_email_pending_uidx
  on public.institute_members (institute_id, lower(invited_email))
  where status = 'pending';

-- One membership row per (institute, user) once linked — a person can't
-- end up with two rows (e.g. two different roles) in the same institute.
create unique index if not exists institute_members_institute_user_uidx
  on public.institute_members (institute_id, user_id)
  where user_id is not null;

-- Backfill display_name / invited_email for rows that pre-date this
-- migration (created via create_institute_with_owner, or any manual
-- SQL inserts), so Team Members and Recent Activity have something
-- real to show instead of a blank cell or raw user id.
update public.institute_members im
set
  display_name = coalesce(im.display_name, split_part(u.email, '@', 1)),
  invited_email = coalesce(im.invited_email, u.email)
from auth.users u
where im.user_id = u.id
  and (im.display_name is null or im.invited_email is null);

comment on column public.institute_members.status is
  'active = linked to a real auth user and can sign in to this institute. pending = invited by email, waiting for that account to sign in for the first time.';
comment on column public.institute_members.invited_email is
  'Email the invitation was sent to. Kept after acceptance too, as the record of how/who this member is (used for display since the client cannot read auth.users directly).';
comment on column public.institute_members.display_name is
  'Human-readable name for Team Members / Recent Activity. Set at invite time; backfilled from email for pre-existing rows.';
