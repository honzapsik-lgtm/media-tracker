# Media Aggregator

Media Aggregator is a comprehensive Next.js application for discovering, tracking, rating, reviewing, and ranking a wide array of media including movies, TV shows, seasons, episodes, games, and manga.

The application leverages external media APIs (TMDB, RAWG, Jikan) for rich catalog data, and utilizes a local PostgreSQL database for robust persistence of user-generated content such as ratings, deep reviews, custom ranking lists, and profile statistics.

## Core Features

- **Centralized Hub (Home Page)**: A unified home page that surfaces trending movies, TV shows, games, and manga all in one place, complete with community scores and global list ranks.
- **Search & Discovery**: Deep search functionality across all supported media types pulling directly from upstream APIs.
- **Granular Media Tracking**: Treat TV Seasons and individual TV Episodes as first-class citizens. Rate, review, and rank seasons and episodes entirely independently from their parent shows with fully unified UI layouts.
- **Comprehensive Scoring**: Rate any item on a 1-100% scale. Ratings dynamically contribute to a global "Community Score" for that piece of media.
- **Deep Reviews**: Write detailed text reviews and provide individual scores for specific criteria (e.g., Narrative, Visuals, Acting, Gameplay, Audio) for comprehensive critiques.
- **Creator Profiles & Credits**: Explore comprehensive profiles for directors, developers, authors, and actors. Discover their biographical details and fully interconnected filmographies/ludographies across different media types.
- **Global Leaderboards & Personal Rankings**: Build personal drag-and-drop ranking lists on your profile. The app utilizes an advanced PageRank-style "Rank Aggregation Engine" (triggered manually via the Admin Dashboard) that mathematically parses millions of list combinations—weighted by your emotional score gap and an exponential time decay function—to calculate the true unified global leaderboards. Items must appear in at least 1 user list to qualify for the global tier.
- **Watchlists**: Manage "Plan to Watch", "Watching", "Completed", and "Dropped" statuses for your backlog.
- **Profile Stats & Badges**: Unlock gamified badges based on your reviewing activity, and view dynamic statistical breakdowns of your ratings and watchlists.
- **Comprehensive Admin Diagnostics**: Detailed system health tracking, API cache inspection, database integrity checks, performance monitoring, and background job lifecycle management available through dedicated admin dashboards.

## Architecture

- **Next.js App Router**: Built entirely on the modern Next.js App Router with React Server Components and optimized Client Components.
- **Hybrid Data Processing**: Synchronous UI updates for immediate user feedback combined with asynchronous background jobs for heavy calculations (like user stats and badge unlocked logic) to keep the frontend blazing fast.
- **PostgreSQL Persistence**: Fully modeled relational schema handled via Prisma ORM, utilizing raw SQL window functions for complex mathematical leaderboard rankings.
- **Aggressive Caching**: Extensive caching layers for external API responses and computed user statistics to drastically reduce load times and API quota usage.
- **Authentication**: NextAuth setup with Discord and Google OAuth providers configured out of the box, supporting basic role-based authorization (User/Admin).

## Tech Stack

- **Framework**: Next.js (App Router)
- **UI Library**: React
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Auth**: NextAuth.js
- **Environment**: Docker Compose

## Local Setup

1. **Environment Variables**: Create a local `.env` file in the project root:
   ```env
   DATABASE_URL="postgresql://admin:localpassword123@localhost:5432/media_app"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="replace-with-a-local-secret"
   TMDB_API_KEY="your-tmdb-api-key"
   RAWG_API_KEY="your-rawg-api-key"
   DISCORD_CLIENT_ID="your-discord-client-id"
   DISCORD_CLIENT_SECRET="your-discord-client-secret"
   GOOGLE_CLIENT_ID="your-google-client-id"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start Database**:
   ```bash
   docker compose up -d db
   ```

4. **Initialize Prisma**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to view the app.

## Useful Scripts

- `npm run dev` - Start local development server
- `npm run build` - Build for production
- `npm run db:wipe` - Developer tool to wipe all app data while preserving auth users/sessions
- `npm run make-admin -- user@example.com` - Promote a local user account to Admin
- `npm run make-user -- user@example.com` - Demote a local user account back to User

## Notes

- The Docker database uses a named volume, so your data naturally persists across container restarts. Use `docker compose down -v` if you wish to completely nuke the local database volume.
- Admin-only pages and tools require the `admin` role and live under `/admin` and `/api/admin/*`. Role changes are intentionally script-only.
