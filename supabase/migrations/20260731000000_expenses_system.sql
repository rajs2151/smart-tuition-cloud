-- Expenses system: server-persisted expenses + categories (replacing
-- localStorage-only src/lib/expenses/store.ts), plus a profitability RPC.
-- Additive only. Does not touch attendance_* or any existing table's
-- existing columns.

-- ---------------------------------------------------------------------
-- expense_categories
-- Per-institute rows (not a shared global table): active/name/group can
-- be customized per institute, and defaults are seeded per institute at
-- creation time (mirrors add_creator_as_owner's trigger mechanism below).
-- `slug` identifies a built-in default category for idempotent seeding
-- and future default-additions; NULL for user-added custom categories.
-- ---------------------------------------------------------------------
CREATE TABLE public.expense_categories (
  id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  slug         TEXT,
  name         TEXT NOT NULL,
  group_name   TEXT NOT NULL,
  active       BOOLEAN NOT NULL DEFAULT true,
  custom       BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institute_id, slug)
);
CREATE INDEX idx_expense_categories_institute ON public.expense_categories (institute_id);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

-- Matches the exact CRUD/RLS convention already used on batches/payments/
-- students: plain is_member() for all four operations, no owner/admin
-- gate at the RLS level (soft-delete/permission nuance is an app-layer
-- concern there today, not enforced in RLS for those tables either).
CREATE POLICY "Members read expense_categories" ON public.expense_categories
  FOR SELECT TO authenticated USING (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members insert expense_categories" ON public.expense_categories
  FOR INSERT TO authenticated WITH CHECK (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members update expense_categories" ON public.expense_categories
  FOR UPDATE TO authenticated
  USING (public.is_member(institute_id, auth.uid()))
  WITH CHECK (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members delete expense_categories" ON public.expense_categories
  FOR DELETE TO authenticated USING (public.is_member(institute_id, auth.uid()));

CREATE TRIGGER trg_expense_categories_updated
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
REVOKE ALL ON public.expense_categories FROM PUBLIC, anon;

-- ---------------------------------------------------------------------
-- Seed default categories on institute creation (mirrors
-- add_creator_as_owner's AFTER INSERT ON institutes trigger mechanism),
-- plus a one-time backfill for institutes that already exist.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_default_expense_categories()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.expense_categories (institute_id, slug, name, group_name)
  VALUES
    (NEW.id, 'teacher_salary',        'Teacher Salary',         'Staff & Operations'),
    (NEW.id, 'admin_staff_salary',    'Admin Staff Salary',     'Staff & Operations'),
    (NEW.id, 'accountant_salary',     'Accountant Salary',      'Staff & Operations'),
    (NEW.id, 'rent',                  'Rent',                   'Infrastructure'),
    (NEW.id, 'electricity_bill',      'Electricity Bill',       'Infrastructure'),
    (NEW.id, 'internet_bill',         'Internet Bill',          'Infrastructure'),
    (NEW.id, 'water_bill',            'Water Bill',             'Infrastructure'),
    (NEW.id, 'maintenance',           'Maintenance',            'Infrastructure'),
    (NEW.id, 'study_material',        'Study Material',         'Academic'),
    (NEW.id, 'books',                 'Books',                  'Academic'),
    (NEW.id, 'printing',              'Printing',               'Academic'),
    (NEW.id, 'photocopy',             'Photocopy',              'Academic'),
    (NEW.id, 'examination_expenses',  'Examination Expenses',   'Academic'),
    (NEW.id, 'advertisement',         'Advertisement',          'Marketing'),
    (NEW.id, 'social_media_marketing','Social Media Marketing', 'Marketing'),
    (NEW.id, 'banners_flex',          'Banners & Flex',         'Marketing'),
    (NEW.id, 'promotional_events',    'Promotional Events',     'Marketing'),
    (NEW.id, 'software_subscription', 'Software Subscription',  'Technology'),
    (NEW.id, 'website_expenses',      'Website Expenses',       'Technology'),
    (NEW.id, 'sms_whatsapp_charges',  'SMS/WhatsApp Charges',   'Technology'),
    (NEW.id, 'transportation',        'Transportation',         'Miscellaneous'),
    (NEW.id, 'refreshments',          'Refreshments',           'Miscellaneous'),
    (NEW.id, 'office_supplies',       'Office Supplies',        'Miscellaneous'),
    (NEW.id, 'miscellaneous',         'Miscellaneous',          'Miscellaneous')
  ON CONFLICT (institute_id, slug) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_institute_created_seed_expense_categories
  AFTER INSERT ON public.institutes
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_expense_categories();

-- One-time backfill for institutes that already exist (the trigger above
-- only fires for institutes created after this migration runs).
INSERT INTO public.expense_categories (institute_id, slug, name, group_name)
SELECT i.id, d.slug, d.name, d.group_name
FROM public.institutes i
CROSS JOIN (VALUES
  ('teacher_salary',        'Teacher Salary',         'Staff & Operations'),
  ('admin_staff_salary',    'Admin Staff Salary',     'Staff & Operations'),
  ('accountant_salary',     'Accountant Salary',      'Staff & Operations'),
  ('rent',                  'Rent',                   'Infrastructure'),
  ('electricity_bill',      'Electricity Bill',       'Infrastructure'),
  ('internet_bill',         'Internet Bill',          'Infrastructure'),
  ('water_bill',            'Water Bill',             'Infrastructure'),
  ('maintenance',           'Maintenance',            'Infrastructure'),
  ('study_material',        'Study Material',         'Academic'),
  ('books',                 'Books',                  'Academic'),
  ('printing',              'Printing',               'Academic'),
  ('photocopy',             'Photocopy',               'Academic'),
  ('examination_expenses',  'Examination Expenses',   'Academic'),
  ('advertisement',         'Advertisement',          'Marketing'),
  ('social_media_marketing','Social Media Marketing', 'Marketing'),
  ('banners_flex',          'Banners & Flex',         'Marketing'),
  ('promotional_events',    'Promotional Events',     'Marketing'),
  ('software_subscription', 'Software Subscription',  'Technology'),
  ('website_expenses',      'Website Expenses',       'Technology'),
  ('sms_whatsapp_charges',  'SMS/WhatsApp Charges',   'Technology'),
  ('transportation',        'Transportation',         'Miscellaneous'),
  ('refreshments',          'Refreshments',           'Miscellaneous'),
  ('office_supplies',       'Office Supplies',        'Miscellaneous'),
  ('miscellaneous',         'Miscellaneous',          'Miscellaneous')
) AS d(slug, name, group_name)
ON CONFLICT (institute_id, slug) DO NOTHING;

-- ---------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------
CREATE TABLE public.expenses (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id    UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  category_id     UUID NOT NULL REFERENCES public.expense_categories(id) ON DELETE RESTRICT,
  date            DATE NOT NULL,
  sub_category    TEXT,
  amount          NUMERIC NOT NULL CHECK (amount > 0),
  mode            TEXT NOT NULL DEFAULT 'Cash'
                    CHECK (mode IN ('Cash', 'UPI', 'Bank Transfer', 'Cheque')),
  vendor          TEXT,
  description     TEXT,
  attachment_name TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES auth.users(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID REFERENCES auth.users(id),
  deleted         BOOLEAN NOT NULL DEFAULT false,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID REFERENCES auth.users(id)
);
CREATE INDEX idx_expenses_institute_date ON public.expenses (institute_id, date);
CREATE INDEX idx_expenses_category ON public.expenses (category_id);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read expenses" ON public.expenses
  FOR SELECT TO authenticated USING (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members insert expenses" ON public.expenses
  FOR INSERT TO authenticated WITH CHECK (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members update expenses" ON public.expenses
  FOR UPDATE TO authenticated
  USING (public.is_member(institute_id, auth.uid()))
  WITH CHECK (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members delete expenses" ON public.expenses
  FOR DELETE TO authenticated USING (public.is_member(institute_id, auth.uid()));

CREATE TRIGGER trg_expenses_updated
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
REVOKE ALL ON public.expenses FROM PUBLIC, anon;

-- ---------------------------------------------------------------------
-- Profitability RPCs.
-- Revenue = payments where NOT deleted AND NOT voided (matches the
-- stricter listPaymentsForBatchInRange definition already used
-- elsewhere in the app, not the current ProfitTab's listPayments(),
-- which omits the voided filter — a deliberate correctness fix, not a
-- silent behavior change; flagged to the requester separately).
-- Expenses = NOT deleted.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_profitability_summary(
  _institute UUID,
  _from DATE,
  _to DATE
)
RETURNS TABLE (
  total_revenue NUMERIC,
  total_expenses NUMERIC,
  net_profit NUMERIC,
  profit_margin_pct NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_member(_institute, auth.uid()) THEN
    RAISE EXCEPTION 'not a member of institute %', _institute;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(rev.total, 0)::numeric AS total_revenue,
    COALESCE(exp.total, 0)::numeric AS total_expenses,
    (COALESCE(rev.total, 0) - COALESCE(exp.total, 0))::numeric AS net_profit,
    CASE WHEN COALESCE(rev.total, 0) = 0 THEN 0::numeric
         ELSE ROUND(((COALESCE(rev.total, 0) - COALESCE(exp.total, 0)) / rev.total) * 100, 2)
    END AS profit_margin_pct
  FROM
    (SELECT SUM(amount) AS total FROM public.payments
     WHERE institute_id = _institute AND NOT deleted AND NOT voided
       AND date >= _from AND date <= _to) rev,
    (SELECT SUM(amount) AS total FROM public.expenses
     WHERE institute_id = _institute AND NOT deleted
       AND date >= _from AND date <= _to) exp;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_expense_breakdown_by_category(
  _institute UUID,
  _from DATE,
  _to DATE
)
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  group_name TEXT,
  total_amount NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_member(_institute, auth.uid()) THEN
    RAISE EXCEPTION 'not a member of institute %', _institute;
  END IF;

  RETURN QUERY
  SELECT
    c.id AS category_id,
    c.name AS category_name,
    c.group_name,
    SUM(e.amount)::numeric AS total_amount
  FROM public.expenses e
  JOIN public.expense_categories c ON c.id = e.category_id
  WHERE e.institute_id = _institute AND NOT e.deleted
    AND e.date >= _from AND e.date <= _to
  GROUP BY c.id, c.name, c.group_name
  ORDER BY total_amount DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_profitability_summary(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_expense_breakdown_by_category(UUID, DATE, DATE) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_profitability_summary(UUID, DATE, DATE) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_expense_breakdown_by_category(UUID, DATE, DATE) FROM PUBLIC, anon;
