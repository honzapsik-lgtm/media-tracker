import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  ActivityType,
  FriendshipStatus,
  MediaType,
  VisibilityLevel,
  WatchlistStatus,
} from "@prisma/client";
import { refreshMediaStats, updateUserStatsCache } from "../src/lib/media-db";

async function main() {
  console.log("Starting friend test seeding...");

  // 1. Find the target user ("me")
  const targetUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: "honzapsik@email.cz" },
        { username: "cloudy" },
      ],
    },
  });

  if (!targetUser) {
    console.error("Target user not found!");
    process.exit(1);
  }

  console.log(`Found target user: ${targetUser.name || targetUser.username} (${targetUser.id})`);

  // Ensure target user has privacy settings
  await prisma.userPrivacySettings.upsert({
    where: { user_id: targetUser.id },
    update: {},
    create: {
      user_id: targetUser.id,
      profile_visibility: VisibilityLevel.PUBLIC,
      ratings_visibility: VisibilityLevel.PUBLIC,
      watchlist_visibility: VisibilityLevel.PUBLIC,
      activity_visibility: VisibilityLevel.PUBLIC,
    },
  });

  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000);
  const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000);

  // 2. Define mock users
  const mockUsersData = [
    {
      name: "Sarah Connor",
      username: "sarahc",
      email: "sarah.connor@example.com",
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80",
      realName: "Sarah Connor",
      stateRegion: "California",
      country: "United States",
      showcaseBadges: ["masterpiece", "ratings_10"],
      badges: ["masterpiece", "ratings_10"],
      ratings: [
        {
          media_id: "tmdb-movie-157336",
          media_title: "Interstellar",
          media_image: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
          media_release_date: "2014-11-05",
          media_type: MediaType.MOVIE,
          score: 95,
          review_text: "Absolute cinematic masterpiece. Hans Zimmer's score gives me goosebumps every single time.",
          is_deep_review: true,
          criteria_scores: { Narrative: 94, Visuals: 98, Audio: 100, Acting: 92 },
          created_at: hoursAgo(2),
        },
        {
          media_id: "tmdb-tv-94605",
          media_title: "Arcane",
          media_image: "https://image.tmdb.org/t/p/w500/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg",
          media_release_date: "2021-11-06",
          media_type: MediaType.SHOW,
          score: 98,
          review_text: "Unmatched animation quality and storytelling. The depth of character writing in Piltover and Zaun is transcendent.",
          is_deep_review: true,
          criteria_scores: { Narrative: 96, Visuals: 100, Audio: 97, Pacing: 95 },
          created_at: hoursAgo(5),
        },
        {
          media_id: "igdb-game-119133",
          media_title: "Elden Ring",
          media_image: "https://images.igdb.com/igdb/image/upload/t_1080p/co4jni.jpg",
          media_release_date: "2022-02-25",
          media_type: MediaType.GAME,
          score: 92,
          review_text: "Incredible world design and freedom of exploration. The Lands Between are endlessly fascinating.",
          is_deep_review: false,
          criteria_scores: {},
          created_at: daysAgo(2),
        },
      ],
      watchlist: [
        {
          media_id: "tmdb-movie-157336",
          media_title: "Interstellar",
          media_image: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
          media_type: MediaType.MOVIE,
          status: WatchlistStatus.COMPLETED,
          watchCount: 3,
        },
        {
          media_id: "tmdb-tv-94605",
          media_title: "Arcane",
          media_image: "https://image.tmdb.org/t/p/w500/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg",
          media_type: MediaType.SHOW,
          status: WatchlistStatus.COMPLETED,
          episodesWatched: 9,
        },
        {
          media_id: "igdb-game-119133",
          media_title: "Elden Ring",
          media_image: "https://images.igdb.com/igdb/image/upload/t_1080p/co4jni.jpg",
          media_type: MediaType.GAME,
          status: WatchlistStatus.COMPLETED,
          hoursPlayed: 124.5,
          platform: "PC",
        },
        {
          media_id: "tmdb-tv-95557",
          media_title: "Severance",
          media_image: "https://image.tmdb.org/t/p/w500/4tblBrslcKSifMVZ3TmtT2ukMor.jpg",
          media_type: MediaType.SHOW,
          status: WatchlistStatus.IN_PROGRESS,
          episodesWatched: 7,
        },
      ],
      activities: [
        {
          type: ActivityType.RATED_MEDIA,
          media_id: "tmdb-movie-157336",
          media_title: "Interstellar",
          media_image: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
          media_type: MediaType.MOVIE,
          data: { score: 95, isDeepReview: true },
          created_at: hoursAgo(2),
        },
        {
          type: ActivityType.RATED_MEDIA,
          media_id: "tmdb-tv-94605",
          media_title: "Arcane",
          media_image: "https://image.tmdb.org/t/p/w500/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg",
          media_type: MediaType.SHOW,
          data: { score: 98, isDeepReview: true },
          created_at: hoursAgo(5),
        },
        {
          type: ActivityType.EPISODES_WATCHED,
          media_id: "tmdb-tv-95557",
          media_title: "Severance",
          media_image: "https://image.tmdb.org/t/p/w500/4tblBrslcKSifMVZ3TmtT2ukMor.jpg",
          media_type: MediaType.SHOW,
          data: { episode: 7 },
          created_at: daysAgo(1),
        },
        {
          type: ActivityType.WATCHLIST_STATUS,
          media_id: "igdb-game-119133",
          media_title: "Elden Ring",
          media_image: "https://images.igdb.com/igdb/image/upload/t_1080p/co4jni.jpg",
          media_type: MediaType.GAME,
          data: { status: "COMPLETED" },
          created_at: daysAgo(2),
        },
      ],
    },
    {
      name: "Kenji Sato",
      username: "kenji",
      email: "kenji.sato@example.com",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
      realName: "Kenji Sato",
      stateRegion: "Tokyo",
      country: "Japan",
      showcaseBadges: ["manga_10", "ratings_10"],
      badges: ["manga_10", "ratings_10"],
      ratings: [
        {
          media_id: "tmdb-tv-1429",
          media_title: "Attack on Titan",
          media_image: "https://image.tmdb.org/t/p/w500/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg",
          media_release_date: "2013-04-07",
          media_type: MediaType.SHOW,
          score: 94,
          review_text: "Peak fiction. The plot twists and ideological clashes are unmatched in modern anime.",
          is_deep_review: true,
          criteria_scores: { Narrative: 98, Visuals: 93, Audio: 96, Pacing: 88 },
          created_at: daysAgo(1),
        },
        {
          media_id: "mangadex-manga-a77742b1-befd-49a4-bff5-1ad4e6b0ef7b",
          media_title: "Chainsaw Man",
          media_image: "https://uploads.mangadex.org/covers/a77742b1-befd-49a4-bff5-1ad4e6b0ef7b/6e518bd1-5f60-446b-8832-bfe6bf74834b.jpg.512.jpg",
          media_release_date: "2018-12-03",
          media_type: MediaType.MANGA,
          score: 88,
          review_text: "Fujimoto's cinematic paneling and unpredictable chaos makes every chapter a thrill.",
          is_deep_review: false,
          criteria_scores: {},
          created_at: hoursAgo(3),
        },
        {
          media_id: "igdb-game-1877",
          media_title: "Cyberpunk 2077",
          media_image: "https://images.igdb.com/igdb/image/upload/t_1080p/coaih8.jpg",
          media_release_date: "2020-12-10",
          media_type: MediaType.GAME,
          score: 85,
          review_text: "After Phantom Liberty and 2.0 update, Night City is finally the immersive RPG it was promised to be.",
          is_deep_review: true,
          criteria_scores: { Gameplay: 84, Visuals: 95, Narrative: 89, Audio: 90 },
          created_at: hoursAgo(8),
        },
      ],
      watchlist: [
        {
          media_id: "tmdb-tv-1429",
          media_title: "Attack on Titan",
          media_image: "https://image.tmdb.org/t/p/w500/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg",
          media_type: MediaType.SHOW,
          status: WatchlistStatus.COMPLETED,
          episodesWatched: 89,
        },
        {
          media_id: "mangadex-manga-a77742b1-befd-49a4-bff5-1ad4e6b0ef7b",
          media_title: "Chainsaw Man",
          media_image: "https://uploads.mangadex.org/covers/a77742b1-befd-49a4-bff5-1ad4e6b0ef7b/6e518bd1-5f60-446b-8832-bfe6bf74834b.jpg.512.jpg",
          media_type: MediaType.MANGA,
          status: WatchlistStatus.IN_PROGRESS,
          chaptersRead: 165,
          volumesRead: 15,
        },
        {
          media_id: "igdb-game-1877",
          media_title: "Cyberpunk 2077",
          media_image: "https://images.igdb.com/igdb/image/upload/t_1080p/coaih8.jpg",
          media_type: MediaType.GAME,
          status: WatchlistStatus.COMPLETED,
          hoursPlayed: 82.0,
          platform: "PlayStation 5",
        },
      ],
      activities: [
        {
          type: ActivityType.CHAPTERS_READ,
          media_id: "mangadex-manga-a77742b1-befd-49a4-bff5-1ad4e6b0ef7b",
          media_title: "Chainsaw Man",
          media_image: "https://uploads.mangadex.org/covers/a77742b1-befd-49a4-bff5-1ad4e6b0ef7b/6e518bd1-5f60-446b-8832-bfe6bf74834b.jpg.512.jpg",
          media_type: MediaType.MANGA,
          data: { chapter: 165 },
          created_at: hoursAgo(3),
        },
        {
          type: ActivityType.RATED_MEDIA,
          media_id: "igdb-game-1877",
          media_title: "Cyberpunk 2077",
          media_image: "https://images.igdb.com/igdb/image/upload/t_1080p/coaih8.jpg",
          media_type: MediaType.GAME,
          data: { score: 85, isDeepReview: true },
          created_at: hoursAgo(8),
        },
        {
          type: ActivityType.RATED_MEDIA,
          media_id: "tmdb-tv-1429",
          media_title: "Attack on Titan",
          media_image: "https://image.tmdb.org/t/p/w500/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg",
          media_type: MediaType.SHOW,
          data: { score: 94, isDeepReview: true },
          created_at: daysAgo(1),
        },
        {
          type: ActivityType.HOURS_PLAYED,
          media_id: "igdb-game-1877",
          media_title: "Cyberpunk 2077",
          media_image: "https://images.igdb.com/igdb/image/upload/t_1080p/coaih8.jpg",
          media_type: MediaType.GAME,
          data: { hours: 82 },
          created_at: daysAgo(2),
        },
      ],
    },
    {
      name: "Elena Rostova",
      username: "elena_r",
      email: "elena.rostova@example.com",
      image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
      realName: "Elena Rostova",
      stateRegion: "Berlin",
      country: "Germany",
      showcaseBadges: ["masterpiece", "ratings_10"],
      badges: ["masterpiece", "ratings_10"],
      ratings: [
        {
          media_id: "tmdb-movie-129",
          media_title: "Spirited Away",
          media_image: "https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
          media_release_date: "2001-07-20",
          media_type: MediaType.MOVIE,
          score: 99,
          review_text: "Miyazaki's magnum opus. A whimsical, melancholic journey that feels like a beautiful dream you never want to wake from.",
          is_deep_review: true,
          criteria_scores: { Narrative: 98, Visuals: 100, Audio: 100, "Emotional Impact": 100 },
          created_at: hoursAgo(1),
        },
        {
          media_id: "tmdb-tv-1396",
          media_title: "Breaking Bad",
          media_image: "https://image.tmdb.org/t/p/w500/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg",
          media_release_date: "2008-01-20",
          media_type: MediaType.SHOW,
          score: 97,
          review_text: "Flawless television from start to finish. Bryan Cranston and Aaron Paul gave performances of a lifetime.",
          is_deep_review: true,
          criteria_scores: { Narrative: 100, Acting: 100, Cinematography: 95, Pacing: 94 },
          created_at: hoursAgo(6),
        },
        {
          media_id: "igdb-game-204350",
          media_title: "The Last of Us Part I",
          media_image: "https://images.igdb.com/igdb/image/upload/t_1080p/coa1gq.jpg",
          media_release_date: "2022-09-02",
          media_type: MediaType.GAME,
          score: 93,
          review_text: "Emotionally devastating and brilliantly paced. The environmental storytelling remains the industry gold standard.",
          is_deep_review: false,
          criteria_scores: {},
          created_at: hoursAgo(18),
        },
      ],
      watchlist: [
        {
          media_id: "tmdb-movie-129",
          media_title: "Spirited Away",
          media_image: "https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
          media_type: MediaType.MOVIE,
          status: WatchlistStatus.COMPLETED,
          watchCount: 4,
        },
        {
          media_id: "tmdb-tv-1396",
          media_title: "Breaking Bad",
          media_image: "https://image.tmdb.org/t/p/w500/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg",
          media_type: MediaType.SHOW,
          status: WatchlistStatus.COMPLETED,
          episodesWatched: 62,
        },
        {
          media_id: "igdb-game-204350",
          media_title: "The Last of Us Part I",
          media_image: "https://images.igdb.com/igdb/image/upload/t_1080p/coa1gq.jpg",
          media_type: MediaType.GAME,
          status: WatchlistStatus.COMPLETED,
          hoursPlayed: 18.5,
          platform: "PlayStation 5",
        },
      ],
      activities: [
        {
          type: ActivityType.RATED_MEDIA,
          media_id: "tmdb-movie-129",
          media_title: "Spirited Away",
          media_image: "https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
          media_type: MediaType.MOVIE,
          data: { score: 99, isDeepReview: true },
          created_at: hoursAgo(1),
        },
        {
          type: ActivityType.WATCHLIST_STATUS,
          media_id: "tmdb-tv-1396",
          media_title: "Breaking Bad",
          media_image: "https://image.tmdb.org/t/p/w500/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg",
          media_type: MediaType.SHOW,
          data: { status: "COMPLETED" },
          created_at: hoursAgo(6),
        },
        {
          type: ActivityType.RATED_MEDIA,
          media_id: "igdb-game-204350",
          media_title: "The Last of Us Part I",
          media_image: "https://images.igdb.com/igdb/image/upload/t_1080p/coa1gq.jpg",
          media_type: MediaType.GAME,
          data: { score: 93 },
          created_at: hoursAgo(18),
        },
        {
          type: ActivityType.FAVORITED,
          media_id: "tmdb-movie-129",
          media_title: "Spirited Away",
          media_image: "https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
          media_type: MediaType.MOVIE,
          data: {},
          created_at: daysAgo(1),
        },
      ],
    },
    {
      name: "Marcus Vance",
      username: "marcus_v",
      email: "marcus.vance@example.com",
      image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
      realName: "Marcus Vance",
      stateRegion: "London",
      country: "United Kingdom",
      showcaseBadges: ["void_stare"],
      badges: ["void_stare"],
      ratings: [
        {
          media_id: "tmdb-movie-634492",
          media_title: "Madame Web",
          media_image: "https://image.tmdb.org/t/p/w500/rULWuutDcN5NvtiZi4FRPzRYWSh.jpg",
          media_release_date: "2024-02-14",
          media_type: MediaType.MOVIE,
          score: 22,
          review_text: "Bafflingly poor dialogue and disjointed editing. An unintentional comedy from start to finish.",
          is_deep_review: true,
          criteria_scores: { Narrative: 15, Acting: 25, Visuals: 40, Audio: 35 },
          created_at: hoursAgo(4),
        },
        {
          media_id: "tmdb-movie-624860",
          media_title: "The Matrix Resurrections",
          media_image: "https://image.tmdb.org/t/p/w500/8c4a8kE7PizaGQQnditMmI1xbRp.jpg",
          media_release_date: "2021-12-22",
          media_type: MediaType.MOVIE,
          score: 45,
          review_text: "Interesting meta-commentary in the first act, but devolves into uninspired nostalgia-bait action.",
          is_deep_review: false,
          criteria_scores: {},
          created_at: daysAgo(1),
        },
      ],
      watchlist: [
        {
          media_id: "tmdb-movie-634492",
          media_title: "Madame Web",
          media_image: "https://image.tmdb.org/t/p/w500/rULWuutDcN5NvtiZi4FRPzRYWSh.jpg",
          media_type: MediaType.MOVIE,
          status: WatchlistStatus.DROPPED,
          watchCount: 1,
        },
        {
          media_id: "tmdb-movie-624860",
          media_title: "The Matrix Resurrections",
          media_image: "https://image.tmdb.org/t/p/w500/8c4a8kE7PizaGQQnditMmI1xbRp.jpg",
          media_type: MediaType.MOVIE,
          status: WatchlistStatus.COMPLETED,
          watchCount: 1,
        },
      ],
      activities: [
        {
          type: ActivityType.RATED_MEDIA,
          media_id: "tmdb-movie-634492",
          media_title: "Madame Web",
          media_image: "https://image.tmdb.org/t/p/w500/rULWuutDcN5NvtiZi4FRPzRYWSh.jpg",
          media_type: MediaType.MOVIE,
          data: { score: 22, isDeepReview: true },
          created_at: hoursAgo(4),
        },
        {
          type: ActivityType.WATCHLIST_STATUS,
          media_id: "tmdb-movie-634492",
          media_title: "Madame Web",
          media_image: "https://image.tmdb.org/t/p/w500/rULWuutDcN5NvtiZi4FRPzRYWSh.jpg",
          media_type: MediaType.MOVIE,
          data: { status: "DROPPED" },
          created_at: hoursAgo(4),
        },
        {
          type: ActivityType.RATED_MEDIA,
          media_id: "tmdb-movie-624860",
          media_title: "The Matrix Resurrections",
          media_image: "https://image.tmdb.org/t/p/w500/8c4a8kE7PizaGQQnditMmI1xbRp.jpg",
          media_type: MediaType.MOVIE,
          data: { score: 45 },
          created_at: daysAgo(1),
        },
      ],
    },
  ];

  const touchedMediaIds = new Set<string>();

  for (const mock of mockUsersData) {
    console.log(`Processing mock user: ${mock.username} (${mock.email})...`);

    // Upsert User
    const user = await prisma.user.upsert({
      where: { email: mock.email },
      update: {
        name: mock.name,
        username: mock.username,
        image: mock.image,
        realName: mock.realName,
        stateRegion: mock.stateRegion,
        country: mock.country,
        showcaseBadges: mock.showcaseBadges,
      },
      create: {
        name: mock.name,
        username: mock.username,
        email: mock.email,
        image: mock.image,
        realName: mock.realName,
        stateRegion: mock.stateRegion,
        country: mock.country,
        showcaseBadges: mock.showcaseBadges,
        role: "user",
      },
    });

    // Privacy Settings
    await prisma.userPrivacySettings.upsert({
      where: { user_id: user.id },
      update: {
        profile_visibility: VisibilityLevel.PUBLIC,
        ratings_visibility: VisibilityLevel.PUBLIC,
        watchlist_visibility: VisibilityLevel.PUBLIC,
        activity_visibility: VisibilityLevel.PUBLIC,
      },
      create: {
        user_id: user.id,
        profile_visibility: VisibilityLevel.PUBLIC,
        ratings_visibility: VisibilityLevel.PUBLIC,
        watchlist_visibility: VisibilityLevel.PUBLIC,
        activity_visibility: VisibilityLevel.PUBLIC,
      },
    });

    // Badges
    for (const badgeId of mock.badges) {
      await prisma.userBadge.upsert({
        where: { user_id_badge_id: { user_id: user.id, badge_id: badgeId } },
        update: {},
        create: {
          user_id: user.id,
          badge_id: badgeId,
          unlocked_at: daysAgo(5),
        },
      });
    }

    // Clean up previous records for this mock user to prevent stale/broken media IDs
    await prisma.userRating.deleteMany({ where: { user_id: user.id } });
    await prisma.userWatchlist.deleteMany({ where: { user_id: user.id } });
    await prisma.userActivity.deleteMany({ where: { user_id: user.id } });

    // Ratings
    for (const r of mock.ratings) {
      touchedMediaIds.add(r.media_id);
      await prisma.userRating.upsert({
        where: { user_id_media_id: { user_id: user.id, media_id: r.media_id } },
        update: {
          score: r.score,
          review_text: r.review_text,
          is_deep_review: r.is_deep_review,
          criteria_scores: r.criteria_scores,
          media_title: r.media_title,
          media_image: r.media_image,
          media_release_date: r.media_release_date,
          username: mock.name,
          avatar_url: mock.image,
          created_at: r.created_at,
        },
        create: {
          user_id: user.id,
          media_id: r.media_id,
          score: r.score,
          review_text: r.review_text,
          is_deep_review: r.is_deep_review,
          criteria_scores: r.criteria_scores,
          media_title: r.media_title,
          media_image: r.media_image,
          media_release_date: r.media_release_date,
          username: mock.name,
          avatar_url: mock.image,
          created_at: r.created_at,
        },
      });
    }

    // Watchlist
    for (const w of mock.watchlist) {
      await prisma.userWatchlist.upsert({
        where: { user_id_media_id: { user_id: user.id, media_id: w.media_id } },
        update: {
          media_title: w.media_title,
          media_image: w.media_image,
          media_type: w.media_type,
          status: w.status,
          watchCount: (w as any).watchCount ?? 0,
          episodesWatched: (w as any).episodesWatched ?? 0,
          chaptersRead: (w as any).chaptersRead ?? 0,
          volumesRead: (w as any).volumesRead ?? 0,
          hoursPlayed: (w as any).hoursPlayed ?? 0,
          platform: (w as any).platform ?? null,
        },
        create: {
          user_id: user.id,
          media_id: w.media_id,
          media_title: w.media_title,
          media_image: w.media_image,
          media_type: w.media_type,
          status: w.status,
          watchCount: (w as any).watchCount ?? 0,
          episodesWatched: (w as any).episodesWatched ?? 0,
          chaptersRead: (w as any).chaptersRead ?? 0,
          volumesRead: (w as any).volumesRead ?? 0,
          hoursPlayed: (w as any).hoursPlayed ?? 0,
          platform: (w as any).platform ?? null,
        },
      });
    }

    // Create fresh activities

    // Create fresh activities
    for (const act of mock.activities) {
      await prisma.userActivity.create({
        data: {
          user_id: user.id,
          type: act.type,
          media_id: act.media_id,
          media_title: act.media_title,
          media_image: act.media_image,
          media_type: act.media_type,
          data: act.data,
          created_at: act.created_at,
        },
      });
    }

    // Pre-calculate user stats cache for all media types
    for (const type of [MediaType.MOVIE, MediaType.SHOW, MediaType.GAME, MediaType.MANGA]) {
      try {
        await updateUserStatsCache(user.id, type, "seed");
      } catch (err) {
        // ignore if none exists
      }
    }

    // Pending Friend Request: from mock user (sender) to target user (receiver)
    await prisma.friendship.upsert({
      where: {
        sender_id_receiver_id: {
          sender_id: user.id,
          receiver_id: targetUser.id,
        },
      },
      update: {
        status: FriendshipStatus.PENDING,
      },
      create: {
        sender_id: user.id,
        receiver_id: targetUser.id,
        status: FriendshipStatus.PENDING,
      },
    });

    console.log(`Created PENDING friend request from ${mock.username} -> ${targetUser.username}`);
  }

  // Refresh media stats for all touched items
  console.log("Refreshing media stats...");
  for (const mediaId of touchedMediaIds) {
    try {
      await refreshMediaStats(mediaId);
    } catch (err) {
      console.error(`Error refreshing media stats for ${mediaId}:`, err);
    }
  }

  console.log("Seeding completed successfully!");
}

main()
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
