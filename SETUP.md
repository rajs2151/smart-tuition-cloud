# Setup Guide

This guide takes you from a fresh `git clone` to a running app with a real
institute, real students, and real payments — assuming no prior knowledge of
this project, Supabase, or TanStack Start.

---

## 1. Prerequisites

- **Node.js 20+** and **npm** (or `bun`, if you prefer — both are supported)
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

Either way, when you're done you should see 7 tables under **Table Editor**:
`institutes`, `institute_members`, `batches`, `students`, `payments`,
`receipts`, `audit_logs`.

---

## 5. Configure your `.env`

Create a `.env` file at the repo root (copy the format below, filling in your
own values from step 3):

```bash
SUPABASE_PROJECT_ID="<your-project-ref>"
SUPABASE_PUBLISHABLE_KEY="<your anon/public key>"
SUPABASE_URL="https://<your-project-ref>.supabase.co"
VITE_SUPABASE_PROJECT_ID="<your-project-ref>"
VITE_SUPABASE_PUBLISHABLE_KEY="<your anon/public key>"
VITE_SUPABASE_URL="https://<your-project-ref>.supabase.co"
```

Both the `VITE_`-prefixed and plain versions of each variable are required —
the `VITE_*` ones are read by the browser bundle, the plain ones by
server-side code. They should have identical values.

> **Note on committing `.env`:** the anon/public key and project URL are
> designed by Supabase to be safe to expose client-side — every visitor to
> your deployed app receives them anyway, in their browser's network tab.
> They are **not** a secret in the way a password or the service-role key
> is. That said, the normal convention is still to keep `.env` out of git
> (add it to `.gitignore`) and commit an `.env.example` with placeholder
> values instead, so rotating a key later doesn't require touching tracked
> files. This repo does not currently follow that convention — worth
> adopting if you fork or extend this project.

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

**Build fails with a Vite/env error:** double-check all 6 variables from
step 5 are present in `.env` and that you restarted `npm run dev` after
creating/editing it (Vite only reads `.env` at startup).

---

## Where to go next

- `docs/backend-architecture.md` — full backend/auth architecture reference
- `BACKUP.md` — how to export and restore this database
- `CUTOVER.md` — history of the most recent Supabase project migration, if
  you need context on how this project's Supabase backend has changed
