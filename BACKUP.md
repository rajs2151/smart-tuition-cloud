# Backup & Restore

This project's entire schema is defined as version-controlled SQL in
`supabase/migrations/`, so **the schema itself is never at risk** — it can
always be rebuilt from scratch by applying those files to any new Supabase
project (see `SETUP.md`). This guide is about the **data**: institutes,
students, payments, etc. that accumulate once the app is actually in use.

There are three separate things worth backing up, and they need different
approaches:

1. **Schema** — already safe, see above. Not covered further here.
2. **Application data** (`public.*` tables) — covered below.
3. **Auth users** (`auth.users`, managed entirely by Supabase) — covered
   below, with an important caveat.

---

## Option A — Supabase's own automatic backups (easiest, no setup)

Every Supabase project gets daily backups automatically, retained for a
period that depends on your plan (Free/Pro/Team — check **Project Settings →
Add-ons → Backups** in your dashboard for exact retention and any
point-in-time recovery options available on your plan).

**To restore from one:** dashboard → **Database → Backups** → pick a backup
→ restore. This is a full project-level restore (schema + data + auth),
handled entirely by Supabase's infrastructure — no local tooling needed.

This is the right choice for "something went wrong, roll back to last
night" scenarios. It is **not** a good fit for "I want a local copy of
production data on my laptop" or "I want to move data to a different
project" — for those, use Option B or C below.

---

## Option B — Manual export via the Supabase CLI

This gives you a portable `.sql` file you control, independent of Supabase's
own backup retention.

### Exporting

```bash
supabase login
supabase link --project-ref <your-project-ref>

# Schema only (should already match supabase/migrations/, but useful to
# confirm the live project hasn't drifted from what's in git):
supabase db dump -f schema-backup.sql

# Data only, application tables:
supabase db dump -f data-backup.sql --data-only
```

Store these `.sql` files somewhere safe (not committed to git — they'll
contain real user data). A timestamped filename
(`data-backup-2026-07-09.sql`) is good practice if you're doing this
manually/periodically rather than automating it.

### Restoring

Against a **fresh** project (schema not yet applied): apply migrations
first (see `SETUP.md`), then load the data:

```bash
psql "$(supabase db url)" -f data-backup.sql
```

Against the **same** project you exported from (e.g. undoing a mistake):
back up current state first, then:

```bash
psql "$(supabase db url)" -f data-backup.sql
```

`supabase db url` prints the project's connection string; you can also get
this from **Project Settings → Database → Connection string** in the
dashboard.

---

## Option C — Direct `pg_dump` / `pg_restore` (most control)

Useful if you want a compressed, selectively-restorable backup, or need to
back up from a script/CI job without the Supabase CLI installed.

### Exporting

```bash
# Get your connection string from Project Settings → Database in the dashboard.
pg_dump "postgresql://postgres:[PASSWORD]@db.<project-ref>.supabase.co:5432/postgres" \
  --schema=public \
  --data-only \
  --format=custom \
  --file=backup.dump
```

`--format=custom` produces a compressed file that `pg_restore` can restore
selectively (single table, etc.) — more flexible than plain `.sql` for large
datasets.

### Restoring

```bash
pg_restore \
  --dbname="postgresql://postgres:[PASSWORD]@db.<project-ref>.supabase.co:5432/postgres" \
  --data-only \
  --disable-triggers \
  backup.dump
```

`--disable-triggers` is important here: without it,
`trg_institute_created_add_owner` would fire again for every restored
`institutes` row and attempt to re-insert an owner membership that (in a
data-only restore into the *same* project) already exists — normally
harmless since it's `ON CONFLICT DO NOTHING`, but disabling triggers during
a restore is standard practice to avoid any trigger side-effects firing
during bulk data loads, and to restore faster.

---

## A note on `auth.users`

Supabase manages the `auth.users` (and related `auth.identities`,
`auth.sessions`, etc.) tables itself — they're regular Postgres tables under
the hood, so both `pg_dump` and `supabase db dump` **can** capture them if
you don't restrict to `--schema=public`. However:

- Password hashes, MFA secrets, and session tokens are sensitive — treat any
  backup that includes the `auth` schema with the same care as production
  credentials (encrypt at rest, restrict access, don't commit to git).
- Restoring `auth` schema data into a **different** project than it came
  from is fragile — GoTrue (Supabase's auth service) may have
  version-specific expectations about that schema's exact shape that can
  differ between projects created at different times (this is the same
  reason `supabase/seed.sql` in this repo deliberately avoids
  auto-creating fake auth users — see the comment block at the top of that
  file).
- For most purposes, **Option A (Supabase's own dashboard restore)** is the
  safest way to recover `auth.users` data specifically, since it's a
  same-project, same-GoTrue-version restore performed by Supabase's own
  infrastructure rather than a manual cross-project data load.

**Recommendation:** for full disaster recovery (schema + data + auth,
same project), rely on Option A. For portable, cross-project backups of
just your application data (institutes/students/payments/etc.), use
Option B or C, scoped to `--schema=public`, and treat `auth.users` recovery
as a separate concern handled by Supabase's own backups.

---

## Verifying a restore worked

After any restore, a quick sanity check:

```sql
select
  (select count(*) from public.institutes) as institutes,
  (select count(*) from public.institute_members) as memberships,
  (select count(*) from public.students) as students,
  (select count(*) from public.payments) as payments;
```

Run this in the SQL Editor and compare against what you expect. If
`institutes` and `institute_members` counts look right but the app still
shows "Set up your institute" for an existing owner after a restore, check
that RLS grants are intact — see the grant-bug writeup in `CUTOVER.md` for
an example of exactly this kind of issue (a schema/permissions mismatch
that has nothing to do with the data itself).
