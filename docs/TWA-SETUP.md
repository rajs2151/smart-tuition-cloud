# Vidyafee TWA / Android packaging checklist

Use this after the production web app is deployed on HTTPS.

## 1. Web app manifest (done in repo)

- Served at `/manifest.webmanifest`
- Icons at `/icons/icon-192.png` and `/icons/icon-512.png`
- Linked from the document head in `src/routes/__root.tsx`

Replace the solid teal placeholders with brand artwork before Play Store listing if you want a custom look.

## 2. Digital Asset Links

File: `public/.well-known/assetlinks.json` (must be served at
`https://YOUR_DOMAIN/.well-known/assetlinks.json` with `Content-Type: application/json`).

1. Create the Android package (Bubblewrap / Android Studio).
2. Put the real `package_name` in `assetlinks.json`.
3. Put the **SHA-256** of the signing cert (Play App Signing cert if published via Play Console).
4. Redeploy so the live origin serves the updated file.
5. Verify: <https://developers.google.com/digital-asset-links/tools/generator>

## 3. Pending Supabase migrations (blocker until applied)

> ⚠️ **`supabase db push` is UNUSABLE against production right now.**
> Production's migration history does not match the repo. Do NOT run
> `db push`, `db push --dry-run`, or `migration repair` against production
> under any circumstances until the history has been fully reconciled and
> reviewed. See [`KNOWN_ISSUES.md`](../KNOWN_ISSUES.md) →
> "`supabase db push` Is Unusable Against Production".
>
> Also do NOT apply `20260820120000_is_member_requires_active_access.sql`
> until PR #30 (the `is_member` / `is_owner` grant fix) has merged.

Apply each file by hand in the Supabase SQL editor, one file at a time, in
filename order. Before and after each file, check the objects it touches
with `pg_proc` / `information_schema` and confirm only the expected change
landed.

Required migrations that may still be pending on production:

- `20260814000000_message_templates_and_comm_logs.sql`
- `20260814230000_follow_up_threshold.sql`
- `20260820120000_is_member_requires_active_access.sql` (disabled-member RLS fix)

After each file, verify grants:

```sql
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('message_templates', 'comm_logs', 'message_template_defaults');
```

`anon` / `PUBLIC` should not have table privileges; `authenticated` should.

## 4. Bubblewrap sketch

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://YOUR_DOMAIN/manifest.webmanifest
bubblewrap build
```

Test WhatsApp opens and session resume on a real device before Play upload.
