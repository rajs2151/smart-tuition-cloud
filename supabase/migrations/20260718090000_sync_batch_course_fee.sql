-- Keep students.course_fee/total_fee in sync with their batch's Total
-- Course Fee when it's edited.
--
-- Why this needs a DB function rather than a client-side update():
-- total_fee must become (new course fee + that student's own
-- admission_fee), and admission_fee differs per student. supabase-js's
-- .update() only accepts literal values, not a per-row SQL expression,
-- so a single client update() call cannot set the correct total_fee for
-- every student in one round trip. This function does it as one SQL
-- statement instead of looping per-student updates from the client.
--
-- Not SECURITY DEFINER: the existing "Members update students" RLS
-- policy already lets any institute member update their institute's
-- students (the same policy plain updateStudent() already relies on),
-- so this function runs with the caller's own privileges and is scoped
-- by RLS exactly as a direct client update would be - no privilege
-- escalation introduced.
--
-- Only touches course_fee/total_fee. discount and paid_fee are
-- untouched, so any per-student discount stays intact; only the
-- pre-discount billed amount tracks the batch's fee.
create or replace function public.sync_batch_course_fee(_batch_id uuid, _new_fee numeric)
returns void
language sql
set search_path = public
as $$
  update public.students
  set course_fee = _new_fee,
      total_fee = _new_fee + admission_fee
  where batch_id = _batch_id
    and deleted = false;
$$;

grant execute on function public.sync_batch_course_fee(uuid, numeric) to authenticated;
