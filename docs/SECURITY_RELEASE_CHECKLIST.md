# Security regression and release checklist

This gate is intentionally red: it encodes the audited security boundary, so each open finding remains a visible failure until its separately approved remediation lands. It does not deploy, migrate, rotate credentials, call a paid provider, or retrieve private rows.

## One-command gate

From a clean checkout with dependencies installed, run the full pre-deployment gate against the candidate preview and its Supabase project:

```bash
SECURITY_TARGET_URL="https://candidate-preview.example" \
SECURITY_SUPABASE_URL="https://project.supabase.co" \
SECURITY_SUPABASE_PUBLISHABLE_KEY="<publishable-key>" \
SECURITY_PIN="<preview-pin>" \
npm run security:release
```

The command continues after failures and ends with one PASS/FAIL summary for static authorization and privacy invariants, malicious report fixtures, dependency audits, lint, production build, missing/malformed/valid-session HTTP smoke tests, and anonymous Supabase read/write probes. Supabase reads use bodyless one-row `HEAD` requests and pass only when access is denied or RLS exposes no rows; they do not request exact counts. A clean build uses non-secret loopback placeholders when required public Supabase build variables are absent. Output contains status codes, table/route names, range-presence metadata, and credential match file names only; it never prints keys, PINs, response bodies, row counts, or private rows.

Use `npm run security:check` for the same local gate without network probes. Network probes are included automatically when their environment variables are present. The release command fails closed when the preview or Supabase settings are absent.

## Before running

- Confirm the exact candidate commit and a successful preview deployment. Never target production before separate deployment approval.
- Use only the public Supabase publishable key. Never provide the service-role key to this command.
- Use the candidate preview's PIN only through `SECURITY_PIN`; the script does not print or persist it.
- Confirm provider calls are disabled or mocked in test environments. The gate never invokes meal-prep/workout generation.
- Attach a reviewed migration plan, rollback/forward-fix SQL, expected schema diff, and unique migration versions. Do not apply migrations from this checklist.
- Confirm the exposed legacy provider credential has been revoked through the provider control plane; record only the confirmation, never the value.

## Required evidence

- `security:release` summary is fully green, or every failure has an explicit owner and approved exception.
- Anonymous Supabase table probes return denial without retrieving rows; synthetic insert bodies contain an explicit null primary key so they cannot commit if authorization regresses.
- Missing-session private APIs fail before service-role/provider use. Raw/page/embed report routes share the intended visibility boundary.
- Dependency audit has no safely actionable critical/high production finding; any exception includes reachability and expiry.
- Preview headers include CSP, permissions, referrer, MIME, HSTS, and private/no-store caching where appropriate.
- Lint, focused tests, and production build pass from the clean candidate checkout.

## Separately approved production promotion

After explicit merge/deploy approval, record the exact commit and migration set, then repeat only status/header/authorization probes against production. Stop and roll forward or invoke the reviewed rollback if any private endpoint becomes public, a migration differs from the reviewed plan, a provider-backed route is reachable anonymously, report active content can execute, or private responses become cacheable. Never weaken RLS/authentication or restore a compromised credential as rollback.
