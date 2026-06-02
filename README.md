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
- **Admin Placeholder**: Admin-only pages under `/admin` and APIs under `/api/admin/*` are protected by a lightweight role check.

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
- `src/lib/prisma.ts` - Prisma client setup with the PostgreSQL adapter.
- `src/lib/api-cache.ts` - Shared PostgreSQL cache helper for external provider results.
- `src/lib/db-wipe.ts` - Shared local app-data wipe helper used by the CLI script and debug API route.
- `src/lib/media-db.ts` - Database helpers for ratings, stats, badges, rankings, and profile data.
- `src/app/api/admin/health/route.ts` - Admin-only health check endpoint.
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

The current project state has been validated with:

```bash
npm run build
npm run lint
```

Lint currently passes with warnings about raw `<img>` usage. Those warnings are from Next.js image optimization guidance and do not block the build.

## Notes

- Do not commit `.env`; it contains local secrets.
- Rotate any OAuth client secrets that have been shared outside a secure secret manager.
- The Docker database uses a named volume, so data persists across container restarts.
- `docker compose down -v` will remove the local database volume and delete local data.
- The app drawer debug wipe button is disabled in production through `/api/debug/wipe-db`.
