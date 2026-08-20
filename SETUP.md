# Setup Guide

This guide takes you from a fresh `git clone` to a running app with a real
institute, real students, and real payments — assuming no prior knowledge of
this project, Supabase, or TanStack Start.

---

## 1. Prerequisites

- **Node.js** — no version is pinned anywhere in this repo: no `engines`
  field in `package.json`, no `.nvmrc`, no `.node-version`, and no CI
  workflow file exists yet to infer one from (see Known Gotchas below).
  Confirmed by checking all of these directly, not assumed absent. If
  you're setting this up for the first time, use whatever recent LTS
  Node version you have — but if you're the project owner, worth pinning
  an actual tested version somewhere (an `.nvmrc` is the easiest fix) so
  this stops being a guess for the next person.
- **npm** — the only lockfile actually committed is `package-lock.json`.
  An earlier version of this guide claimed bun was "also supported"; no
  `bun.lockb` exists anywhere in the repo to back that up, so that claim
  is removed here rather than repeated unverified. Use `npm`.
- A **Supabase account** — free at [supabase.com](https://supabase.com)
- Optionally, the **Supabase CLI**, if you want to apply migrations from your
  terminal instead of pasting SQL into the dashboard:
  ```bash
  npm install -g supabase
  ```

---

## 2. Clone and install

```bash
git clone https://github.com/rajs2151/smart-tuition-cloud.git
cd smart-tuition-cloud
npm install
```

---

## 3. Create a Supabase project

1. Go to <https://supabase.com/dashboard/new> and create a new project.
   Pick any name/region; the free tier is enough for development.
2. Wait for it to finish provisioning (a minute or two).
3. Once it's ready, go to **Project Settings → API**. You'll need two values
   from this page in step 5:
   - **Project URL** (looks like `https://xxxxxxxx.supabase.co`)
   - **`anon` `public` key** (a long JWT-looking string, under **Project API
     keys**)
4. Also note your **project ref** — it's the `xxxxxxxx` part of the URL
   above, and is shown at the top of most dashboard pages.

Copy [`.env.example`](.env.example) to `.env` and fill those values. Never
commit `.env` (it is gitignored).

---

## 4. Apply the database schema

The entire schema lives in `supabase/migrations/`, as plain, version-controlled
SQL files. There are two ways to apply them — pick whichever you're more
comfortable with.

### Option A — Supabase CLI (recommended)

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

`supabase db push` applies every file in `supabase/migrations/` that hasn't
been applied yet, in filename (timestamp) order. On a brand-new project, all
of them run.

### Option B — SQL Editor (no CLI needed)

1. Open your project's **SQL Editor** in the Supabase dashboard.
2. Open each file in `supabase/migrations/` **in filename order** (oldest
   timestamp first — check the file list to confirm the current order, as
   more may have been added since this guide was written) and paste-run its
   full contents, one file at a time.

Either way, when you're done you should see 11 tables under **Table Editor**:
`institutes`, `institute_members`, `batches`, `students`, `payments`,
`receipts`, `audit_logs`, `attendance_sessions`, `attendance_absences`,
`expense_categories`, `expenses`. There are 16 migration files as of this
writing, spanning `20260703064918_...` through `20260731000000_...` — check
`supabase/migrations/` directly for the current count/range, since more may
have been added since this guide was last updated.

---

## 5. Configure your `.env`

**This repo has no `.env.example` file** — confirmed by checking, not assumed
absent. What's below is the complete, real list, read directly from
`src/integrations/supabase/client.ts` rather than guessed:

Create a `.env` file at the repo root:

```bash
SUPABASE_URL="https://<your-project-ref>.supabase.co"
SUPABASE_PUBLISHABLE_KEY="<your anon/public key>"
VITE_SUPABASE_URL="https://<your-project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<your anon/public key>"
```

Both the `VITE_`-prefixed and plain versions of each variable are required —
the `VITE_*` ones are read by the browser bundle, the plain ones by
server-side code (`client.ts` falls back to the plain name if the `VITE_`
one isn't set). They should have identical values. That's the complete list
of variables the app actually needs to start and run — two logical values,
four env var names.

**Not currently required:** `SUPABASE_SERVICE_ROLE_KEY` is documented in
`.env.example` for future server-only admin work. The previous unused
`client.server.ts` / `auth-middleware.ts` scaffolding was removed so it
cannot accidentally ship a service-role key into a client bundle. Do not
add a `VITE_`-prefixed service role variable.

> **Note on committing `.env`:** `.env` is gitignored; commit `.env.example`
> only. The anon/public key is designed to be client-visible, but keeping
> `.env` out of git still prevents accidental addition of secrets later.

---

## 6. Confirm your Supabase Auth settings

In your new project's dashboard:

1. **Authentication → Providers → Email** — should be enabled by default.
   Decide whether you want **"Confirm email"** on or off:
   - **On** (default): new sign-ups get a confirmation email before they can
     sign in.
   - **Off**: simpler for local development/demos — sign-up immediately
     signs the user in.
2. **Authentication → URL Configuration** — set **Site URL** to
   `http://localhost:3000` (or whatever port `npm run dev` uses) for local
   development. You'll add your real deployment URL here later when you
   deploy.

No OAuth provider setup (Google, etc.) is needed — this app uses email and
password only.

---

## 7. Run the app

```bash
npm run dev
```

Open the URL it prints (typically `http://localhost:3000`). You should see
a sign-in/sign-up form — not a Google button, not a blank page.

---

## 8. Create your first account and institute

1. Click **"Create an account"**, enter any email and a password (6+
   characters), and submit.
   - If you left "Confirm email" **on** in step 6, check that inbox (or the
     Supabase dashboard's **Authentication → Users** page, which shows
     unconfirmed users) and click the confirmation link before continuing.
2. You'll land on **"Set up your institute"** — fill in a name and submit.
3. You should land directly on the dashboard. This only ever happens once —
   signing out and back in with the same account goes straight to the
   dashboard from now on.

---

## 9. (Optional) Load realistic demo data

Instead of starting from a completely empty dashboard, you can load a demo
institute with sample batches, students, and payments:

1. Create **two** accounts via the sign-up form (or Supabase Dashboard →
   Authentication → Users → "Add user"): one you'll use as the demo owner,
   one as demo staff. Any emails/passwords work.
2. In the dashboard, find each user's **User UID** (Authentication → Users →
   click the user).
3. Open `supabase/seed.sql`, and replace the two placeholder UUIDs
   (`demo_owner_id`, `demo_staff_id`) near the top with the real UUIDs from
   step 2.
4. Run the file — either via the SQL Editor (paste & run) or the CLI:
   ```bash
   supabase db execute -f supabase/seed.sql
   ```
5. Sign in as the demo owner account — you'll see "Dnyanpeeth Classes" with
   2 batches, 5 students, and 3 payments already there.

See the comment block at the top of `supabase/seed.sql` for more detail,
including why it deliberately doesn't create the Auth accounts for you.

---

## Known Gotchas

Three things worth knowing before you're deep into this project, each drawn
from a real incident already documented elsewhere in this repo — not
hypothetical warnings.

**Grant/RLS convention — don't trust a migration's SQL by itself.** Postgres
grants some privileges to `PUBLIC` by default unless explicitly revoked,
which isn't obvious from reading a `CREATE TABLE`/`CREATE FUNCTION`
statement alone. This project's convention: every new table gets
`REVOKE ALL ... FROM PUBLIC, anon` in the *same* migration that creates it;
every new `SECURITY DEFINER` RPC gets an explicit `is_member()` guard inside
the function body (RLS does not apply inside a `SECURITY DEFINER`
function — it runs as the function owner) plus
`GRANT EXECUTE ... TO authenticated` with `PUBLIC`/`anon` explicitly
revoked. Verify via `information_schema.routine_privileges` /
`information_schema.role_table_grants` directly before considering any
migration done — the attendance system's first migration looked correct on
read but actually left `PUBLIC`/`anon` with `EXECUTE` on both its RPCs,
caught only by that direct query. Full history in `KNOWN_ISSUES.md` and
`docs/backend-architecture.md`.

**Two `institutes` rows share the name "Dnyanpeeth Classes."** Found during
the Expenses system's institute backfill
(`5577d52e-84da-4272-8f58-c621cf115c63` and
`ca9b2db1-3a4d-4f38-ba97-f716598bb86b`) — not a seeding bug, both rows
correctly got their full set of default categories. Unresolved pending the
account owner confirming whether this is intentional. If you're building
anything that assumes institute names are unique, they currently aren't.
See `KNOWN_ISSUES.md`.

**Don't assume a merge auto-deployed correctly — confirm the commit hash.**
This project had a real incident where a Vercel dashboard rollback (done to
escape one disputed change) silently took a set of unrelated, already-merged
fixes back out with it, because the rollback targeted a deployment that
predated them. The fix wasn't guessing — it was checking GitHub's
Deployments API directly to confirm which commit was actually live in
Production and whether that deployment's status was really `success`. If
something you just merged "isn't showing up," check that before assuming
your code is wrong. Full incident writeup in `docs/HANDOVER.md`'s Session 4.

---

## Troubleshooting

**Stuck on "Set up your institute" even after creating one:** almost always
means the browser has a stale session — try signing out and back in. If it
persists, check the Supabase dashboard's **Logs → Postgres Logs** for a
`permission denied` error, which would indicate a grant/RLS misconfiguration
rather than an app bug (see `docs/backend-architecture.md` for the schema's
expected grants).

**"Unsupported provider" or similar auth error:** this app uses email/password
only — if you see an OAuth-related error, you're likely running an older
version of the code before that switch; check you're on the latest `main`.

**Build fails with a Vite/env error:** double-check all 4 variables from
step 5 are present in `.env` and that you restarted `npm run dev` after
creating/editing it (Vite only reads `.env` at startup).

---

## Where to go next

- `docs/backend-architecture.md` — full backend/auth architecture reference
- `BACKUP.md` — how to export and restore this database
- `CUTOVER.md` — history of the most recent Supabase project migration, if
  you need context on how this project's Supabase backend has changed
