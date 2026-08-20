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

From the project root (with Supabase CLI logged in and linked):

```bash
supabase db push
```

Required migrations that may still be pending on production:

- `20260814000000_message_templates_and_comm_logs.sql`
- `20260814230000_follow_up_threshold.sql`
- `20260820120000_is_member_requires_active_access.sql` (disabled-member RLS fix)

After push, verify grants:

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
