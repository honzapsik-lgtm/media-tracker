# Media Tracker

Media Tracker is a comprehensive, full-stack Next.js web application designed to be the ultimate centralized hub for discovering, tracking, reviewing, and ranking media. It features a completely unified architecture that treats Movies, TV Shows, Anime, Manga, and Video Games as first-class citizens.

The platform aggregates live data from external APIs (TMDb, RAWG, AniList) and fuses it with a localized PostgreSQL database to handle extremely complex user-generated content, global leaderboard mathematics, and deep analytical tracking.

---

## Architecture

The project is built on the modern **Next.js App Router** paradigm, heavily leveraging React Server Components for ultra-fast, SEO-optimized page loads, and localized Client Components for interactive states. 

### Tech Stack
- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS (with highly customized dynamic UI rendering)
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** NextAuth.js (Discord and Google OAuth integrations)
- **Environment:** Docker Compose (for the local DB)
- **Background Workers:** In-house asynchronous task queues (`src/app/api/worker/route.ts`)

### Hybrid Data Processing
Because the application parses millions of data points from external APIs, the architecture utilizes a hybrid processing model:
1. **Synchronous UI Render:** Core metadata is fetched and aggressively cached so the user interface renders instantly.
2. **Asynchronous Background Jobs:** Heavy mathematical or graph-traversal logic (e.g., syncing a 1000-episode franchise timeline or recalculating user badges) is deferred to local background workers. The frontend UI intelligently polls the job status and renders loading skeletons until the backend worker completes the heavy lifting and commits the result to PostgreSQL.

---

## Features

- **Centralized Hub (Home Page):** A unified home page surfacing trending movies, TV shows, games, and manga all in one place, complete with community scores and global list ranks.
- **Search & Discovery:** Deep search functionality across all supported media types pulling directly from upstream APIs.
- **Universal Media Tracking:** Search and discover Movies, TV Shows, Anime, Manga, and Games in one seamless interface.
- **Granular Tracking:** Treat TV Seasons and individual TV Episodes as entirely standalone entities. You can rate, review, and rank Season 2 of a show entirely independently from Season 1.
- **Mega-Franchise Pagination:** Safely explore massive, continuous shows (like *One Piece*) using highly optimized, chunk-paginated episode lists that prevent browser latency.
- **Comprehensive Scoring:** Rate any item on a 1-100% scale. Ratings dynamically contribute to a global "Community Score" for that piece of media.
- **Deep Reviews:** Don't just give an arbitrary score. Break down your reviews across dynamic criteria (Narrative, Visuals, Acting, Soundtrack, Gameplay) for comprehensive critiques.
- **Unified Creator Profiles:** Explore deep biographical pages for directors, developers, authors, and actors, showcasing their entire unified cross-media filmographies.
- **Watchlist Pipeline:** Manage your backlog with "Plan to Watch", "Watching", "Completed", and "Dropped" status tracking.
- **Gamified Profile Stats:** Unlock dynamic badges and view beautiful statistical breakdowns of your ratings, genre biases, and completion times.
- **Comprehensive Admin Diagnostics:** Detailed system health tracking, API cache inspection, database integrity checks, performance monitoring, and background job lifecycle management available through dedicated admin dashboards.

---

## The AniList Infrastructure & Franchise Pipeline

The AniList integration is the most complex data pipeline in the application. Unlike TMDb, AniList does not cleanly separate "Shows" from "Seasons". Everything is a massive, interconnected web of generic "Nodes" linked by generic relationship edges (e.g., `PREQUEL`, `SEQUEL`, `PARENT`, `SPIN_OFF`).

To process anime correctly, the application implements the **Mega-Franchise Protocol**:

### 1. The True Root Traversal
When a user clicks on any random season or spin-off (e.g., *Steins;Gate 0*), the backend does NOT just render that season. It intercepts the request and launches a backwards traversal algorithm using GraphQL.
The algorithm recursively climbs up the `PREQUEL` and `PARENT` edges to find the absolute "Root" of the franchise. It features strict "Usurper Protection", preventing serial TV shows from artificially yielding their root status to completely unrelated parent nodes.

### 2. The Timeline Constructor Worker
Once the True Root is found, it is saved to the PostgreSQL database, and a background worker (`syncAniListFranchiseTree`) is dispatched. This worker crawls back down the franchise tree, mapping out every single canon movie, sequel season, and spin-off, organizing them chronologically by release date to build a seamless UI Timeline.

### 3. AniList, MAL-Sync, TMDb, and Jikan Cross-Pollination
After the local franchise tree exists, the worker enriches each AniList node with data from multiple providers:

- **AniList** remains the canonical anime graph source. It decides which entries are the franchise root, serialized seasons/cours, canon movies, and related spin-offs.
- **MAL-Sync** is used as the first translation layer. For each AniList ID, the worker asks MAL-Sync for a MAL ID, TMDb ID, and any available episode offset metadata.
- **Jikan** is used through the MAL ID to fetch anime theme data, including openings and endings.
- **TMDb** is used to fetch episode metadata, still images, air dates, runtimes, watch providers, and normalized TV season information.

MAL-Sync does not always expose a `Sites.TMDB` mapping in the response used by this app. In that case, the worker falls back to TMDb search using the franchise root title. The fallback tries normalized title variants, including removing parentheticals like `(TV)`, then prefers Japanese animated TV results before accepting a broader TV result. This is necessary for franchises such as *JoJo's Bizarre Adventure*, where MAL-Sync currently returns MAL/streaming site data for the AniList endpoint but no TMDb site mapping in the parsed response.

### 4. TMDb Episode Chunking for Anime Cours
Anime structure on AniList often does not match TMDb season structure. AniList may split a story into multiple cours or parts, while TMDb may store those parts inside a single TV season. The enrichment worker handles this by:

1. Sorting AniList TV-like nodes chronologically.
2. Sorting TMDb seasons by `season_number`.
3. Walking TMDb episodes with a stateful cursor.
4. Slicing TMDb episode arrays by the AniList node's episode count.
5. Rewriting the visible episode numbers to be local to the AniList season/cour.

This allows examples like *Attack on Titan Season 3* and *Season 3 Part 2* to display the correct TMDb episode metadata even when TMDb stores them as one continuous season. It also prevents later JoJo parts from falling back to the season-1 streaming titles when AniList exposes mismatched or stale `streamingEpisodes` data.

### 5. Root Season Handling
The application currently treats the franchise root `Media` row as both:

1. The canonical franchise/show container.
2. The first season/cour in the AniList timeline.

Later seasons are represented by `Season` rows, but the root season is not. Because of that, root-level season enrichment is stored directly on the `Media` row:

- `Media.episodeData` stores TMDb episode metadata for the root season.
- `Media.themeData` stores Jikan opening/ending data for the root season.
- Later seasons continue to use `Season.episodeData` and `Season.themeData`.

The season and episode pages explicitly check whether the current season is the root AniList ID. If it is, they read episode/theme data from `Media`; otherwise they read from the matching `Season` row.

### 6. Ongoing Show Episode Counts
AniList returns `episodes: null` for many currently airing or never-ending shows. The UI therefore resolves known episode counts in a defensive order:

1. AniList `episodes`
2. AniList `nextAiringEpisode.episode - 1`
3. cached TMDb `episodeData.length`
4. AniList `streamingEpisodes.length`
5. `Unknown`

This prevents ongoing shows such as *One Piece* from showing `Unknown Episodes` when the app already has enough information to display the current known episode count.

### 7. God Tier Credits Extraction & The Dub Blocklist
AniList provides raw, unsorted arrays of thousands of staff members per show. To build the "Architect" grids (showing the Series Director, Original Creator, Composer, etc.), the backend relies on `src/lib/credits-parser.ts`.
- **Dynamic Ingestion Limits:** If the worker detects a mega-franchise with >100 episodes, it dynamically quadruples its ingestion loop cap to dig deep into the API and bypass thousands of episode-specific animators.
- **Regex Blocklists:** A highly aggressive regex engine parses the arrays, instantly dropping any role containing international dub markers (`English`, `Spanish`, `ADR`).
- **Tiering Logic:** It strips episodic parenthesis markers (e.g., `ep 1-4`) and matches specific exact-string roles (`Series Composition`, `Character Design`) to separate the true masterminds from secondary staff, presenting a beautiful, deduplicated crew layout.

### 8. Anime Themes UI
Anime themes are displayed as stacked opening and ending sections instead of cramped side-by-side columns. Every opening or ending is rendered as its own pill, so no song entry is dropped. Long song names are clamped inside the pill after three text lines to keep the sidebar readable while preserving the complete set of available theme entries.

---

## The Global Ranking System & Elo Engine

Media Tracker is not just a logging app; it is a competitive tier list engine.

### Personal Lists
Users can create infinite custom lists (e.g., "Top 10 RPGs of all time") and physically drag-and-drop media items into exact ranking positions.

### The Rank Aggregation Engine
To determine the definitive "Global Leaderboard", the platform does not rely on simple score averaging (which is easily skewed by review bombing). Instead, it uses an advanced, mathematical aggregation engine that processes personal lists.

1. **Positional Weighting:** The engine parses the exact position of an item in a user's list.
2. **Emotional Score Gap Mathematics:** It cross-references the user's actual rating score for that item and calculates the mathematical gap to apply severity weighting.
3. **Exponential Time Decay:** Older lists and older ratings degrade in mathematical authority over time, ensuring the Global Leaderboard is a living, breathing reflection of current community consensus rather than being permanently locked by nostalgia.

The result is a highly accurate, tamper-resistant `GlobalRank` cached in PostgreSQL, which acts as the definitive definitive community tier list for all media.

---

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
