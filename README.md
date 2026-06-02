# Media Aggregator

Media Aggregator is a Next.js app for searching, discovering, rating, reviewing, ranking, and tracking movies, TV shows, seasons, episodes, games, and manga.

The app currently uses external media APIs for catalog data and a local PostgreSQL database for user-generated data such as ratings, reviews, profile metadata, achievements, rankings, and watchlists.

## Current State

- Next.js App Router frontend with React client components for search, filters, ratings, profile tabs, watchlists, and the app drawer.
- PostgreSQL persistence through Prisma.
- Docker Compose local database using `postgres:15-alpine`.
- NextAuth authentication with Prisma session/account storage.
- Discord and Google OAuth providers are configured in code.
- Supabase has been removed from the runtime data layer.
- TMDB powers movie and TV search/details/trending/season data.
- RAWG powers game search/details/discovery.
- Jikan powers manga search/details/discovery.

## Architecture & Optimizations

- **Hybrid Ranking & Stats Architecture**: The application uses a hybrid approach for media statistics and rankings.
  - **Synchronous UI Updates**: When a user rates an item, `refreshMediaStats` runs synchronously to update the media's community average and rating count, followed by Next.js cache invalidation (`revalidatePath`) so the UI reflects the change instantly.
  - **Asynchronous Global Rankings**: Heavy global rankings and badge calculation tasks are offloaded to a `BackgroundJob` table. A cron trigger periodically pings the `/api/worker` endpoint to process these jobs in the background.
- **Raw PostgreSQL Window Functions**: The global leaderboards (`getRankedMedia`) use raw SQL CTEs and window functions (`RANK() OVER`) to rigidly calculate the true `list_rank` based on the mathematical average of user rank positions, decoupled from the outer page sorting order.
- **Granular Media Types**: Seasons and Episodes are treated as first-class entities with their own rating and ranking systems, complete with pattern matching on `tmdb-tv-` prefixes to perfectly isolate shows, seasons, and episodes in user profile lists.

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
- `src/lib/prisma.ts` - Prisma client setup with the PostgreSQL adapter.
- `src/lib/media-db.ts` - Database helpers for ratings, stats, badges, rankings, and profile data.
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

## Useful Commands

```bash
npm run dev
npm run build
npm run lint
npx prisma generate
npx prisma db push
npx prisma studio
docker compose up -d db
docker compose down
```

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
