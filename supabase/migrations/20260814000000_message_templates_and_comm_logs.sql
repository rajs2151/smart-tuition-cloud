-- Messaging templates + comm logs: server-persist what was previously
-- localStorage-only (src/lib/messaging/store.ts, key vidyafee.messaging.v1).
-- Same class of data-residency risk as the expenses localStorage incident.
-- Additive only. No UPDATE/DELETE of existing student/payment/institute rows.

-- ---------------------------------------------------------------------
-- message_templates
-- Per-institute rows. Built-ins identified by slug (tpl_friendly, …);
-- custom templates have slug NULL. Soft-delete matches students/payments/
-- batches/expenses.
-- ---------------------------------------------------------------------
CREATE TABLE public.message_templates (
  id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  slug         TEXT,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL
                 CHECK (category IN ('reminder', 'acknowledgement', 'admission', 'attendance', 'general')),
  sub_type     TEXT,
  language     TEXT NOT NULL DEFAULT 'English'
                 CHECK (language IN ('English', 'Marathi', 'Hinglish')),
  content      TEXT NOT NULL,
  built_in     BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted      BOOLEAN NOT NULL DEFAULT false,
  deleted_at   TIMESTAMPTZ,
  deleted_by   UUID REFERENCES auth.users(id),
  UNIQUE (institute_id, slug)
);
CREATE INDEX idx_message_templates_institute ON public.message_templates (institute_id);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read message_templates" ON public.message_templates
  FOR SELECT TO authenticated USING (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members insert message_templates" ON public.message_templates
  FOR INSERT TO authenticated WITH CHECK (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members update message_templates" ON public.message_templates
  FOR UPDATE TO authenticated
  USING (public.is_member(institute_id, auth.uid()))
  WITH CHECK (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members delete message_templates" ON public.message_templates
  FOR DELETE TO authenticated USING (public.is_member(institute_id, auth.uid()));

CREATE TRIGGER trg_message_templates_updated
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
REVOKE ALL ON public.message_templates FROM PUBLIC, anon;

-- ---------------------------------------------------------------------
-- message_template_defaults
-- One default template id per category (reminder/ack/admission/attendance).
-- ---------------------------------------------------------------------
CREATE TABLE public.message_template_defaults (
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  category     TEXT NOT NULL
                 CHECK (category IN ('reminder', 'acknowledgement', 'admission', 'attendance')),
  template_id  UUID NOT NULL REFERENCES public.message_templates(id) ON DELETE RESTRICT,
  PRIMARY KEY (institute_id, category)
);

ALTER TABLE public.message_template_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read message_template_defaults" ON public.message_template_defaults
  FOR SELECT TO authenticated USING (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members insert message_template_defaults" ON public.message_template_defaults
  FOR INSERT TO authenticated WITH CHECK (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members update message_template_defaults" ON public.message_template_defaults
  FOR UPDATE TO authenticated
  USING (public.is_member(institute_id, auth.uid()))
  WITH CHECK (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members delete message_template_defaults" ON public.message_template_defaults
  FOR DELETE TO authenticated USING (public.is_member(institute_id, auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_template_defaults TO authenticated;
GRANT ALL ON public.message_template_defaults TO service_role;
REVOKE ALL ON public.message_template_defaults FROM PUBLIC, anon;

-- ---------------------------------------------------------------------
-- comm_logs — append-only send history. Client never DELETEs.
-- markLogPaid is an UPDATE of payment_received_after on reminder rows.
-- ---------------------------------------------------------------------
CREATE TABLE public.comm_logs (
  id                      UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id            UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  student_id              TEXT,
  student_name            TEXT NOT NULL,
  mobile                  TEXT NOT NULL DEFAULT '',
  template_id             UUID REFERENCES public.message_templates(id) ON DELETE SET NULL,
  template_name           TEXT NOT NULL,
  category                TEXT NOT NULL
                            CHECK (category IN ('reminder', 'acknowledgement', 'admission', 'attendance', 'general')),
  message                 TEXT NOT NULL,
  sent_by                 TEXT NOT NULL DEFAULT '',
  payment_received_after  BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_comm_logs_institute_created ON public.comm_logs (institute_id, created_at DESC);
CREATE INDEX idx_comm_logs_student ON public.comm_logs (institute_id, student_id);

ALTER TABLE public.comm_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read comm_logs" ON public.comm_logs
  FOR SELECT TO authenticated USING (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members insert comm_logs" ON public.comm_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members update comm_logs" ON public.comm_logs
  FOR UPDATE TO authenticated
  USING (public.is_member(institute_id, auth.uid()))
  WITH CHECK (public.is_member(institute_id, auth.uid()));
CREATE POLICY "Members delete comm_logs" ON public.comm_logs
  FOR DELETE TO authenticated USING (public.is_member(institute_id, auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comm_logs TO authenticated;
GRANT ALL ON public.comm_logs TO service_role;
REVOKE ALL ON public.comm_logs FROM PUBLIC, anon;

-- ---------------------------------------------------------------------
-- Seed built-in templates + defaults on institute creation, plus a
-- one-time INSERT backfill for institutes that already exist.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_default_message_templates(_institute uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.message_templates (
    institute_id, slug, name, category, sub_type, language, content, built_in
  )
  VALUES
    (_institute, 'tpl_friendly', 'Friendly Reminder', 'reminder', 'friendly', 'English',
$tpl$Dear {{ParentName}},

This is a friendly reminder that the fee payment for {{StudentName}} ({{BatchName}}) is pending.

Total Fee: ₹{{TotalFee}}
Amount Paid: ₹{{PaidAmount}}
Pending Amount: ₹{{PendingAmount}}

Kindly make the payment at your earliest convenience.

Thank you,
{{InstituteName}}$tpl$, true),
    (_institute, 'tpl_due_date', 'Due Date Reminder', 'reminder', 'due', 'English',
$tpl$Dear {{ParentName}},

The next fee installment for {{StudentName}} is due on {{DueDate}}.

Pending Amount: ₹{{PendingAmount}}

Please make the payment on or before the due date.

Regards,
{{InstituteName}}$tpl$, true),
    (_institute, 'tpl_high', 'High Priority Reminder (>50% Pending)', 'reminder', 'high', 'English',
$tpl$Dear {{ParentName}},

The fee payment for {{StudentName}} ({{BatchName}}) is significantly overdue.

Pending Amount: ₹{{PendingAmount}}

Kindly clear the outstanding amount at the earliest to avoid interruption of classes.

For assistance, please contact us on {{InstituteContact}}.

Regards,
{{InstituteName}}$tpl$, true),
    (_institute, 'tpl_final', 'Final Reminder', 'reminder', 'final', 'English',
$tpl$Dear {{ParentName}},

This is the FINAL reminder regarding the pending fee amount of ₹{{PendingAmount}} for {{StudentName}}.

Please arrange the payment immediately to continue uninterrupted classes.

Regards,
{{InstituteName}}$tpl$, true),
    (_institute, 'tpl_overdue', 'Overdue Fee Reminder', 'reminder', 'overdue', 'English',
$tpl$Dear {{ParentName}},

The fee for {{StudentName}} is overdue since {{DueDate}}.

Pending Amount: ₹{{PendingAmount}}

Kindly clear the dues at your earliest.

Regards,
{{InstituteName}}$tpl$, true),
    (_institute, 'tpl_ack_full', 'Full Payment Received', 'acknowledgement', 'full', 'English',
$tpl$Dear {{ParentName}},

We have successfully received the full fee payment of ₹{{PaidAmount}} for {{StudentName}}.

Receipt Number: {{ReceiptNumber}}
Date: {{PaymentDate}}

Thank you for your payment.

Regards,
{{InstituteName}}$tpl$, true),
    (_institute, 'tpl_ack_partial', 'Partial Payment Received', 'acknowledgement', 'partial', 'English',
$tpl$Dear {{ParentName}},

We have received a payment of ₹{{PaidAmount}} towards the fees of your child, {{StudentName}}.

Receipt Number: {{ReceiptNumber}}
Date: {{PaymentDate}}
Remaining Balance: ₹{{PendingAmount}}

Thank you for your payment.

Regards,
{{InstituteName}}$tpl$, true),
    (_institute, 'tpl_ack_admission', 'Admission Fee Received', 'acknowledgement', 'admission', 'English',
$tpl$Dear {{ParentName}},

We have received the admission fee of ₹{{PaidAmount}} for {{StudentName}}.

Receipt Number: {{ReceiptNumber}}
Date: {{PaymentDate}}

Welcome to {{InstituteName}}!$tpl$, true),
    (_institute, 'tpl_ack_installment', 'Installment Received', 'acknowledgement', 'installment', 'English',
$tpl$Dear {{ParentName}},

Installment of ₹{{PaidAmount}} received for {{StudentName}}.

Receipt: {{ReceiptNumber}} · Date: {{PaymentDate}}
Remaining Balance: ₹{{PendingAmount}}

Thank you,
{{InstituteName}}$tpl$, true),
    (_institute, 'tpl_adm_confirm', 'Admission Confirmation', 'admission', 'confirmation', 'English',
$tpl$Dear {{ParentName}},

The admission of {{StudentName}} to {{BatchName}} ({{Standard}} · {{Board}}) is confirmed.

Total Fee: ₹{{TotalFee}}

Welcome to {{InstituteName}}!$tpl$, true),
    (_institute, 'tpl_adm_welcome', 'Welcome Message', 'admission', 'welcome', 'English',
$tpl$Dear {{StudentName}},

Welcome to {{InstituteName}}! Your batch {{BatchName}} is all set.

For any queries please reach us at {{InstituteContact}}.$tpl$, true),
    (_institute, 'tpl_adm_batch', 'Batch Allocation Confirmation', 'admission', 'batch', 'English',
$tpl$Dear {{ParentName}},

{{StudentName}} has been allocated to {{BatchName}} ({{Medium}}).

Regards,
{{InstituteName}}$tpl$, true),
    (_institute, 'tpl_att_absence_en', 'Absence Notice (English)', 'attendance', 'absence', 'English',
$tpl$Dear Parent,

Your child {{StudentName}} ({{BatchName}}) was absent from class today, {{AttendanceDate}}.

Regards,
{{InstituteName}}$tpl$, true),
    (_institute, 'tpl_att_absence_mr', 'Absence Notice (Marathi)', 'attendance', 'absence', 'Marathi',
$tpl$प्रिय पालक,

आपला पाल्य {{StudentName}} ({{BatchName}}) आज दिनांक {{AttendanceDate}} रोजी वर्गात अनुपस्थित होता/होती.

आपले,
{{InstituteName}}$tpl$, true),
    (_institute, 'tpl_gen_holiday', 'Holiday Notice', 'general', 'holiday', 'English',
$tpl$Dear Parents,

Please note {{InstituteName}} will remain closed on {{DueDate}}.

Regular classes will resume the next working day.$tpl$, true),
    (_institute, 'tpl_gen_exam', 'Exam Notice', 'general', 'exam', 'English',
$tpl$Dear {{ParentName}},

The next assessment for {{StudentName}} ({{BatchName}}) is scheduled on {{DueDate}}.

Regards,
{{InstituteName}}$tpl$, true),
    (_institute, 'tpl_gen_schedule', 'Batch Schedule Update', 'general', 'schedule', 'English',
$tpl$Dear Parents,

There is an update in the schedule of {{BatchName}}. Please contact us on {{InstituteContact}} for details.

Regards,
{{InstituteName}}$tpl$, true),
    (_institute, 'tpl_gen_announce', 'General Announcement', 'general', 'announcement', 'English',
$tpl$Dear Parents,

[Your announcement here]

Regards,
{{InstituteName}}$tpl$, true)
  ON CONFLICT (institute_id, slug) DO NOTHING;

  INSERT INTO public.message_template_defaults (institute_id, category, template_id)
  SELECT _institute, d.category, t.id
  FROM (VALUES
    ('reminder', 'tpl_friendly'),
    ('acknowledgement', 'tpl_ack_partial'),
    ('admission', 'tpl_adm_confirm'),
    ('attendance', 'tpl_att_absence_en')
  ) AS d(category, slug)
  JOIN public.message_templates t
    ON t.institute_id = _institute AND t.slug = d.slug AND NOT t.deleted
  ON CONFLICT (institute_id, category) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_default_message_templates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_default_message_templates(uuid) TO postgres, service_role;

CREATE OR REPLACE FUNCTION public.trg_seed_default_message_templates()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.seed_default_message_templates(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_seed_default_message_templates() FROM PUBLIC, anon;

CREATE TRIGGER trg_institute_created_seed_message_templates
  AFTER INSERT ON public.institutes
  FOR EACH ROW EXECUTE FUNCTION public.trg_seed_default_message_templates();

-- One-time INSERT backfill for institutes that already exist.
DO $$
DECLARE
  inst record;
BEGIN
  FOR inst IN SELECT id FROM public.institutes LOOP
    PERFORM public.seed_default_message_templates(inst.id);
  END LOOP;
END $$;
