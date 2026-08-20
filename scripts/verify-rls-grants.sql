#!/usr/bin/env bash
# Spot-check that anon/PUBLIC do not retain table privileges on tenant tables.
# Run against a linked project after `supabase db push`:
#   supabase db execute --file scripts/verify-rls-grants.sql
# Or paste into the Supabase SQL Editor.

SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'students', 'payments', 'batches', 'attendance_sessions', 'expenses',
    'message_templates', 'comm_logs', 'message_template_defaults'
  )
  AND grantee IN ('anon', 'PUBLIC')
ORDER BY table_name, grantee;
-- Expect: zero rows.
