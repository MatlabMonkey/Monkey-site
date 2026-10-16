# PIN and Browser Hardening Rollout

## Deployment order

1. Apply `supabase/migrations/027_pin_auth_rate_limit.sql`.
2. Verify the three PIN rate-limit RPCs are executable with the service-role key and rejected for anonymous/authenticated roles, using only a synthetic 64-character client hash.
3. Deploy the application commit.
4. Verify security headers, private/no-store auth responses, five-failure lockout, successful PIN login from a separate synthetic client, and logout.

The application falls back to a per-instance limiter only when server-side Supabase credentials are intentionally absent, such as in local tests. When credentials are configured, a missing RPC or unexpected database error fails authentication closed with `503` instead of silently weakening the limiter. Applying the migration before deploying the application is therefore required.

## Rollback

Roll back the application first. Leave the private table and RPCs in place until the rollback is verified; they are inert when unused and retain no raw IP addresses. Remove them only in a later reviewed migration if they are no longer needed.
