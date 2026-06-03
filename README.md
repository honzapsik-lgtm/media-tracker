# Media Aggregator

Media Aggregator is a Next.js app for searching, discovering, rating, reviewing, ranking, and tracking movies, TV shows, seasons, episodes, games, and manga.

The app currently uses external media APIs for catalog data and a local PostgreSQL database for user-generated data such as ratings, reviews, profile metadata, achievements, rankings, and watchlists.

## Current State

- Next.js App Router frontend with React client components for search, filters, ratings, profile tabs, watchlists, and the app drawer.
- PostgreSQL persistence through Prisma.
- Docker Compose local database using `postgres:15-alpine`.
- NextAuth authentication with Prisma session/account storage.
- Discord and Google OAuth providers are configured in code.
- Lightweight role-based authorization uses `users.role`, with all users defaulting to `user`.
- Supabase has been removed from the runtime data layer.
- TMDB powers movie and TV search/details/trending/season data, with normalized responses cached in PostgreSQL.
- RAWG powers game search/details/discovery, with normalized responses cached in PostgreSQL.
- Jikan powers manga search/details/discovery, with normalized responses cached in PostgreSQL.

## Features

- **Search & Discovery**: Seamlessly search and explore catalogs of Movies, TV Shows, Games, and Manga pulled directly from TMDB, RAWG, and Jikan.
- **Scoring System**: Rate any media item on a granular 1-100% scale. Ratings instantly calculate into a global "Community Score" for that piece of media.
- **Deep Reviews**: Go beyond simple scores by writing detailed text reviews and scoring specific criteria (e.g., Story, Visuals, Audio, Gameplay) for comprehensive critiques.
- **Personal Ranking Lists**: Curate personal drag-and-drop leaderboards on your profile. Sort your favorite games, movies, shows, seasons, and episodes to create your ultimate top-tier lists.
- **Global Rankings**: Explore community-driven global leaderboards. Media is mathematically ranked via a "List Rank" algorithm (seeded by users' personal ranking lists) as well as by Community Score and Popularity.
- **Granular Media Tracking**: Treat TV Seasons and individual TV Episodes as first-class citizens. Rate, review, and rank seasons and episodes independently from their parent shows.
- **Watchlists**: Maintain "Plan to Watch", "Watching", "Completed", and "Dropped" lists for your media backlog.
- **Profile Stats & Badges**: Unlock gamified badges based on your reviewing habits and view dynamic statistical breakdowns of your ratings.
- **Developer Wipe Tool**: In local development, the app drawer includes a guarded `Debug: Wipe DB` action that clears app data while preserving auth users/sessions.
- **Admin Diagnostics**: Admin-only pages under `/admin` and APIs under `/api/admin/*` expose internal diagnostics for logs, background jobs, provider cache health, and database integrity checks.

## Architecture & Optimizations

- **Hybrid Ranking & Stats Architecture**: The application uses a hybrid approach for media statistics and rankings.
  - **Synchronous UI Updates**: When a user rates an item, `refreshMediaStats` runs synchronously to update the media's community average and rating count, followed by Next.js cache invalidation (`revalidatePath`) so the UI reflects the change instantly.
  - **Asynchronous Profile Work**: Badge calculation and user-stat cache updates are offloaded to a `BackgroundJob` table. Rating changes and watchlist add/update/remove actions enqueue `update_user_stats` jobs so profile statistics stay consistent after list changes.
  - **Background Processing**: A cron trigger periodically pings the `/api/worker` endpoint to process pending background jobs. The local client provider also polls the worker during development.
- **Raw PostgreSQL Window Functions**: The global leaderboards (`getRankedMedia`) use raw SQL CTEs and window functions (`RANK() OVER`) to rigidly calculate the true `list_rank` based on the mathematical average of user rank positions, decoupled from the outer page sorting order. This drastically improves sorting performance over large datasets.
- **Aggressive Profile Caching**: To minimize database load and ensure lightning-fast profile loads, intensive mathematical breakdowns (like score distributions, average ratings, and watchlist ratios) are eagerly calculated by background workers and permanently stored in a dedicated `UserStatsCache` table. This completely eliminates the need for expensive real-time aggregation queries on every profile visit.
- **Provider API Cache**: External provider responses are normalized into app-facing result objects and stored in `ApiCache`.
  - Search and trending cache entries live for 24 hours.
  - Discover cache entries live for 6 hours and are keyed by media type, genre, year, and sort.
  - Detail cache entries live for 7 days.
  - Cache entries store normalized media data, not API-key-bearing request URLs.
- **Admin Diagnostics Phase 1**: Operational events are stored in `SystemLog` and inspected through admin-only diagnostics routes.
  - `/admin/logs` renders the system log viewer.
  - `/api/admin/logs` returns paginated log JSON.
  - `/api/admin/health` records successful admin health checks.
  - Sensitive error stacks are not returned from the logs API in production.
- **Admin Diagnostics Phase 2**: Background jobs now have inspectable lifecycle state and admin controls.
  - `BackgroundJob` tracks pending, processing, completed, failed, and cancelled states.
  - Jobs can be inspected at `/admin/jobs` and `/api/admin/jobs`.
  - Worker/job lifecycle events are stored in `SystemLog`.
  - `update_user_stats` jobs are deduped by user through `update_user_stats:<userId>`.
  - Admins can retry failed jobs, cancel pending jobs, process a batch, mark stuck jobs failed, and clean up old completed/cancelled jobs.
  - Cron and local worker polling still use `/api/worker`.
- **Admin Diagnostics Phase 3**: `/admin` is now an overview dashboard for internal system health.
  - `/admin` summarizes background jobs, system logs, provider cache, database counts, and active warnings.
  - `/admin/cache` inspects `ApiCache` entries, supports filtering by key/provider/type/freshness, shows payload sizes without dumping provider payloads, and can delete expired cache entries.
  - `/admin/database` shows database summaries and read-only integrity checks for ratings, media stats, user stats cache rows, jobs, cache entries, and recent system errors.
  - `/admin/jobs` and `/admin/logs` remain linked from the admin overview and shared admin navigation.
  - New admin cache APIs live under `/api/admin/cache`, `/api/admin/cache/summary`, and `/api/admin/cache/cleanup`.
  - New admin database APIs live under `/api/admin/database/summary` and `/api/admin/database/checks`.
- **Admin Diagnostics Phase 3.5**: Admin diagnostics now include safety and clarity hardening.
  - Admin pages show last-refreshed timestamps and clearer empty states.
  - Destructive cleanup actions require typed confirmation.
  - `SystemLog` metadata is sanitized before writing and before admin display.
  - Admin health returns a timestamp and lightweight database reachability.
  - Database integrity checks include a SystemLog retention warning for rows older than 30 days.

## Main Technologies

- Next.js `16.2.6`
- React `19.2.4`
- TypeScript
- Tailwind CSS `4`
- Prisma `7`
- PostgreSQL
- NextAuth `4`
- Docker Compose

## Important Project Files

- `src/app` - App Router pages and API routes.
- `src/components` - UI components and interactive client controls.
- `src/lib/auth.ts` - Shared NextAuth configuration.
- `src/lib/admin-auth.ts` - Server-side admin authorization helper.
- `src/lib/admin-api.ts` - Shared admin API error response helpers.
- `src/lib/admin-constants.ts` - Shared admin defaults, page-size caps, timing thresholds, and confirmation text.
- `src/lib/logger.ts` - Structured console and persistent system log helper.
- `src/lib/request-id.ts` - Request ID generation and header extraction helpers.
- `src/lib/jobs.ts` - Background job enqueue, claim, retry, cancel, cleanup, and stuck-job helpers.
- `src/lib/admin-jobs.ts` - Admin job filtering, pagination, serialization, and summary helpers.
- `src/lib/admin-overview.ts` - Admin overview summary and warning aggregation helper.
- `src/lib/admin-cache.ts` - Admin provider cache summaries, pagination, and expired-cache cleanup.
- `src/lib/admin-database.ts` - Database summaries and read-only integrity checks.
- `src/lib/prisma.ts` - Prisma client setup with the PostgreSQL adapter.
- `src/lib/api-cache.ts` - Shared PostgreSQL cache helper for external provider results.
- `src/lib/db-wipe.ts` - Shared local app-data wipe helper used by the CLI script and debug API route.
- `src/lib/media-db.ts` - Database helpers for ratings, stats, badges, rankings, and profile data.
- `src/app/api/admin/health/route.ts` - Admin-only health check endpoint.
- `src/app/api/admin/jobs/route.ts` - Admin-only paginated jobs endpoint.
- `src/app/api/admin/logs/route.ts` - Admin-only paginated system logs endpoint.
- `src/app/api/admin/cache/*` - Admin-only cache summary, listing, and expired-entry cleanup endpoints.
- `src/app/api/admin/database/*` - Admin-only database summary and integrity-check endpoints.
- `src/app/api/debug/wipe-db/route.ts` - Development-only debug endpoint for clearing app data.
- `scripts/nuke-db.ts` - CLI database wipe script that preserves auth users/sessions.
- `scripts/make-admin.ts` and `scripts/make-user.ts` - Local role management scripts.
- `prisma/schema.prisma` - Database schema.
- `docker-compose.yml` - Local PostgreSQL service.

## Requirements

- Node.js with npm.
- Docker Desktop or another Docker engine with Compose support.
- API keys for external catalog providers.
- OAuth credentials if login should work.

## Environment Variables

Create a local `.env` file in the project root. It is intentionally ignored by git.

```env
DATABASE_URL="postgresql://admin:localpassword123@localhost:5432/media_app"

NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-local-secret"

TMDB_API_KEY="your-tmdb-api-key"
RAWG_API_KEY="your-rawg-api-key"
GOOGLE_BOOKS_API_KEY="optional-google-books-key"

DISCORD_CLIENT_ID="your-discord-client-id"
DISCORD_CLIENT_SECRET="your-discord-client-secret"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

`GOOGLE_BOOKS_API_KEY` is reserved for future Google Books integration. The current manga/book-style integration uses Jikan.

## Discord OAuth Setup

In the Discord Developer Portal, add this redirect URI to the OAuth2 settings:

```text
http://localhost:3000/api/auth/callback/discord
```

The local app uses this through NextAuth:

```text
http://localhost:3000/api/auth/signin/discord
```

## Local Setup

Install dependencies:

```bash
npm install
```

Start PostgreSQL:

```bash
docker compose up -d db
```

Generate the Prisma client:

```bash
npx prisma generate
```

Sync the local database schema:

```bash
npx prisma db push
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Lightweight Roles

Roles are stored on the existing `users` table:

- `user` - default role for every account.
- `admin` - can access future internal diagnostics routes.

Admin-only pages live under `/admin`. Admin-only APIs live under `/api/admin/*`.

Promote a local user:

```bash
npm run make-admin -- user@example.com
```

Demote a local user:

```bash
npm run make-user -- user@example.com
```

Role changes are intentionally script-only. There is no public UI for role editing and no automatic first-user promotion.

## Admin Troubleshooting Map

| Symptom | First place to inspect |
| --- | --- |
| Profile stats wrong | `/admin/jobs`, then `/admin/database` users missing `UserStatsCache` |
| Rating saved but community score wrong | `/admin/database` media_stats checks, then `/admin/logs` |
| Watchlist counts wrong | `/admin/jobs` `update_user_stats` jobs, then `/admin/logs` |
| Detail/search slow or stale | `/admin/cache` |
| Ranking page slow/wrong | `/admin/database` and `/admin/logs` |
| Worker not updating | `/admin/jobs` |
| Recent unknown failure | `/admin/logs?level=error` |
| DB/cache growing | `/admin/cache` and `/admin/database` |

## Admin Safety Notes

- Admin routes require `role = admin`.
- Role changes remain script-only through `npm run make-admin` and `npm run make-user`.
- Admin pages and APIs should not expose secrets, OAuth tokens, cookies, raw headers, API keys, or provider URLs containing keys.
- Destructive actions require confirmation text before they run.
- `SystemLog` metadata is redacted for sensitive key names such as tokens, cookies, API keys, secrets, and database URLs.
- `SystemLog` can grow over time and needs a future retention policy. Phase 3.5 only warns about old log rows; it does not delete them automatically.
- Full lint status should remain interpreted carefully because older unrelated lint errors still exist.

## Useful Commands

```bash
npm run dev
npm run build
npm run lint
npm run db:wipe
npm run make-admin -- user@example.com
npm run make-user -- user@example.com
npx prisma generate
npx prisma db push
npx prisma studio
docker compose up -d db
docker compose up -d db cron
docker compose down
```

`npm run db:wipe` clears app data tables, caches, jobs, badges, and profile badge showcases while preserving auth users, accounts, and sessions.

## Validation Status

The current project state is validated with:

```bash
npm run build
npx prisma generate
npx prisma db push
```

Full `npm run lint` currently has pre-existing unrelated lint errors in older files. Targeted ESLint is run for touched files during admin diagnostics work.

## Notes

- Do not commit `.env`; it contains local secrets.
- Rotate any OAuth client secrets that have been shared outside a secure secret manager.
- The Docker database uses a named volume, so data persists across container restarts.
- `docker compose down -v` will remove the local database volume and delete local data.
- The app drawer debug wipe button is disabled in production through `/api/debug/wipe-db`.
