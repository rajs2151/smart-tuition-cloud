-- Receipt Contact Details: per-institute overrides for phone/email/website
-- shown on receipts, independent from the Institute tab's own values.
--
-- Design notes:
--   * All three columns are nullable text with no default. A NULL/empty
--     value means "use the Institute tab's value" — there is no separate
--     boolean flag to keep in sync, so there's nothing new to migrate for
--     existing institutes and no way for the two to drift out of sync.
--   * receipt_phone_override stores multiple numbers as a single
--     comma/newline-separated string (matching how the UI accepts them),
--     parsed for display at render time — no new table, no array column.
--   * Existing institutes: all three columns come in as NULL, so every
--     existing receipt renders from institutes.phone / .email / .website
--     exactly as it did before this migration.

alter table public.institutes
  add column if not exists receipt_phone_override text,
  add column if not exists receipt_email_override text,
  add column if not exists receipt_website_override text;

comment on column public.institutes.receipt_phone_override is
  'Optional override for the phone number(s) shown on receipts. Comma/newline-separated. NULL = use institutes.phone.';
comment on column public.institutes.receipt_email_override is
  'Optional override for the email shown on receipts. NULL = use institutes.email.';
comment on column public.institutes.receipt_website_override is
  'Optional override for the website shown on receipts. NULL = use institutes.website.';
