-- ============================================================================
-- Demo seed data for Vidyafee / smart-tuition-cloud
-- ============================================================================
-- WHAT THIS DOES
--   Seeds one demo institute ("Dnyanpeeth Classes") with two batches, five
--   students, three payments, matching receipts, and a couple of audit log
--   entries — enough to explore every screen in the app with realistic data
--   instead of an empty dashboard.
--
-- PREREQUISITE — READ THIS BEFORE RUNNING
--   This script deliberately does NOT create Supabase Auth users itself.
--   Inserting rows directly into `auth.users` / `auth.identities` is a common
--   pattern in Supabase seed scripts, but the exact columns GoTrue requires
--   there differ across Supabase versions, and getting it slightly wrong
--   produces an account that *exists* but silently can't sign in. That's a
--   worse outcome than one extra manual step, so instead:
--
--     1. Run the app locally (see SETUP.md) and use the sign-up form on the
--        sign-in screen to create two accounts:
--          owner@demo.local   (password: anything, e.g. Demo@12345)
--          staff@demo.local   (password: anything, e.g. Demo@12345)
--        — or create them via Supabase Dashboard → Authentication → Users →
--        "Add user" instead, if you'd rather not use the app UI.
--     2. Copy each user's UUID: Dashboard → Authentication → Users → click
--        the user → copy the "User UID" field.
--     3. Replace the two placeholder UUIDs below (demo_owner_id,
--        demo_staff_id) with the real ones.
--     4. Run this file: Dashboard → SQL Editor → paste & run, or from the
--        CLI: `supabase db execute -f supabase/seed.sql`
--        (if you're using the local dev stack via `supabase start`, this
--        file also runs automatically every time you run `supabase db reset`).
--
--   Safe to re-run: every insert is guarded with ON CONFLICT DO NOTHING, so
--   running this twice will not create duplicates or raise an error.
--
--   If you skip step 3 and leave the placeholder UUIDs in place, this script
--   will fail fast with a clear error instead of silently seeding an
--   institute owned by a user that doesn't exist.
-- ============================================================================

DO $$
DECLARE
  -- ⚠️ REPLACE THESE TWO before running — see steps 1-3 above.
  demo_owner_id UUID := '00000000-0000-0000-0000-000000000001';
  demo_staff_id UUID := '00000000-0000-0000-0000-000000000002';

  -- Fixed IDs for the demo records themselves — safe to leave as-is.
  demo_institute_id UUID := 'a0000000-0000-4000-8000-000000000001';
  batch_10th_id     UUID := 'a0000000-0000-4000-8000-000000000010';
  batch_12th_jee_id UUID := 'a0000000-0000-4000-8000-000000000011';

  student_1 UUID := 'a0000000-0000-4000-8000-000000000021';
  student_2 UUID := 'a0000000-0000-4000-8000-000000000022';
  student_3 UUID := 'a0000000-0000-4000-8000-000000000023';
  student_4 UUID := 'a0000000-0000-4000-8000-000000000024';
  student_5 UUID := 'a0000000-0000-4000-8000-000000000025';

  payment_1 UUID := 'a0000000-0000-4000-8000-000000000031';
  payment_2 UUID := 'a0000000-0000-4000-8000-000000000032';
  payment_3 UUID := 'a0000000-0000-4000-8000-000000000033';

  receipt_1 UUID := 'a0000000-0000-4000-8000-000000000041';
  receipt_2 UUID := 'a0000000-0000-4000-8000-000000000042';
  receipt_3 UUID := 'a0000000-0000-4000-8000-000000000043';

  owner_exists BOOLEAN;
BEGIN
  -- Guard: fail loudly with a clear message rather than silently seeding an
  -- institute "owned" by a non-existent user (institutes.created_by is a
  -- NOT NULL foreign key into auth.users, so this would fail anyway — this
  -- just gives a much clearer error than a raw FK-violation would).
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = demo_owner_id) INTO owner_exists;
  IF NOT owner_exists THEN
    RAISE EXCEPTION
      'demo_owner_id (%) does not match any row in auth.users. Create the demo owner account first (see the comment block at the top of this file) and update demo_owner_id in supabase/seed.sql.',
      demo_owner_id;
  END IF;

  -- ---------------------------------------------------------------------
  -- Institute
  -- (the owner's institute_members row is created automatically by the
  -- trg_institute_created_add_owner trigger — no need to insert it here)
  -- ---------------------------------------------------------------------
  INSERT INTO public.institutes (
    id, name, address, phone, email, receipt_prefix, receipt_next_number,
    subscription_status, created_by
  ) VALUES (
    demo_institute_id,
    'Dnyanpeeth Classes',
    'FC Road, Pune, Maharashtra',
    '+91 98765 43210',
    'owner@demo.local',
    'REC',
    1004,  -- past the 3 seed payments below, so real receipts continue at REC-1004
    'trial',
    demo_owner_id
  )
  ON CONFLICT (id) DO NOTHING;

  -- Staff membership (owner membership already exists via the trigger above).
  -- Only added if a real demo_staff_id was provided and exists.
  IF demo_staff_id IS NOT NULL AND EXISTS (SELECT 1 FROM auth.users WHERE id = demo_staff_id) THEN
    INSERT INTO public.institute_members (institute_id, user_id, role)
    VALUES (demo_institute_id, demo_staff_id, 'staff')
    ON CONFLICT (institute_id, user_id) DO NOTHING;
  END IF;

  -- ---------------------------------------------------------------------
  -- Batches
  -- ---------------------------------------------------------------------
  INSERT INTO public.batches (
    id, institute_id, name, type, standard, board, medium, faculty,
    total_course_fee, capacity, start_date, active
  ) VALUES
    (batch_10th_id, demo_institute_id, '10th Science - Batch A', 'standard',
     '10th', 'State Board', 'Semi English', 'Mrs. Deshmukh', 18000, 40,
     DATE '2026-06-01', true),
    (batch_12th_jee_id, demo_institute_id, '12th JEE Batch', 'exam',
     '12th', 'CBSE', 'English', 'Mr. Kulkarni', 36000, 25,
     DATE '2026-06-01', true)
  ON CONFLICT (id) DO NOTHING;

  -- ---------------------------------------------------------------------
  -- Students
  -- ---------------------------------------------------------------------
  INSERT INTO public.students (
    id, institute_id, roll_no, name, phone, parent_name, parent_phone,
    batch_id, standard, board, medium, course_fee, admission_fee, discount,
    total_fee, paid_fee, admission_date, status
  ) VALUES
    (student_1, demo_institute_id, '10A-01', 'Aarav Sharma', '+91 90000 00001',
     'Rakesh Sharma', '+91 90000 10001', batch_10th_id, '10th', 'State Board',
     'Semi English', 15000, 1000, 0, 16000, 16000, DATE '2026-06-05', 'active'),
    (student_2, demo_institute_id, '10A-02', 'Isha Patil', '+91 90000 00002',
     'Sunil Patil', '+91 90000 10002', batch_10th_id, '10th', 'State Board',
     'Semi English', 15000, 1000, 1000, 15000, 8000, DATE '2026-06-06', 'active'),
    (student_3, demo_institute_id, '10A-03', 'Om Joshi', '+91 90000 00003',
     'Vijay Joshi', '+91 90000 10003', batch_10th_id, '10th', 'State Board',
     'Semi English', 15000, 1000, 0, 16000, 0, DATE '2026-06-10', 'active'),
    (student_4, demo_institute_id, '12J-01', 'Sneha Kulkarni', '+91 90000 00004',
     'Prakash Kulkarni', '+91 90000 10004', batch_12th_jee_id, '12th', 'CBSE',
     'English', 30000, 2000, 2000, 30000, 30000, DATE '2026-06-03', 'active'),
    (student_5, demo_institute_id, '12J-02', 'Rohan Deshpande', '+91 90000 00005',
     'Anil Deshpande', '+91 90000 10005', batch_12th_jee_id, '12th', 'CBSE',
     'English', 30000, 2000, 0, 32000, 12000, DATE '2026-06-04', 'active')
  ON CONFLICT (id) DO NOTHING;

  -- ---------------------------------------------------------------------
  -- Payments + matching receipts
  --
  -- Not using the next_receipt_number() RPC here — it checks auth.uid()
  -- internally (it's meant to be called by a logged-in user from the app),
  -- which has no meaning in a raw SQL/seed session. Receipt numbers are
  -- assigned directly instead, and institutes.receipt_next_number above is
  -- already set past them so the app's real receipt numbering won't collide.
  -- ---------------------------------------------------------------------
  INSERT INTO public.payments (
    id, institute_id, student_id, amount, date, mode, receipt_no, type
  ) VALUES
    (payment_1, demo_institute_id, student_1, 16000, DATE '2026-06-05', 'Cash', 'REC-1001', 'fee'),
    (payment_2, demo_institute_id, student_2, 8000, DATE '2026-06-06', 'UPI', 'REC-1002', 'fee'),
    (payment_3, demo_institute_id, student_5, 12000, DATE '2026-06-04', 'Bank Transfer', 'REC-1003', 'fee')
  ON CONFLICT (institute_id, receipt_no) DO NOTHING;

  INSERT INTO public.receipts (
    id, institute_id, receipt_no, student_id, payment_id, amount, balance, date, mode
  ) VALUES
    (receipt_1, demo_institute_id, 'REC-1001', student_1, payment_1, 16000, 0, DATE '2026-06-05', 'Cash'),
    (receipt_2, demo_institute_id, 'REC-1002', student_2, payment_2, 8000, 7000, DATE '2026-06-06', 'UPI'),
    (receipt_3, demo_institute_id, 'REC-1003', student_5, payment_3, 12000, 20000, DATE '2026-06-04', 'Bank Transfer')
  ON CONFLICT (id) DO NOTHING;

  -- ---------------------------------------------------------------------
  -- Audit log
  -- ---------------------------------------------------------------------
  INSERT INTO public.audit_logs (institute_id, entity, entity_id, action, by_user, summary)
  VALUES
    (demo_institute_id, 'institute', demo_institute_id::text, 'created', demo_owner_id, 'Demo institute seeded'),
    (demo_institute_id, 'student', student_1::text, 'created', demo_owner_id, 'Seeded demo student Aarav Sharma');

  RAISE NOTICE 'Demo seed complete for institute %', demo_institute_id;
END $$;
