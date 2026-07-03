
-- =========================================================
-- INSTITUTES
-- =========================================================
CREATE TABLE public.institutes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  website TEXT,
  gst_number TEXT,
  receipt_prefix TEXT NOT NULL DEFAULT 'REC',
  receipt_next_number INTEGER NOT NULL DEFAULT 1001,
  receipt_footer_text TEXT NOT NULL DEFAULT 'Thank you for your payment.',
  receipt_terms TEXT NOT NULL DEFAULT '',
  receipt_authorized_signatory TEXT NOT NULL DEFAULT 'Authorized Signatory',
  receipt_show_gst BOOLEAN NOT NULL DEFAULT false,
  receipt_show_logo BOOLEAN NOT NULL DEFAULT true,
  receipt_show_footer BOOLEAN NOT NULL DEFAULT true,
  master_standards JSONB NOT NULL DEFAULT '["1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th","11th","12th"]'::jsonb,
  master_boards JSONB NOT NULL DEFAULT '["State Board","CBSE"]'::jsonb,
  master_mediums JSONB NOT NULL DEFAULT '["Marathi","Semi English","English"]'::jsonb,
  master_exam_categories JSONB NOT NULL DEFAULT '["JEE","NEET"]'::jsonb,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.institutes TO authenticated;
GRANT ALL ON public.institutes TO service_role;
ALTER TABLE public.institutes ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- MEMBERSHIP (roles per institute)
-- =========================================================
CREATE TYPE public.member_role AS ENUM ('owner','staff');

CREATE TABLE public.institute_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.member_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institute_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.institute_members TO authenticated;
GRANT ALL ON public.institute_members TO service_role;
ALTER TABLE public.institute_members ENABLE ROW LEVEL SECURITY;

-- Security-definer helpers (avoid recursive RLS on membership table)
CREATE OR REPLACE FUNCTION public.is_member(_institute UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.institute_members
    WHERE institute_id = _institute AND user_id = _user
  );
$$;

CREATE OR REPLACE FUNCTION public.is_owner(_institute UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.institute_members
    WHERE institute_id = _institute AND user_id = _user AND role = 'owner'
  );
$$;

-- Institute policies
CREATE POLICY "Members read their institutes" ON public.institutes
  FOR SELECT TO authenticated
  USING (public.is_member(id, auth.uid()));

CREATE POLICY "Signed-in users can create an institute" ON public.institutes
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owners update their institute" ON public.institutes
  FOR UPDATE TO authenticated
  USING (public.is_owner(id, auth.uid()))
  WITH CHECK (public.is_owner(id, auth.uid()));

CREATE POLICY "Owners delete their institute" ON public.institutes
  FOR DELETE TO authenticated
  USING (public.is_owner(id, auth.uid()));

-- Membership policies
CREATE POLICY "Members read memberships in their institute" ON public.institute_members
  FOR SELECT TO authenticated
  USING (public.is_member(institute_id, auth.uid()));

CREATE POLICY "Owners add members" ON public.institute_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_owner(institute_id, auth.uid()));

CREATE POLICY "Owners update members" ON public.institute_members
  FOR UPDATE TO authenticated
  USING (public.is_owner(institute_id, auth.uid()))
  WITH CHECK (public.is_owner(institute_id, auth.uid()));

CREATE POLICY "Owners remove members or user removes self" ON public.institute_members
  FOR DELETE TO authenticated
  USING (public.is_owner(institute_id, auth.uid()) OR user_id = auth.uid());

-- Auto-add creator as owner when creating an institute
CREATE OR REPLACE FUNCTION public.add_creator_as_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.institute_members (institute_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_institute_created
  AFTER INSERT ON public.institutes
  FOR EACH ROW EXECUTE FUNCTION public.add_creator_as_owner();

-- Shared updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_institutes_updated
  BEFORE UPDATE ON public.institutes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- BATCHES
-- =========================================================
CREATE TABLE public.batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'standard',
  standard TEXT,
  board TEXT,
  medium TEXT,
  exam_category TEXT,
  exam_year INTEGER,
  faculty TEXT,
  monthly_fee NUMERIC NOT NULL DEFAULT 0,
  capacity INTEGER NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  course TEXT,
  strength INTEGER,
  deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.batches (institute_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batches TO authenticated;
GRANT ALL ON public.batches TO service_role;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read batches" ON public.batches
  FOR SELECT TO authenticated USING (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members insert batches" ON public.batches
  FOR INSERT TO authenticated WITH CHECK (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members update batches" ON public.batches
  FOR UPDATE TO authenticated
  USING (public.is_member(institute_id, auth.uid()))
  WITH CHECK (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members delete batches" ON public.batches
  FOR DELETE TO authenticated USING (public.is_member(institute_id, auth.uid()));

CREATE TRIGGER trg_batches_updated
  BEFORE UPDATE ON public.batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- STUDENTS
-- =========================================================
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  roll_no TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  parent_name TEXT,
  parent_phone TEXT,
  email TEXT,
  address TEXT,
  photo TEXT,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  standard TEXT,
  board TEXT,
  medium TEXT,
  exam_category TEXT,
  course_fee NUMERIC NOT NULL DEFAULT 0,
  admission_fee NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  total_fee NUMERIC NOT NULL DEFAULT 0,
  paid_fee NUMERIC NOT NULL DEFAULT 0,
  installments JSONB NOT NULL DEFAULT '[]'::jsonb,
  admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active',
  course TEXT,
  deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.students (institute_id);
CREATE INDEX ON public.students (batch_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read students" ON public.students
  FOR SELECT TO authenticated USING (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members insert students" ON public.students
  FOR INSERT TO authenticated WITH CHECK (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members update students" ON public.students
  FOR UPDATE TO authenticated
  USING (public.is_member(institute_id, auth.uid()))
  WITH CHECK (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members delete students" ON public.students
  FOR DELETE TO authenticated USING (public.is_member(institute_id, auth.uid()));

CREATE TRIGGER trg_students_updated
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- PAYMENTS
-- =========================================================
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  mode TEXT NOT NULL DEFAULT 'Cash',
  receipt_no TEXT NOT NULL,
  note TEXT,
  type TEXT NOT NULL DEFAULT 'fee',
  deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.payments (institute_id);
CREATE INDEX ON public.payments (student_id);
CREATE UNIQUE INDEX payments_institute_receipt_uniq ON public.payments (institute_id, receipt_no);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read payments" ON public.payments
  FOR SELECT TO authenticated USING (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members insert payments" ON public.payments
  FOR INSERT TO authenticated WITH CHECK (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members update payments" ON public.payments
  FOR UPDATE TO authenticated
  USING (public.is_member(institute_id, auth.uid()))
  WITH CHECK (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members delete payments" ON public.payments
  FOR DELETE TO authenticated USING (public.is_member(institute_id, auth.uid()));

CREATE TRIGGER trg_payments_updated
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Atomically allocate the next receipt number (per-institute)
CREATE OR REPLACE FUNCTION public.next_receipt_number(_institute UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _prefix TEXT;
  _n INTEGER;
BEGIN
  IF NOT public.is_member(_institute, auth.uid()) THEN
    RAISE EXCEPTION 'not a member of institute %', _institute;
  END IF;
  UPDATE public.institutes
     SET receipt_next_number = receipt_next_number + 1
   WHERE id = _institute
  RETURNING receipt_prefix, receipt_next_number - 1 INTO _prefix, _n;
  RETURN _prefix || '-' || LPAD(_n::TEXT, 4, '0');
END; $$;
GRANT EXECUTE ON FUNCTION public.next_receipt_number(UUID) TO authenticated;

-- =========================================================
-- RECEIPTS (optional — mirrors payments for printable snapshots)
-- =========================================================
CREATE TABLE public.receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  receipt_no TEXT NOT NULL,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  mode TEXT NOT NULL DEFAULT 'Cash',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.receipts (institute_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipts TO authenticated;
GRANT ALL ON public.receipts TO service_role;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read receipts" ON public.receipts
  FOR SELECT TO authenticated USING (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members insert receipts" ON public.receipts
  FOR INSERT TO authenticated WITH CHECK (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members update receipts" ON public.receipts
  FOR UPDATE TO authenticated
  USING (public.is_member(institute_id, auth.uid()))
  WITH CHECK (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members delete receipts" ON public.receipts
  FOR DELETE TO authenticated USING (public.is_member(institute_id, auth.uid()));

-- =========================================================
-- AUDIT LOGS
-- =========================================================
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  by_user UUID REFERENCES auth.users(id),
  summary TEXT,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.audit_logs (institute_id, at DESC);
GRANT SELECT, INSERT, DELETE ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_member(institute_id, auth.uid()));
