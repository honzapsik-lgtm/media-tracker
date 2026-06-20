# Media Tracker: System Architecture & Deep Dive Documentation

This document serves as the absolute source of truth for the **Media Tracker** application. It is intentionally written with extreme detail and depth to provide any developer (or AI assistant, such as Gemini) a complete, holistic understanding of the entire codebase, its architecture, its relational database design, and the complex data pipelines that power it.

---

## 1. Core Purpose & Vision
Media Tracker is a unified, full-stack Next.js web application engineered to be the ultimate centralized hub for discovering, tracking, reviewing, and mathematically ranking all forms of media. Unlike traditional platforms that segregate media (e.g., Letterboxd for movies, MyAnimeList for anime, Backloggd for games), this application treats **Movies, TV Shows, Anime, Manga, and Video Games** as first-class, interconnected citizens within a single unified ecosystem.

## 2. Technology Stack & Infrastructure
- **Framework:** Next.js (App Router paradigm) heavily leveraging React Server Components for instantaneous, SEO-optimized renders and strict client-boundary boundaries for interactive components.
- **Language:** TypeScript (Strict typing enforced across API contracts, UI props, and database queries).
- **Styling:** Tailwind CSS (configured for highly dynamic, dark-mode-first aesthetic rendering).
- **Database:** PostgreSQL, running locally via Docker Compose.
- **ORM:** Prisma, acting as the type-safe bridge between the Next.js backend and the PostgreSQL database.
- **Authentication:** NextAuth.js configured with OAuth providers (Discord, Google) and session persistence.
- **Background Workers:** A custom, fully in-house asynchronous task queue (`BackgroundJob` table + `api/worker` routes) used to defer extremely heavy API aggregation tasks.

---

## 3. Database Architecture & "The Rosetta Stone"
The Prisma schema (`prisma/schema.prisma`) is the heart of the application. It utilizes a powerful normalization strategy to handle wildly different media types through a central `Media` table.

### 3.1 The Universal `Media` Table
Every piece of content starts as a row in the `media` table, possessing a universal `id` (UUID), `title`, `type` (SHOW, MOVIE, GAME, MANGA, OTHER), and `releaseDate`.

### 3.2 The External ID Mapping Layer (The Rosetta Stone Columns)
Because the app aggregates data from multiple disparate sources, the `Media` table acts as a Rosetta Stone, linking various third-party primary keys together:
- `anilistId`: The primary ID for anime and manga content.
- `tmdbId`: The primary ID for movies and western TV shows, but also used as a supplementary ID for anime episodic metadata.
- `igdbId`: The primary ID for the video game backend.
- `mangadexId`: A UUID specifically used to fetch high-res manga covers and chapter data.
- `malId`: MyAnimeList ID, used almost exclusively as a translation bridge to query the Jikan API.

### 3.3 Relational Hierarchies (Media -> Seasons -> Episodes)
The database structure supports extremely granular tracking. 
- **Standalone Media:** Movies and Games usually only occupy a single `Media` row.
- **Serialized Media:** TV Shows and Anime utilize `Season` rows linked to a parent `Media`. Each `Season` can possess its own independent `Episode` rows.
- **Root Season Exception:** For massive franchises, the `Media` row itself often acts as both the franchise container AND the "Season 1" container. Therefore, episodic metadata, streaming watch providers (`watchData`), and anime opening/ending themes (`themeData`) can be stored as JSON blobs either directly on the `Media` table (for Season 1/Roots) or on the `Season` table (for subsequent seasons).

---

## 4. The Mega-Franchise Anime Pipeline
The most complex logic in the entire application revolves around synchronizing and unifying Anime data. AniList (the primary source) organizes media into a messy, interconnected graph of generic "nodes", while TMDb organizes them strictly into Show -> Season -> Episode hierarchies. The application bridges this gap using the **Mega-Franchise Protocol**.

### 4.1 True Root Traversal
When a user queries any random spin-off or sequel season (e.g., *Naruto Shippuden*), the backend intercepts this and executes a recursive GraphQL traversal up the AniList `PREQUEL` and `PARENT` edges. It dynamically calculates the absolute "Root" of the franchise (e.g., *Naruto*), protecting against false usurpers (like an overarching franchise tag taking over a specific TV continuity).

### 4.2 Timeline Construction & Asynchronous Workers
Once the true root is found, the system dispatches a `BackgroundJob` to map the franchise tree. Because API rate limits and graph traversal are incredibly slow, this happens entirely asynchronously. The UI intelligently polls the job table and displays skeleton loaders to the user until the worker completes.

### 4.3 Multi-API Cross-Pollination
The background worker executes a brutal data aggregation sequence:
1. **AniList** dictates the canonical timeline, deciding what constitutes a canon movie, season, or spin-off.
2. **MAL-Sync** provides translation, mapping the AniList ID to a MAL ID and attempting to map to a TMDb ID. If the TMDb ID is missing, the worker attempts an intelligent fuzzy-search directly against TMDb using normalized Japanese/English titles.
3. **Jikan (via MAL ID)** is queried to fetch the actual Opening and Ending songs (`themeData`).
4. **TMDb** is queried for the `episodeData` (thumbnails, descriptions, runtimes) and `watchData` (Crunchyroll, Netflix streaming links).

### 4.4 TMDb Episodic Chunking
AniList often splits stories into "Cours" (e.g., Season 3 Part 1 and Season 3 Part 2), while TMDb merges them into a single monolithic Season 3. The worker handles this by downloading all TMDb episodes, sorting them, and then "chunking" or slicing the array based on the exact episode counts provided by AniList. This prevents metadata misalignment in later seasons. 
- *Fallback Defenses*: For ongoing shows where AniList reports `null` for total episodes, the app falls back to `nextAiringEpisode`, then TMDb's episode array length, to prevent infinite loops and `Unknown Episode` bugs.

### 4.5 Jikan Franchise Pipeline (MAL Fallback)
For scenarios requiring MyAnimeList-centric metadata mapping, the system incorporates a fallback Jikan franchise graph crawler (`src/lib/jikan-franchise.ts`). This module recursively traverses relations (Sequels, Prequels, Spin-offs) from the Jikan API using rate-limit backoffs to construct a unified canonical timeline and updates relevant API caches.

### 9. MangaDex Chapters & Licensing Warnings
To present manga chapters like anime episodes (with volume grouping and dropdowns):
- **Live MangaDex Feed:** The application maps MangaDex IDs (using score-based matching to prioritize original works over official colored or doujinshi variants) and fetches English chapters directly from the public MangaDex API on the client side.
- **Client-Side Deduplication:** It groups and deduplicates chapters by chapter number to clean up duplicate scanlation group uploads.
- **Dynamic Manga Status & Pills:** Displays the status of the manga (e.g. `Publishing`, `Hiatus`, `Finished`) with custom themed colors, and fetches total chapters/volumes from the aggregate endpoint when AniList returns null for ongoing series.
- **MangaPlus & Viz Licensing Banner:** Detects if intermediate chapters have expired from MangaDex/MangaPlus (due to publisher licensing/simulpub policies) by checking if the fetched chapter count is significantly lower than the highest chapter found. It renders a informative notice to explain the gap to the user.

---

## 5. User Profiles, Ranking, & the Elo Engine
Media Tracker moves beyond traditional 5-star logging and implements competitive tiering.

### 5.1 Deep Reviews & Gamification
Users log media in the `user_ratings` table. They can provide a simple 1-100 score, or write a **Deep Review**, which breaks the score down across dynamic JSON criteria (Narrative, Visuals, Acting, Soundtrack, Gameplay).
Users also earn `UserBadge` unlocks for specific milestones, displayed on their unified profiles alongside dynamic statistics (genre bias, total watch time).

### 5.2 The Rank Aggregation Engine (Elo Leaderboards)
The platform allows users to build infinite custom `UserList`s and drag-and-drop items into exact relative positions (`user_list_items`).
A dedicated background algorithm aggregates these positions globally to generate a definitive tier list in the `global_rankings` table.
- **Positional Weighting:** The mathematical value of a ranking is weighted by its exact position.
- **Emotional Score Gaps:** The engine calculates the differential between the user's raw score and their list position to establish severity.
- **Exponential Time Decay:** Older lists lose mathematical authority over time, preventing early review-bombing or nostalgia from permanently locking the global leaderboard.

## Under Construction / Upcoming Features

- **Creator Profiles Syncing:** The `syncPersonCrossPlatform` background worker engine to query cross-platform APIs (TMDb, AniList, RAWG) and build out fully unified creator biographies is under active development.

---

## 6. Frontend Presentation Layer
The UI is built to scale gracefully between standard items and massive franchises.
- **Dynamic Chunked Pagination:** For Anime/TV shows exceeding 50 episodes, the `<EpisodeList>` component dynamically splits the episodes into chunks of 50. It maintains a strict **Universal Ascending (1 to N)** sort logic, automatically generating precise dropdown labels (e.g., "Episodes 1 - 50", "Episodes 51 - 100"). The episode number badges are securely decoupled from array indices.
- **Anime Themes Stack:** The `<AnimeThemes>` component renders massive arrays of openings/endings as stacked pills, utilizing strict text-line clamping to prevent UI bloat while retaining all data.
- **God-Tier Credits Parser:** The `credits-parser` logic sifts through thousands of raw AniList staff nodes. It uses complex Regex blocklists to instantly drop international dub voice actors (English, Spanish, etc.) and specific string matching to bubble up the "Architects" (Series Director, Original Creator, Composer) into a dedicated top-level UI grid.

---

## 7. Developer Tooling & Admin Dashboard
The app ships with robust tools for maintainers:
- **`src/lib/db-wipe.ts` & Admin UI Nuke:** A highly specific nuclear script mapped to the Admin Dashboard via a secure client-side **Nuke Database** button (`WipeDatabaseButton.tsx` and Server Action). It targets and wipes all `episodes`, `seasons`, `media`, `user_ratings`, `user_lists`, `background_jobs`, `api_cache`, and `system_logs`. It intentionally requiring double-confirmation ("nuke" text prompt verification) and spares `users`, `accounts`, `sessions`, and `verification_tokens` so that Admin rights and OAuth sessions survive the wipe.
- **`system_logs`:** Every major action, error, or background worker lifecycle event is logged directly to PostgreSQL for inspection in the Admin UI.
- **`npm run make-admin`:** A command-line script to rapidly promote a user's role to Admin.
