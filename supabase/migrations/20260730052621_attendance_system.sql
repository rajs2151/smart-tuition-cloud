-- =========================================================
-- ATTENDANCE SYSTEM
--
-- Two-table design per the approved PRD (attendance-system-prd.md §5.2):
-- one lightweight "session taken" row per batch per day, plus one row
-- per ABSENT student only. A present student generates zero writes.
-- This is what keeps the table affordable on Supabase's free tier at
-- 25,000-student scale (PRD §5.3) and is what makes "everyone present"
-- distinguishable from "attendance never taken" (both would otherwise
-- produce zero absence rows).
--
-- Conventions matched to this repo's existing migrations (not just the
-- PRD's schema sketch): ON DELETE CASCADE on tenant FKs, explicit
-- GRANT ... TO authenticated / service_role, one named RLS policy per
-- command using the existing is_member() helper, and — critically — an
-- explicit GRANT EXECUTE on the new RPC. The one confirmed production
-- bug in this codebase's RLS history (20260709055109_fix_authenticated_
-- execute_grants.sql) was exactly a missing EXECUTE grant, so this
-- migration grants it in the same file that creates the function
-- instead of as a follow-up.
-- =========================================================

CREATE TABLE public.attendance_sessions (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id   UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  batch_id       UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  session_date   DATE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'taken' CHECK (status IN ('taken', 'holiday', 'cancelled')),
  total_students INTEGER NOT NULL DEFAULT 0,
  absent_count   INTEGER NOT NULL DEFAULT 0,
  marked_by      UUID REFERENCES auth.users(id),
  marked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, session_date)
);
CREATE INDEX idx_attendance_sessions_institute_date ON public.attendance_sessions (institute_id, session_date);
CREATE INDEX ON public.attendance_sessions (batch_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_sessions TO authenticated;
GRANT ALL ON public.attendance_sessions TO service_role;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read attendance_sessions" ON public.attendance_sessions
  FOR SELECT TO authenticated USING (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members insert attendance_sessions" ON public.attendance_sessions
  FOR INSERT TO authenticated WITH CHECK (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members update attendance_sessions" ON public.attendance_sessions
  FOR UPDATE TO authenticated
  USING (public.is_member(institute_id, auth.uid()))
  WITH CHECK (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members delete attendance_sessions" ON public.attendance_sessions
  FOR DELETE TO authenticated USING (public.is_member(institute_id, auth.uid()));

CREATE TRIGGER trg_attendance_sessions_updated
  BEFORE UPDATE ON public.attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- One row PER ABSENT STUDENT only. No `present` boolean anywhere —
-- presence is the absence of a row here for that (session_id, student_id).
CREATE TABLE public.attendance_absences (
  id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id   UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);
CREATE INDEX idx_attendance_absences_student ON public.attendance_absences (student_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_absences TO authenticated;
GRANT ALL ON public.attendance_absences TO service_role;
ALTER TABLE public.attendance_absences ENABLE ROW LEVEL SECURITY;

-- Scoped via the parent session's institute_id (no institute_id column
-- on this table — mirrors how `receipts` scopes through payment_id
-- elsewhere in this schema... except receipts DOES carry institute_id
-- directly. Attendance absences don't, so RLS here goes through a join
-- to attendance_sessions rather than a bare column check.
CREATE POLICY "Members read attendance_absences" ON public.attendance_absences
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      WHERE s.id = session_id AND public.is_member(s.institute_id, auth.uid())
    )
  );
CREATE POLICY "Members insert attendance_absences" ON public.attendance_absences
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      WHERE s.id = session_id AND public.is_member(s.institute_id, auth.uid())
    )
  );
CREATE POLICY "Members update attendance_absences" ON public.attendance_absences
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      WHERE s.id = session_id AND public.is_member(s.institute_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      WHERE s.id = session_id AND public.is_member(s.institute_id, auth.uid())
    )
  );
CREATE POLICY "Members delete attendance_absences" ON public.attendance_absences
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      WHERE s.id = session_id AND public.is_member(s.institute_id, auth.uid())
    )
  );

-- =========================================================
-- save_attendance — one RPC round-trip per save, `unnest()` bulk insert
-- instead of N individual statements, regardless of 0 or 80 absences
-- (PRD §6). SECURITY DEFINER so it can upsert the session + replace the
-- absence set atomically; re-checks is_member() itself since it bypasses
-- RLS internally (matching the pattern in next_receipt_number, the one
-- other SECURITY DEFINER RPC this app calls from the client).
-- =========================================================
CREATE OR REPLACE FUNCTION public.save_attendance(
  _batch_id UUID,
  _session_date DATE,
  _absent_student_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _session_id UUID;
  _institute_id UUID;
  _total INTEGER;
  _absent_count INTEGER;
  _valid_absent_count INTEGER;
BEGIN
  SELECT institute_id INTO _institute_id FROM public.batches WHERE id = _batch_id;
  IF _institute_id IS NULL THEN
    RAISE EXCEPTION 'batch % not found', _batch_id;
  END IF;
  IF NOT public.is_member(_institute_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a member of institute %', _institute_id;
  END IF;
  -- Cross-tenant / cross-batch guard: a member of the institute could
  -- otherwise pass student ids from a DIFFERENT batch (or a different
  -- institute entirely) in _absent_student_ids, since is_member() only
  -- checks the batch itself, not each id in the array. Checked before any
  -- INSERT/UPDATE below so a bad call fails atomically with no partial
  -- write.

  SELECT count(*) INTO _total FROM public.students WHERE batch_id = _batch_id AND NOT deleted;
  _absent_count := COALESCE(array_length(_absent_student_ids, 1), 0);

  IF _absent_count > 0 THEN
    SELECT count(*) INTO _valid_absent_count
    FROM public.students
    WHERE id = ANY(_absent_student_ids) AND batch_id = _batch_id;
    IF _valid_absent_count <> _absent_count THEN
      RAISE EXCEPTION 'one or more student ids do not belong to batch %', _batch_id;
    END IF;
  END IF;

  INSERT INTO public.attendance_sessions
    (institute_id, batch_id, session_date, status, total_students, absent_count, marked_by)
  VALUES
    (_institute_id, _batch_id, _session_date, 'taken', _total, _absent_count, auth.uid())
  ON CONFLICT (batch_id, session_date)
  DO UPDATE SET
    status = 'taken',
    total_students = EXCLUDED.total_students,
    absent_count = EXCLUDED.absent_count,
    marked_by = EXCLUDED.marked_by,
    updated_at = now()
  RETURNING id INTO _session_id;

  DELETE FROM public.attendance_absences WHERE session_id = _session_id;

  IF _absent_count > 0 THEN
    INSERT INTO public.attendance_absences (session_id, student_id)
    SELECT _session_id, unnest(_absent_student_ids);
  END IF;

  RETURN _session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_attendance(UUID, DATE, UUID[]) TO authenticated;

-- =========================================================
-- mark_attendance_status — sets a session to 'holiday' or 'cancelled'
-- (PRD §7), excluded from attendance % calculations and from "pending
-- attendance" nudges. Separate from save_attendance because these
-- states carry no absence list at all (nothing to unnest).
-- =========================================================
CREATE OR REPLACE FUNCTION public.mark_attendance_status(
  _batch_id UUID,
  _session_date DATE,
  _status TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _session_id UUID;
  _institute_id UUID;
  _total INTEGER;
BEGIN
  IF _status NOT IN ('holiday', 'cancelled') THEN
    RAISE EXCEPTION 'invalid status %, use save_attendance for taken sessions', _status;
  END IF;

  SELECT institute_id INTO _institute_id FROM public.batches WHERE id = _batch_id;
  IF _institute_id IS NULL THEN
    RAISE EXCEPTION 'batch % not found', _batch_id;
  END IF;
  IF NOT public.is_member(_institute_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a member of institute %', _institute_id;
  END IF;

  SELECT count(*) INTO _total FROM public.students WHERE batch_id = _batch_id AND NOT deleted;

  INSERT INTO public.attendance_sessions
    (institute_id, batch_id, session_date, status, total_students, absent_count, marked_by)
  VALUES
    (_institute_id, _batch_id, _session_date, _status, _total, 0, auth.uid())
  ON CONFLICT (batch_id, session_date)
  DO UPDATE SET
    status = EXCLUDED.status,
    total_students = EXCLUDED.total_students,
    absent_count = 0,
    marked_by = EXCLUDED.marked_by,
    updated_at = now()
  RETURNING id INTO _session_id;

  DELETE FROM public.attendance_absences WHERE session_id = _session_id;

  RETURN _session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_attendance_status(UUID, DATE, TEXT) TO authenticated;

-- =========================================================
-- Institute-level attendance settings (Settings → Attendance tab).
-- Same pattern as the existing receipt_* / master_* columns on
-- institutes — no new table needed for two small, institute-wide
-- values. Nullable lock time = no cutoff (editable any time same day,
-- admin/owner can always override in the UI regardless of this value).
-- =========================================================
ALTER TABLE public.institutes
  ADD COLUMN IF NOT EXISTS attendance_language TEXT NOT NULL DEFAULT 'English'
    CHECK (attendance_language IN ('English', 'Marathi')),
  ADD COLUMN IF NOT EXISTS attendance_lock_time TIME;
