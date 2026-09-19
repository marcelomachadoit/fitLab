# FitLab Security Audit

Date: 2026-09-19

## Implemented

- Supabase client uses the official SDK session management with persistent sessions, token refresh and URL session detection.
- User-owned tables use RLS and explicit policies for SELECT, INSERT, UPDATE and DELETE.
- `meals` policies require `auth.uid() = user_id` in both `USING` and `WITH CHECK` clauses.
- `profiles` policies require `auth.uid() = id`.
- `foods` rows with `user_id is null` are the shared nutrition base: readable by any authenticated user and writable by none of them from the client. Rows with `user_id = auth.uid()` are user-created foods, writable only by their owner. Because `user_id = auth.uid()` is never true for `null`, the INSERT/UPDATE/DELETE policies exclude the shared base, and a user can neither publish a food to everyone nor reassign one to another account.
- `recipes` and `recipe_items` are private per user. Recipe items inherit ownership through an `exists` check against the parent recipe, so an item is only visible or writable when the recipe belongs to the caller.
- Table privileges are granted explicitly to `authenticated` only. Without them PostgREST answers 42501 before any policy is evaluated; `anon` holds no privilege on application tables.
- PostgreSQL constraints limit profile fields, food nutrition values, meal quantities and meal types.
- An index supports queries by `meals.user_id` and date.
- The signup trigger validates/truncates the profile name and uses a fixed `search_path`.
- Public, anonymous and authenticated execution privileges are revoked from the `SECURITY DEFINER` trigger function.
- Database data is rendered with DOM APIs and `textContent`, avoiding HTML injection from food and meal names.
- Cloudflare Pages security headers are defined in `_headers`.
- Password creation/reset requires 8+ characters, uppercase, lowercase, number and special character.
- Supabase Auth provides the primary server-side authentication rate limiting; the UI adds a five-failure, fifteen-minute browser lockout per email.
- Password recovery uses the official `resetPasswordForEmail` and `updateUser` APIs.
- No service-role key, private key or secret token was found in tracked files or Git history.

## Manual configuration required

### Supabase

1. Run `supabase.sql` in the Supabase SQL Editor. Review the result before running it in production.
2. Confirm RLS is enabled on `profiles`, `foods` and `meals`.
3. In Authentication > Password Security, set minimum length to 8 and enable leaked-password protection.
4. In Authentication > URL Configuration, set the production Site URL and add the exact production URL to Redirect URLs.
5. Review the Policies page and remove any policies not represented by `supabase.sql`, especially broad `anon` policies.
6. Keep email confirmation enabled for production.
7. Configure Auth rate limits and email provider quotas according to the expected traffic.
8. Configure database backups and point-in-time recovery according to the Supabase plan.

### Cloudflare Pages

1. Ensure the production deployment uses the intended GitHub branch.
2. Verify `_headers` is included in the output root.
3. Use HTTPS only and verify the response headers after deployment.
4. Configure a custom domain and HSTS preload only when all intended subdomains support HTTPS.
5. Set project-level deployment access controls and branch protection in GitHub.

## Not applicable

- No Supabase Storage bucket is used.
- No Supabase Edge Functions, Cloudflare Workers or custom backend are present.
- No package manager dependencies or `package.json` are present.
- No application CORS configuration is present; browser requests use the Supabase REST endpoint and must be controlled in the Supabase project settings.

## Remaining risks and limitations

- The publishable/anon key is intentionally visible in the frontend. It is safe only when RLS and Supabase Auth settings are correct.
- The browser lockout can be bypassed by clearing storage or changing devices. It is not a replacement for Supabase server-side rate limiting.
- The application cannot verify remote Supabase policies, Auth settings, backups or Cloudflare deployment headers from this repository alone.
- The CSP allows `unsafe-inline` styles because the current UI contains inline style attributes. Moving those values into CSS would allow a stricter policy.
- CDN availability and integrity of the Supabase SDK depend on the configured CDN URL. Pinning an exact SDK version and adding SRI is recommended before production.
- Profile update UI is currently local-only; no sensitive profile mutation endpoint is exposed by the current frontend.

## Tests performed

- JavaScript syntax checks with `node --check`.
- Workspace diagnostics on HTML, CSS, JavaScript and SQL files.
- `git diff --check`.
- Search of tracked files and Git history for private-key and service-role patterns.
- Search for `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `new Function` and console logging.
- Manual policy review of the SQL for cross-user SELECT, UPDATE, DELETE and INSERT attempts.

## Files changed by the audit

- `_headers`: Cloudflare security response headers and CSP.
- `supabase.sql`: explicit RLS policies, constraints, index and trigger hardening.
- `js/supabase.js`: explicit official SDK session behavior.
- `js/auth.js`: safer errors, password recovery, session reset and authentication controls.
- `js/ui.js`: DOM-safe rendering for database-controlled values.
- `js/app.js`: versioned service worker registration and recovery routing.
- `SECURITY_AUDIT.md`: this audit record.
