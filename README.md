# Media Tracker: System Architecture & Deep Dive Documentation

This document serves as the definitive source of truth for the **Media Tracker** application. It is intentionally written with extreme detail and architectural depth to provide developers, system maintainers, and AI coding assistants a complete, holistic understanding of the entire codebase, its relational database design, third-party data pipelines, and frontend features.

---

## Table of Contents

1. [Core Purpose & Vision](#1-core-purpose--vision)
2. [Technology Stack & Infrastructure](#2-technology-stack--infrastructure)
3. [Database Architecture & "The Rosetta Stone"](#3-database-architecture--the-rosetta-stone)
   - [3.1 The Universal Media Table](#31-the-universal-media-table)
   - [3.2 The External ID Mapping Layer](#32-the-external-id-mapping-layer)
   - [3.3 Relational Hierarchies (Media -> Seasons -> Episodes)](#33-relational-hierarchies-media---seasons---episodes)
   - [3.4 User Profiles, Authentication & Roles](#34-user-profiles-authentication--roles)
   - [3.5 Social Graph & Privacy Settings](#35-social-graph--privacy-settings)
   - [3.6 Rating, Deep Review & Watchlist Schema](#36-rating-deep-review--watchlist-schema)
   - [3.7 Custom Lists & Global Rankings Table](#37-custom-lists--global-rankings-table)
   - [3.8 Activity Logs & Structured System Logs](#38-activity-logs--structured-system-logs)
   - [3.9 Universal Person & Company Store](#39-universal-person--company-store)
   - [3.10 Background Jobs & API Caching Layer](#310-background-jobs--api-caching-layer)
4. [Third-Party APIs & Data Pipeline Architecture](#4-third-party-apis--data-pipeline-architecture)
   - [4.1 The Movie Database (TMDb)](#41-the-movie-database-tmdb)
   - [4.2 MangaDex API](#42-mangadex-api)
   - [4.3 Internet Game Database (IGDB) via Twitch OAuth](#43-internet-game-database-igdb-via-twitch-oauth)
   - [4.4 AnimeThemes.moe API](#44-animethemesmoe-api)
   - [4.5 Jikan API (MyAnimeList v4)](#45-jikan-api-myanimelist-v4)
   - [4.6 AniList GraphQL](#46-anilist-graphql)
   - [4.7 RAWG Video Games API](#47-rawg-video-games-api)
   - [4.8 JustWatch Streaming Providers](#48-justwatch-streaming-providers)
5. [Core Application Features & Subsystems](#5-core-application-features--subsystems)
   - [5.1 Unified Media Detail Pages (/media/[id])](#51-unified-media-detail-pages-mediaid)
   - [5.2 Anime Canon & Storyline Engine](#52-anime-canon--storyline-engine)
   - [5.3 Anime Themes Engine (Seasonal vs. Continuous)](#53-anime-themes-engine-seasonal-vs-continuous)
   - [5.4 Search & Discovery Engine (/search, /discover)](#54-search--discovery-engine-search-discover)
   - [5.5 Creator & Company Profiles (/person/[id], /company/[id])](#55-creator--company-profiles-personid-companyid)
   - [5.6 Social, Friends & Real-Time Activity Feed](#56-social-friends--real-time-activity-feed)
   - [5.7 Watchlist & Deep Progress Tracking Engine](#57-watchlist--deep-progress-tracking-engine)
   - [5.8 Scoring System & Deep Reviews](#58-scoring-system--deep-reviews)
   - [5.9 Custom Lists & Global Rank Aggregation (PageRank / Elo Engine)](#59-custom-lists--global-rank-aggregation-pagerank--elo-engine)
   - [5.10 Gamification & Automated Badges](#510-gamification--automated-badges)
   - [5.11 Admin Dashboard & Maintenance Subsystem (/admin)](#511-admin-dashboard--maintenance-subsystem-admin)
6. [Project Directory & File Structure](#6-project-directory--file-structure)
7. [Environment Variables & Configuration](#7-environment-variables--configuration)
8. [Setup & Local Development](#8-setup--local-development)

---

## 1. Core Purpose & Vision

**Media Tracker** is a unified, full-stack web application engineered to serve as the definitive centralized ecosystem for discovering, tracking, reviewing, socially comparing, and mathematically ranking all forms of entertainment media.

Traditional platforms strictly segregate media into isolated silos (e.g., Letterboxd for movies, Serializd for TV shows, MyAnimeList/AniList for anime and manga, Backloggd for games). Media Tracker breaks these silos down, treating **Movies, TV Shows, Anime, Manga, and Video Games** as first-class, interconnected citizens within a unified database and user experience.

Key capabilities include:
- **Universal Cross-Media Tracking:** Track progress for episodes watched, chapters/volumes read, hours played, or movies logged in a single interface.
- **Universal Provider Routing:** Instant resolution of media and creators across TMDb, MangaDex, IGDB, RAWG, AnimeThemes.moe, and AniList.
- **Narrative Timeline Continuity:** Intelligent reconciliation of anime seasons, finale TV specials, and canon theatrical movies into a coherent viewing order.
- **Deep Reviews:** 1-100 score sliders paired with multi-axis criteria breakdowns tailored per media type (e.g. Narrative, Visuals, Gameplay, Audio, Cinematography).
- **Social Network & Activity Feed:** Friend requests, real-time activity timelines, friend rating overlays on media pages, and granular privacy controls.
- **Global Mathematical Ranking:** A PageRank-powered Elo aggregation engine that translates user tier lists into a definitive global media leaderboard with emotional gap multipliers and exponential time decay.
- **Enterprise-Grade Admin Panel:** Real-time metrics, cache inspection, job queue retries, system log search, and a session-preserving database reset ("Nuke") tool.

---

## 2. Technology Stack & Infrastructure

- **Framework:** **Next.js 16** (App Router paradigm) heavily leveraging React Server Components (RSC) for instantaneous, SEO-optimized renders, Server Actions for mutations, and streaming Suspense boundaries.
- **Language:** **TypeScript 5** (Strict type-checking enforced across all API contracts, UI props, database schemas, and server actions).
- **Frontend UI & Styling:** **React 19**, **Tailwind CSS v4** (configured for high-contrast, dark-mode-first glassmorphism), and **Lucide React** icons.
- **Database:** **PostgreSQL 16**, hosted locally via Docker Compose or production cloud instances.
- **ORM & Connection Pooling:** **Prisma 7.8** with `@prisma/adapter-pg` and `pg` connection pooling for reliable high-throughput database interactions.
- **Authentication:** **NextAuth.js v4** with OAuth providers (**Discord**, **Google**), persistent PostgreSQL session storage (`@next-auth/prisma-adapter`), custom role authorization (`admin` vs `user`), and an onboarding username flow.
- **Background Worker & Task Queue:** An asynchronous task queue system backed by the `BackgroundJob` table and `/api/worker` endpoint for deferring intensive processing (badge unlocks, user stats).
- **Mathematical Computation Engine:** Standalone TypeScript worker (`scripts/rank-aggregation-worker.ts`) implementing directed graph PageRank power iteration with time decay and score differentials.

---

## 3. Database Architecture & "The Rosetta Stone"

The Prisma schema (`prisma/schema.prisma`) defines 23 models and enums that bridge disparate media formats and provider IDs into a unified relational graph.

```mermaid
erDiagram
    Media ||--o{ Season : has
    Media ||--o{ Episode : has
    Media ||--o{ Media : "relatedMedia"
    User ||--o{ UserRating : rates
    User ||--o{ UserWatchlist : tracks
    User ||--o{ UserList : creates
    UserList ||--o{ UserListItem : contains
    User ||--o{ UserBadge : unlocks
    User ||--o{ UserActivity : logs
    User ||--o| UserPrivacySettings : configures
    User ||--o{ Friendship : "sends/receives"
    User ||--o{ UserFriendPreference : mutes
```

### 3.1 The Universal `Media` Table
Every piece of content is anchored in the `media` table:
- `id` (String / UUID): Primary universal identifier.
- `title` (String): Normalized canonical title.
- `type` (`MediaType` enum: `SHOW`, `MOVIE`, `GAME`, `MANGA`, `OTHER`).
- `isMainStoryline` (Boolean): Distinguishes main canonical entries from spin-offs/OVAs.
- `releaseDate` (String): ISO date string.
- `relatedMediaId` / `relatedMedia` / `inverseRelated`: Self-referential relation establishing parent franchise trees, sequels, and prequels.
- `themeData` (Json): Cached openings and endings `{ openings: string[], endings: string[], groups: AnimeThemeGroup[] }`.
- `watchData` (Json): Cached streaming availability `{ flatrate: Provider[], rent: Provider[], buy: Provider[] }`.
- `episodeData` (Json): Root season episodic metadata.
- `staffData` (Json), `castData` (Json), `studioData` (Json): Production credits.
- `franchiseSyncedAt` (DateTime): Timestamp of last synchronization.

### 3.2 The External ID Mapping Layer
Because Media Tracker ingests data from disparate external sources, the `media` table acts as a Rosetta Stone with unique mapping columns:
- `tmdbId` (Int? @unique): Links movies, TV shows, and anime to The Movie Database for high-res artwork, episodes, and streaming availability.
- `mangadexId` (String? @unique): UUID linking manga to MangaDex for covers, author profiles, and live English chapters.
- `igdbId` (Int? @unique): Primary key linking games to the Internet Game Database for platforms, genres, and character credits.
- `malId` (Int? @unique): MyAnimeList ID, used to query Jikan API endpoints.
- `anilistId` (Int? @unique): Legacy identifier for anime/manga node graph references.

### 3.3 Relational Hierarchies (Media -> Seasons -> Episodes)
- **`Season` Table:** Serialized shows and anime utilize `Season` rows linked to a parent `Media` via `mediaId` (with `onDelete: Cascade`). Contains `seasonNumber`, `releaseDate`, `episodeData`, `themeData`, and season-specific cast/staff JSON.
- **`Episode` Table:** Stores granular episodic records with air dates, stills, runtimes, vote averages, and synopses.

### 3.4 User Profiles, Authentication & Roles
- **`User` Table:**
  - `id` (UUID): Primary key.
  - `name`, `username` (unique), `email` (unique), `emailVerified`, `image`.
  - `realName`, `stateRegion`, `country`.
  - `showcaseBadges` (String[]): Array of badge IDs showcased on the user's profile.
  - `role` (String, default: `"user"`): Access control flag (`"user"` or `"admin"`).
- **OAuth Tables (`Account`, `Session`, `VerificationToken`):** Fully integrated with `@next-auth/prisma-adapter` for Discord and Google OAuth.

### 3.5 Social Graph & Privacy Settings
- **`Friendship` Table:**
  - `sender_id`, `receiver_id` (UUIDs linking to `User`).
  - `status` (`FriendshipStatus` enum: `PENDING`, `ACCEPTED`, `DECLINED`, `BLOCKED`).
  - `created_at`, `updated_at`.
- **`UserPrivacySettings` Table:**
  - Configures visibility (`PUBLIC`, `FRIENDS_ONLY`, `PRIVATE`) for:
    - `profile_visibility`
    - `ratings_visibility`
    - `watchlist_visibility`
    - `activity_visibility`
- **`UserFriendPreference` Table:**
  - Per-friend fine-grained mute controls:
    - `hide_activity` (Boolean): Mutes this friend's activities from your timeline.
    - `hide_ratings` (Boolean): Hides this friend's rating overlays from media detail pages.

### 3.6 Rating, Deep Review & Watchlist Schema
- **`UserRating` Table:**
  - `user_id`, `media_id` (Unique composite key).
  - `score` (Int: 1-100).
  - `is_deep_review` (Boolean): Indicates whether the review includes multi-axis criteria scores.
  - `criteria_scores` (Json): Scores out of 100 for configured sub-criteria (e.g., Narrative, Visuals, Gameplay).
  - `review_text` (String?): Optional markdown review.
  - `rank_position` (Int?): Custom tier list placement.
- **`UserWatchlist` Table:**
  - `user_id`, `media_id` (Unique composite key).
  - `status` (`WatchlistStatus` enum: `PLANNING`, `IN_PROGRESS`, `COMPLETED`, `ON_HOLD`, `DROPPED`).
  - `episodesWatched` (Int), `is_rewatching` (Boolean) - for TV Shows & Anime.
  - `chaptersRead` (Int), `volumesRead` (Int), `is_rereading` (Boolean) - for Manga.
  - `hoursPlayed` (Float), `platform` (String?) - for Video Games.
  - `watchCount` (Int) - for Movies.
  - `started_at`, `finished_at` (Timestamps).

### 3.7 Custom Lists & Global Rankings Table
- **`UserList` Table:**
  - `id` (UUID), `user_id`, `title` (String), `description` (String?), `media_type` (`MediaType`).
- **`UserListItem` Table:**
  - `list_id`, `media_id`, `media_title`, `media_image`.
  - `rank_position` (Int): 1-indexed relative placement in the user's custom tier list.
- **`GlobalRanking` Table:**
  - `media_id`, `media_type`.
  - `elo_score` (Float, default: 1200.0).
  - `rank` (Int): Integer ranking computed by the mathematical PageRank aggregation worker.

### 3.8 Activity Logs & Structured System Logs
- **`UserActivity` Table:**
  - Chronological audit log for social activity streams.
  - `type` (`ActivityType` enum: `RATED_MEDIA`, `WATCHLIST_STATUS`, `EPISODES_WATCHED`, `CHAPTERS_READ`, `VOLUMES_READ`, `HOURS_PLAYED`, `FAVORITED`, `CUSTOM`).
  - Stores snapshot data (`media_id`, `media_title`, `media_image`, `media_type`, `data` JSON).
- **`SystemLog` Table:**
  - Centralized application log storage.
  - `level` (`INFO`, `WARN`, `ERROR`), `event`, `message`, `requestId`, `userId`, `durationMs`, `errorStack`, `metadata` JSON.

### 3.9 Universal Person & Company Store
- **`Person` Table:**
  - Normalized creator records with external IDs: `tmdbId`, `anilistId`, `igdbId`, `malId`, `rawgId`, `mangadexId`.
  - `name`, `nativeName`, `biography`, `profileImage`, `birthDate`, `deathDate`, `knownForDepartment`.
  - `mergedCredits` (Json): Consolidated filmography/ludography/bibliography.
- **`Company` Table:**
  - Production studios, animation companies, and publishers.
  - `tmdbId`, `anilistId`, `igdbId`, `tmdbNetworkId`, `name`, `description`, `logoUrl`, `country`, `mergedWorks` (Json).

### 3.10 Background Jobs & API Caching Layer
- **`BackgroundJob` Table:**
  - Durable task queue with `type`, `payload` JSON, `status` (`pending`, `locked`, `completed`, `failed`), `dedupe_key`, `attempts`, `max_attempts`, `locked_at`, `locked_by`, `run_at`, `last_error`.
- **`ApiCache` Table:**
  - Persistent key-value cache: `id` (String primary key), `provider` (String), `data` (Json), `created_at`, `expires_at`.

---

## 4. Third-Party APIs & Data Pipeline Architecture

Media Tracker coordinates 8 external APIs to power its multi-media database.

| Provider | Media Formats Supported | Key Use Cases | Caching & Rate Limits |
| :--- | :--- | :--- | :--- |
| **The Movie Database (TMDb)** | Movies, TV Shows, Anime | Metadata, posters/backdrops, trailers, `aggregate_credits` (full cast across all seasons), episodic data, JustWatch streaming providers | 24-hour cache in `ApiCache`, HTTP 3600s Next.js revalidation |
| **MangaDex** | Manga, Light Novels, One-shots | Manga search, 512px cover art, author/artist bios, live English scanlation feeds, volume grouping | 24-hour search cache, direct public REST API |
| **IGDB (Twitch)** | Video Games | Game metadata, covers, screenshots, platforms, genres, developers/publishers, character credits | App access token OAuth cache, 24-hour cache |
| **AnimeThemes.moe** | Anime TV, Movies, Specials | Opening and ending themes, artists, episode range mappings, video streaming mirrors | Cache key `anime-themes-v4-*` in `ApiCache` (7 days) |
| **Jikan (MAL v4)** | Anime, Manga | Fallback theme songs, MyAnimeList ID translation, franchise graph relations | Strict rate-limit wrapper (3 req/sec with exponential backoff) |
| **AniList GraphQL** | Anime, Manga | Legacy franchise tree references, character portraits, studio metadata | GraphQL queries with 50ms sleep delays and 429 recovery |
| **RAWG** | Video Games | Game discover search, developer team credits | 6-hour cache in `ApiCache` |
| **JustWatch (via TMDb)** | Movies, TV Shows | Regional flatrate (streaming), rent, and buy links (Netflix, Crunchyroll, Prime, Hulu, Apple TV) | Ingested via TMDb `watch/providers` sub-resource |

---

## 5. Core Application Features & Subsystems

### 5.1 Unified Media Detail Pages (`/media/[id]`)
Media detail pages adapt dynamically based on the media format:

- **Universal Slug Parsing (`src/lib/media-db.ts`):**
  - `tmdb-movie-[id]`: Fetches movie details, release dates, full cast, directors, writers, trailers, and streaming options.
  - `tmdb-tv-[id]`: Fetches TV series details, seasons, `aggregate_credits` for all seasons, and episodic metadata.
  - `igdb-[id]`: Fetches video game information, platforms, engines, developers, screenshots, and characters.
  - `mangadex-[id]`: Fetches manga details, synopsis, author/artist credits, tags, and chapter list.
  - `anilist-[id]`: Fallback anime/manga details from AniList.
- **Hero Artwork & Badges:** Renders ultra-high-resolution backdrops with dark gradient masking, title, original Japanese/native title, release year, age ratings, runtimes, status pills, and genre badges.
- **Interactive Action Bar:**
  - **Watchlist Dropdown:** Real-time status toggling (`Planning`, `Watching/Reading/Playing`, `Completed`, `On Hold`, `Dropped`).
  - **Progress Tracker:** In-depth modal and tracker component tailored to the media type.
  - **Rating Button:** Opens the score slider and deep review editor.
  - **Add to Custom List:** Modal to insert or re-rank the item within custom user tier lists.
  - **Bookmark:** Quick toggle for personal bookmarks.
- **Full Cast & Crew Modal:**
  - TV shows query TMDb's `aggregate_credits` endpoint to fetch **every single actor across all seasons** (sorted by total episode count), removing the previous 50-actor cap.
  - Displays character portraits alongside actor headshots and role names.
  - The "Full Cast & Crew" button launches a modal displaying all credited cast and crew members.
- **Left Sidebar Modules:**
  - **Streaming Providers (`WatchProviders.tsx`):** Displays regional streaming services (e.g., Crunchyroll, Netflix, Hulu, Prime Video).
  - **Anime Themes (`AnimeThemes.tsx`):** Displays opening and ending songs.
  - **Source Material & External Links:** Direct links to MangaDex manga source, IMDb, TMDb, MAL, AniList, and IGDB.
- **Social Rating Overlay ("Friends Who Rated This"):** Displays friends' avatars, numerical ratings, and review snippets directly on the media page.

---

### 5.2 Anime Canon & Storyline Engine
Anime franchises frequently have messy production timelines where final story chapters air as TV specials or canonical movies rather than standard numbered episodes. The anime engine (`src/lib/anime-canon.ts`) reconciles these inconsistencies:

- **Canon Specials Integration (`CANON_SPECIAL_RULES`):**
  - Shows like *Attack on Titan* conclude Season 4 with two broadcast specials (*The Final Chapters Specials 1 & 2*), categorized by TMDb under Season 0 (Specials).
  - The engine automatically maps these specials into the Season 4 episode list as canonical finale episodes (`isFinaleSpecial: true`), while excluding them from Season 0 so they are not duplicated in the OVAs section.
- **Canon Theatrical Continuations (`CANON_FRANCHISE_MOVIES`):**
  - Maps canon theatrical movies directly into the show's Narrative Timeline:
    - *Jujutsu Kaisen 0* (Prequel movie) positioned before Season 1.
    - *Demon Slayer: Kimetsu no Yaiba - The Movie: Mugen Train* positioned between Season 1 and Entertainment District Arc.
    - *Demon Slayer: Infinity Castle* trilogy positioned after Season 5 (Hashira Training Arc).
- **Episode Count Synchronization (`getAdjustedSeasons`):**
  - Dynamically recalculates season episode counts to account for integrated specials, ensuring progress bars and completion percentages remain accurate.

---

### 5.3 Anime Themes Engine (Seasonal vs. Continuous)
The anime themes engine (`src/lib/jikan.ts` & `src/components/AnimeThemes.tsx`) integrates with **AnimeThemes.moe** with automatic fallback to **Jikan (MAL)**:

```mermaid
flowchart TD
    A[Fetch Themes Query] --> B{Movie or TV?}
    B -->|Movie| C[Isolate Movie Entry]
    C --> D[Return Single Movie Themes - No Season Tabs]
    B -->|TV Show| E[Analyze AnimeThemes.moe Entries]
    E --> F{Count Seasonal Names > 1?}
    F -->|Yes: Seasonal Show| G[Group by Season Names: Season 1, Season 2, etc.]
    G --> H[Map Kanketsu Specials to Final Season]
    G --> I[Exclude Movies & OVAs from TV Tabs]
    F -->|No: Continuous Show| J[Extract Episode Ranges from Openings: 1-47, 48-115]
    J --> K[Match Overlapping Endings to Ranges]
    J --> L[Render Scrollable Episode Range Selector]
```

- **Seasonal Anime (e.g. *Attack on Titan*, *Demon Slayer*, *Jujutsu Kaisen*):**
  - Grouped into discrete season buttons (**Season 1**, **Season 2**, **Season 3**, **The Final Season**).
  - No confusing episode range buttons (`EPS 1-25`) are shown when season names exist.
  - Movies and OVAs are excluded from the main TV season tabs to eliminate clutter.
  - Broadcast specials (e.g. *Kanketsu-hen*) are mapped into their parent season (e.g., *The Final Season* captures all 3 OPs and 5 EDs including *Saigo no Kyojin*, *UNDER THE TREE*, *Nisen-nen...*, and *Itterasshai*).
- **Continuous Anime (e.g. *One Piece*, *Bleach*, *Naruto*):**
  - Continuous series with dozens of openings use the exact **episode ranges** provided by the API (`1-47`, `48-115`, `116-168`, etc.) as interactive selector buttons.
  - Overlapping endings that aired during that broadcast window are matched to the corresponding range.
  - The selector buttons are housed in a scrollable container with a "+ Show All" toggle to keep the sidebar compact.
- **Dedicated Movie Theme Isolation:**
  - Standalone movie pages (e.g., *Demon Slayer: Mugen Train*) display exclusively that movie's theme songs (e.g., *"Homura"*), omitting TV season tabs.
- **Individual Season Pages:**
  - Season pages (e.g. `/media/tmdb-tv-1429/season/4`) display only the themes specific to that season.

---

### 5.4 Search & Discovery Engine (`/search`, `/discover`)
- **Multi-Tab Search (`SearchResultsTabs.tsx`):**
  - Search across **All Media**, **Movies**, **Shows**, **Games**, **Manga**, and **Users**.
  - **Direct MangaDex Search (`searchMangaDex`):** Queries the MangaDex API directly, fetching 512px covers, English titles, and release years while filtering out doujinshis.
  - **User Search:** Search for other users by username or real name, and send friend requests directly from the search results.
- **Search Navigation Retention (`BackToSearchButton.tsx`):**
  - When navigating from search results into a media page, `sessionStorage` stores the full query URL.
  - Clicking the "← Back to Search" button returns the user to their exact search results, active tab, and query without reloading or redirecting to Home.
- **Discover Page (`/discover` & `discoverMedia` action):**
  - Filter across media types by **Genre** (Action, Drama, Sci-Fi, etc.), **Release Year**, and **Sort Order** (Popularity, Highest Rated, Newest).
  - 6-hour caching in `ApiCache` for fast subsequent loads.

---

### 5.5 Creator & Company Profiles (`/person/[id]`, `/company/[id]`)
Creator profiles (`src/lib/person.ts`) utilize a direct, universal slug architecture:

- **Universal Slug Formats:**
  - `mangadex-[uuid]` or bare UUID: Fetches MangaDex authors and artists.
  - `tmdb-[id]` or bare integer: Fetches TMDb directors, actors, and writers.
  - `igdb-[id]`: Fetches video game creators.
  - `anilist-[id]`: Fetches anime staff and voice actors.
  - `rawg-[id]`: Fetches game developers.
- **Direct Fetching:**
  - Completely eliminates background sync queues and fragile fuzzy matching workers.
  - Checks the local database first; if missing, fetches directly from the provider, writes to the `Person` table with `mergedCredits`, and renders immediately.
- **MangaDex Creator Integration (`fetchMangaDexPerson`):**
  - Fetches author/artist biographies, Twitter, Pixiv, and official website links.
  - Queries `authors[]` and `artists[]` in parallel to compile their complete catalog of works with 512px covers.
- **Company & Studio Profiles (`/company/[id]`):**
  - Displays film studios, animation companies (MAPPA, Ufotable, Bones), and game publishers with their complete catalogs of released works.

---

### 5.6 Social, Friends & Real-Time Activity Feed
- **Friend Request Lifecycle (`src/app/api/friends/route.ts`):**
  - Send friend requests by username.
  - Accept, decline, or cancel pending requests.
  - Block/unblock users.
- **Friends Manager (`FriendsManager.tsx`):**
  - Embedded in the user profile under the `Friends` tab.
  - Separate tabs for **Active Friends**, **Pending Received**, and **Pending Sent**.
  - Per-friend controls: Unfriend, Mute Activity (`hide_activity`), Mute Ratings (`hide_ratings`).
- **Real-Time Activity Feed (`FriendActivityFeed.tsx`):**
  - Displays a chronological feed of friends' actions:
    - Rated a media item (with numerical score and criteria).
    - Updated watchlist status (Started, Finished, Dropped).
    - Incremented progress (Watched episode 45, Read chapter 120).
    - Logged hours played on a game.
- **Granular Privacy Settings (`PrivacySettingsModal.tsx`):**
  - Set visibility (`Public`, `Friends Only`, `Private`) for:
    - Profile
    - Ratings & Reviews
    - Watchlist & Progress
    - Activity Feed
- **Username Onboarding Flow (`UsernamePromptModal.tsx`):**
  - Automatically prompts new OAuth users on their first login to choose a unique username before interacting with social features.

---

### 5.7 Watchlist & Deep Progress Tracking Engine
The watchlist tracker (`WatchlistProgressTracker.tsx`) provides specialized progress controls tailored to each media format:

- **Five Standard States:** `PLANNING`, `IN_PROGRESS`, `COMPLETED`, `ON_HOLD`, `DROPPED`.
- **TV Shows & Anime:**
  - "+1 Episode" increment button with real-time progress bar.
  - Auto-completes when `episodesWatched === totalEpisodes`.
  - "Rewatching" toggle to track multiple viewing runs.
- **Manga:**
  - Dual counters: **Chapters Read** and **Volumes Read**.
  - "Rereading" toggle.
  - Live MangaDex chapter browser with scanlation deduplication and MangaPlus licensing alert banner.
- **Video Games:**
  - Decimal hours tracker (e.g. `45.5 hours played`).
  - Platform selector (PC, PlayStation 5, Xbox Series X/S, Nintendo Switch, etc.).
- **Movies:**
  - Watch count tracker for rewatches.
- **Automatic Audit Logging:**
  - Every increment automatically writes to `ActivityLog` and creates a `UserActivity` entry.

---

### 5.8 Scoring System & Deep Reviews
- **1-100 Score Slider (`RatingSlider.tsx`):**
  - Fluid slider with dynamic score-tier color codes:
    - **95 – 100:** Gold with glowing drop-shadow (`#FACC15`)
    - **75 – 94:** Vibrant Green (`#4ADE80`)
    - **50 – 74:** Sky Blue (`#60A5FA`)
    - **25 – 49:** Neutral Grey (`#9CA3AF`)
    - **1 – 24:** Dark Charcoal (`#374151`)
- **Deep Review Multi-Axis Criteria (`CRITERIA_CONFIG`):**
  - **Video Games:** Narrative, Gameplay, Visuals & Graphics, Performance, Audio & Soundtrack.
  - **Movies:** Narrative, Cinematography, Sound & Score, Acting Performances.
  - **TV Shows & Seasons:** Narrative, Cinematography, Sound & Score, Acting Performances, Ending.
  - **Manga:** Narrative, Art Style, Characters, Character Development.
- **Community Criteria Averages:**
  - Aggregates community scores across each axis and renders comparative visual bar charts on the media page.

---

### 5.9 Custom Lists & Global Rank Aggregation (PageRank / Elo Engine)
Users can construct custom ordered lists (e.g., "Top 10 Anime of All Time", "Best Soulslike Games") and drag-and-drop items into ranked positions.

The global ranking engine (`scripts/rank-aggregation-worker.ts`) aggregates these user lists into a global leaderboard:

```mermaid
flowchart LR
    A[User Lists] --> B[Directed Pairwise Comparison Graph]
    B --> C[Modulate Edge Weights via Emotional Gap]
    C --> D[Apply Exponential Time Decay]
    D --> E[Power Iteration PageRank Convergence]
    E --> F[GlobalRanking Table by MediaType]
```

#### 1. Pairwise Directed Comparison Graph
For every list, each item is compared pairwise against every item ranked below it. A directed edge is created from the lower-ranked item ($L$) to the higher-ranked item ($W$).

#### 2. Emotional Score Gap Multiplier
If the user also gave explicit 1-100 ratings to both items, the edge weight is adjusted by their score difference:
$$\text{gapMultiplier} = 1.0 + \left(\frac{|Score_W - Score_L|}{100}\right) \times 0.2$$

#### 3. Exponential Time Decay
Older list placements gradually decay in authority, preventing legacy review-bombing from permanently freezing the leaderboard:
$$\text{decay} = 0.5^{\frac{\text{daysOld}}{\text{HALF\_LIFE\_DAYS}}}$$
$$\text{edgeWeight} = \text{gapMultiplier} \times \max(0.5, \text{decay})$$

#### 4. Power Iteration PageRank Convergence
The adjacency matrix is solved via power iteration:
$$R_{t+1} = \frac{1 - d}{N} + d \sum_{j \in M(i)} \frac{R_t(j)}{C(j)}$$
- Damping factor $d = 0.85$
- Convergence threshold: $0.00001$
- Max iterations: $100$

Results are normalized and written to the `GlobalRanking` table partitioned by `media_type`.

---

### 5.10 Gamification & Automated Badges
- **Milestone Evaluation (`award_badges` job):**
  - Background workers periodically evaluate user logging statistics against badge criteria (e.g., 100 Anime Watched, 50 Manga Read, 25 Games Played).
  - Unlocked badges are stored in `UserBadge` with timestamps.
- **Showcase Badges:**
  - Users can select up to 3 unlocked badges to showcase in their profile header.

---

### 5.11 Admin Dashboard & Maintenance Subsystem (`/admin`)
Users with `role = 'admin'` have access to the administrative suite:

- **`/admin` (System Overview):** Real-time metric cards displaying total users, media items, ratings, reviews, cache entries, and queued jobs.
- **`/admin/users`:** Search and manage user accounts, assign or revoke `admin` privileges.
- **`/admin/cache`:** Search, inspect, and delete individual keys in `ApiCache`, or flush by provider (`tmdb`, `mangadex`, `igdb`, `jikan`).
- **`/admin/jobs`:** Monitor the `BackgroundJob` queue, view execution attempt counters, inspect failure stack traces, and retry failed jobs.
- **`/admin/logs`:** Searchable real-time stream of `SystemLog` entries with filtering by log level (`INFO`, `WARN`, `ERROR`) and duration.
- **`/admin/database`:** Database table row counts and storage utilization stats.
- **Database Wipe Engine ("Nuke Database"):**
  - Initiated via the Admin UI with double-confirmation (requires typing the word `"nuke"`).
  - Executes `wipeAppData()` (`src/lib/db-wipe.ts`) within an atomic Prisma transaction.
  - **Preserves User Accounts & Sessions:** Deletes media, ratings, watchlists, custom lists, cache, jobs, and logs, but **safely preserves** the `users`, `accounts`, `sessions`, and `verification_tokens` tables so admin logins and OAuth credentials survive the wipe.

---

## 6. Project Directory & File Structure

```
media-tracker/
├── prisma/
│   └── schema.prisma                  # 23 Prisma models and enums
├── scripts/
│   ├── clear-cache.ts                 # CLI cache flush utility
│   ├── make-admin.ts                  # CLI script to grant admin role by email
│   ├── make-user.ts                   # CLI script to demote user
│   ├── nuke-db.ts                     # CLI database reset script
│   ├── rank-aggregation-worker.ts     # Mathematical PageRank / Elo worker
│   └── wipe-everything.ts             # Complete database purge script
├── src/
│   ├── app/
│   │   ├── actions.ts                 # Server actions (discoverMedia, getSeasonEpisodes)
│   │   ├── admin/                     # Admin dashboard pages
│   │   │   ├── cache/                 # Cache inspector
│   │   │   ├── database/              # Database row counts & Nuke UI
│   │   │   ├── jobs/                  # Background jobs monitor
│   │   │   ├── logs/                  # System logs viewer
│   │   │   ├── media/                 # Media catalog inspector
│   │   │   ├── performance/           # Response latency monitors
│   │   │   └── users/                 # User role management
│   │   ├── api/                       # API route handlers
│   │   │   ├── activity/              # User activity streams
│   │   │   ├── admin/                 # Admin operations (nuke, cache, jobs, metrics)
│   │   │   ├── auth/                  # NextAuth handler
│   │   │   ├── friends/               # Friend request CRUD
│   │   │   ├── lists/                 # Custom lists API
│   │   │   ├── media/                 # Media resolution endpoint
│   │   │   ├── person/                # Creator profiles endpoint
│   │   │   ├── profile/               # Username onboarding & privacy settings
│   │   │   ├── rankings/              # Global rankings endpoint
│   │   │   ├── ratings/               # User ratings & friend ratings
│   │   │   ├── search/                # Multi-type search endpoint
│   │   │   ├── watchlist/             # Watchlist & progress tracker API
│   │   │   └── worker/                # Background job queue executor
│   │   ├── company/[id]/              # Studio / publisher detail pages
│   │   ├── discover/                  # Discover & filter explore page
│   │   ├── media/[id]/                # Universal media detail pages
│   │   │   └── season/[seasonNumber]/ # Individual TV / Anime season pages
│   │   ├── person/[id]/               # Creator profile pages
│   │   ├── profile/                   # Current user profile & friends manager
│   │   ├── rankings/                  # Global media leaderboard pages
│   │   ├── search/                    # Unified multi-tab search page
│   │   └── user/[username]/           # Public user profile pages
│   ├── components/
│   │   ├── AnimeThemes.tsx            # Seasonal & continuous anime theme player
│   │   ├── AppDrawer.tsx              # Mobile navigation drawer
│   │   ├── BackToSearchButton.tsx     # Session-aware back button
│   │   ├── CustomListsManager.tsx     # Drag-and-drop tier list builder
│   │   ├── DiscoverFilters.tsx        # Filter controls for /discover
│   │   ├── EpisodeList.tsx            # 50-episode chunked episode browser
│   │   ├── ExpandableCast.tsx         # TMDb full cast & crew modal
│   │   ├── ExpandableAniListCast.tsx  # Anime character & voice actor modal
│   │   ├── FriendActionButton.tsx     # Friend request button component
│   │   ├── FriendActivityFeed.tsx     # Chronological friend activity stream
│   │   ├── FriendsManager.tsx         # Profile tab for managing friendships
│   │   ├── FriendsRatingSection.tsx   # "Friends Who Rated This" media widget
│   │   ├── MangaChapters.tsx          # MangaDex live chapter feed reader
│   │   ├── MangaMetadataPills.tsx     # Manga publication status badges
│   │   ├── PrivacySettingsModal.tsx   # Privacy visibility controls modal
│   │   ├── RatingSlider.tsx           # 1-100 score slider + deep criteria
│   │   ├── SearchResultsTabs.tsx      # Multi-type search tabs
│   │   ├── StaffGrid.tsx              # Top architects (Director, Author, Composer)
│   │   ├── UsernamePromptModal.tsx    # Onboarding username prompt modal
│   │   ├── WatchProviders.tsx         # Streaming availability widget
│   │   ├── WatchlistProgressTracker.tsx # Specialized progress incrementer
│   │   └── admin/                     # Admin UI components (NukeButton, AdminBadge)
│   ├── config/
│   │   └── ranking.ts                 # PageRank math constants
│   ├── lib/
│   │   ├── activity.ts                # Activity logging helpers
│   │   ├── anime-canon.ts             # Anime canon specials & movies rules
│   │   ├── api-cache.ts               # Database-backed API cache helper
│   │   ├── auth.ts                    # NextAuth configuration
│   │   ├── company.ts                 # Studio & company fetcher
│   │   ├── constants.ts               # Review criteria configs per media type
│   │   ├── credits-parser.ts          # Role normalizer & architect extractor
│   │   ├── db-wipe.ts                 # Safe database wipe transaction
│   │   ├── games.ts                   # IGDB Twitch API integration
│   │   ├── jikan.ts                   # AnimeThemes.moe + Jikan theme engine
│   │   ├── jobs.ts                    # Background job queue dispatch helpers
│   │   ├── logger.ts                  # Structured PostgreSQL logger
│   │   ├── mangadex.ts                # MangaDex search, covers, and chapters
│   │   ├── media-db.ts                # Multi-provider media resolution engine
│   │   ├── person.ts                  # Universal creator profile fetcher
│   │   ├── prisma.ts                  # Prisma client singleton with pg pool
│   │   └── tmdb.ts                    # TMDb movies, shows, aggregate_credits
│   └── types/                         # TypeScript interfaces
```

---

## 7. Environment Variables & Configuration

Create a `.env` file in the root directory:

```env
# Database (PostgreSQL)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/media_tracker?schema=public"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-secure-random-secret"

# OAuth Providers
DISCORD_CLIENT_ID="your-discord-client-id"
DISCORD_CLIENT_SECRET="your-discord-client-secret"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# The Movie Database (TMDb)
TMDB_API_KEY="your-tmdb-api-3-key"

# IGDB (Internet Game Database via Twitch Developer)
TWITCH_CLIENT_ID="your-twitch-client-id"
TWITCH_CLIENT_SECRET="your-twitch-client-secret"

# RAWG Video Games Database
RAWG_API_KEY="your-rawg-api-key"
```

---

## 8. Setup & Local Development

### 1. Prerequisites
- **Node.js:** version 20.x or later (v24 tested).
- **PostgreSQL:** version 15+ running locally or via Docker.

### 2. Install Dependencies
```bash
npm install
```

### 3. Start PostgreSQL with Docker (Optional)
If you don't have a local PostgreSQL instance running:
```bash
docker run --name media-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=media_tracker -p 5432:5432 -d postgres:16
```

### 4. Initialize Database Schema
Push the Prisma schema to PostgreSQL and generate the Prisma Client:
```bash
npx prisma db push
npx prisma generate
```

### 5. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Promote a User to Admin
Log in once via Discord or Google OAuth, then run:
```bash
npm run make-admin your-email@example.com
```

### 7. Run the Global Rank Aggregation Engine
To process all user lists and recalculate the global leaderboards:
```bash
npx tsx scripts/rank-aggregation-worker.ts
```

### 8. Database Reset Utility
To wipe application data while preserving user accounts and OAuth sessions:
```bash
npm run db:wipe
```
*(Or use the interactive **Nuke Database** button inside `/admin/database`)*.
