# STAR SYSTEM for Sincere Academy

The standalone application lives in `C:\Users\musth\Projects\my-first-app\star-system`. Open http://localhost:3000. It uses the existing academy Supabase project. Its sign-in, request authorization, application shell, weekly dashboard, attendance register and admission form were built for this workspace. Its schema baseline, reporting and several management components were adapted from the existing academy implementation so both applications can use the same database.

## Start locally

```powershell
Set-Location 'C:\Users\musth\Projects\my-first-app\star-system'
npm.cmd ci
npm.cmd run dev
```

Use the existing `.env.local` on this machine. For another checkout, copy `.env.example` to `.env.local` and supply the academy's project URL and publishable key. Only the publishable key belongs in the application's public configuration.

## Owner setup before institutional use

1. In the existing Supabase project open Authentication → Sign In / Providers. Disable **Allow new users to sign up**. Keep email/password enabled. Disable anonymous sign-in, phone, other identity providers and MFA enrollment/verification. The hosted settings endpoint reported public signup enabled during verification.
2. Add this entry to the isolated application's `.env.local`, replacing the placeholder locally with the URL-encoded database password. Keep the value out of chat and source control.

   ```dotenv
   SUPABASE_DB_URL=postgresql://postgres:<URL_ENCODED_DATABASE_PASSWORD>@db.kjmrgjvxlblgbadaxfks.supabase.co:5432/postgres
   ```

3. Run `npm.cmd run migrate`. The runner verifies the target, checks the existing functions before replacing them, applies pending changes in one transaction, records their versions and verifies the scheduled job. If TLS validation needs a project CA, set `NODE_EXTRA_CA_CERTS` to the path of the certificate obtained from the project's database settings. Direct connectivity to the database host is required. No database password was available during this build.
4. In Authentication → Hooks, configure the **Custom Access Token** hook to use `public.staff_password_session` and the **Send Email** hook to use `public.owner_managed_auth_email`. The first allows password login and refreshes of password sessions. The second refuses Auth email delivery, including recovery and passwordless links. These PostgreSQL hooks are available on Free. The local configuration declares them. The hosted dashboard needs the same configuration. [Supabase Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)
5. The owner creates confirmed email/password accounts directly in Auth and adds their membership with `database/provision-staff.sql`. The owner sets or replaces passwords through an authorized administrative workflow. Use a fictional staff account for acceptance testing.
6. Sign in, set institution preferences, create leagues and activities, create a draft academic year and review assignments before confirming it. Staff can add students manually or import a CSV.

## Implementation and verification by stage

| Stage | Files | Verification and next step |
|---|---|---|
| Foundation | `package.json`, `next.config.ts`, `proxy.ts`, `lib/server/supabase.ts`, `app/api/auth`, `app/login`, `.env.example` | Production build and signed-out HTTP tests passed. Supply owner-managed access for a live staff sign-in. |
| Database | `supabase/config.toml`, `supabase/migrations/*.sql`, `database/provision-staff.sql`, `scripts/migrate.mjs` | Inspected 19 live application tables with RLS, 19 public-schema policies, a private photo bucket and five required RPCs. The command, recognition and overview function bodies matched the local baseline. Hosted migration history listed only the reporting migration. The runner intentionally skips the already-installed baseline. Run the owner migration step above. |
| Core workflows | `components/star/admission.tsx`, `students.tsx`, `photos.tsx`, `register.tsx`, `records.tsx`, `management.tsx`, `rewards.tsx`, `app/api/data`, `app/api/photos` | Local PostgreSQL fixtures exercise transactional attendance, duplicate prevention, manual awards, private pins, remark history, lifecycle and progression. Follow one fictional student through registration, a photo upload and a locked attendance submission after signing in. |
| Competition | `components/star/overview.tsx`, `competition.tsx`, `academic-calendar.tsx`, recognition migrations | Local tests cover ties, league membership across years and the weekly rotation. The dashboard polls visible tabs every 12 seconds. The league carousel rotates every 10 seconds. Manual navigation temporarily pauses rotation. The hosted scheduler requires the migration above. |
| Reports | `app/api/export/route.ts`, `lib/server/pdf.ts`, `lib/csv.ts`, report and profile controls | Tested a fictional multipage PDF and CSV quoting, embedded newlines, BOMs and spreadsheet-formula escaping. Compare a signed-in export with its source session before admitting real data. |
| Testing and polish | `scripts/test-*.mjs`, `app/globals.css`, `app/fonts`, `components/star/workspace.tsx` | The sign-in page was inspected in a browser. Run the commands below to repeat the build, database, export and HTTP checks. Full authenticated browser acceptance and high-volume load testing remain outstanding. |

## Repeat the checks

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
# With the local app running on port 3000
npm.cmd run test:http
```

The database suite runs against isolated PGlite with Supabase role and storage fixtures. It checks 60 business, authorization and Auth-hook cases. Hosted job scheduling requires real PostgreSQL with pg_cron. The HTTP suite checks all 13 protected page routes, four protected APIs, same-origin checks and sign-in validation. Test fixtures are fictional.

## Operational details

- Existing records retain their stored effective reward. New sessions also retain the configured reward and enable flag once the migration is active. The UI identifies unavailable legacy configuration in the export.
- Weekly winner rotation uses the academic-month identifier stored for each weekly period. Review recognition boundaries in Settings before a period closes. The scheduler finalizes closed periods every 15 minutes in the institution's time zone and records a system audit identity.
- Attendance percentages count submitted student marks. A student marked in two qualifying activities contributes two observations. Classes with no submitted activity contribute none.
- Reports fetch ledger pages on the server. A large export still requires memory for the generated document. Photo storage, export bandwidth, database size and concurrent use consume the project's free quotas. [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase)
- The read-only motion reference uses pointer-driven canvas deformation, requestAnimationFrame, a 180 ms overshoot transition, 300 ms theme changes and reduced-motion handling. The app adapts the timing in CSS and uses Motion for entry, rank movement and counters. It uses original CSS orbit artwork. The local Manrope and Newsreader fonts include their OFL licenses. Icons come from the installed Lucide package.
- Supabase, Context7, GitHub, Figma, Lovable, MagicPath and Vercel answered read-only connector calls. Canva requested reauthentication in the app's connector settings. Product Design is a local skill. Railway, Replit and VideoGen were excluded as requested.
- No deployment was made. Vercel Hobby permits personal or non-commercial use. Verify academy eligibility before selecting it for production. [Vercel terms](https://vercel.com/legal/terms)

