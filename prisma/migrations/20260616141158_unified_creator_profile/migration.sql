/*
  Warnings:

  - The `media_type` column on the `user_watchlist` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `user_ranked_lists` table. If the table is not empty, all the data it contains will be lost.
  - Changed the type of `media_type` on the `UserStatsCache` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `media_type` on the `media_stats` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('SHOW', 'MOVIE', 'GAME', 'MANGA', 'OTHER');

-- DropForeignKey
ALTER TABLE "user_ranked_lists" DROP CONSTRAINT "user_ranked_lists_user_id_fkey";

-- AlterTable
ALTER TABLE "UserStatsCache" DROP COLUMN "media_type",
ADD COLUMN     "media_type" "MediaType" NOT NULL;

-- AlterTable
ALTER TABLE "media_stats" DROP COLUMN "media_type",
ADD COLUMN     "media_type" "MediaType" NOT NULL;

-- AlterTable
ALTER TABLE "user_ratings" ADD COLUMN     "media_release_date" TEXT;

-- AlterTable
ALTER TABLE "user_watchlist" ADD COLUMN     "chaptersRead" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "episodesWatched" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "volumesRead" INTEGER NOT NULL DEFAULT 0,
DROP COLUMN "media_type",
ADD COLUMN     "media_type" "MediaType";

-- DropTable
DROP TABLE "user_ranked_lists";

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "anilistId" INTEGER,
    "title" TEXT,
    "type" "MediaType" NOT NULL,
    "isMainStoryline" BOOLEAN NOT NULL DEFAULT false,
    "releaseDate" TEXT,
    "tmdbId" INTEGER,
    "igdbId" INTEGER,
    "mangadexId" TEXT,
    "malId" INTEGER,
    "themeData" JSONB,
    "watchData" JSONB,
    "episodeData" JSONB,
    "relatedMediaId" TEXT,
    "staffData" JSONB,
    "castData" JSONB,
    "studioData" JSONB,
    "franchiseSyncedAt" TIMESTAMP(3),

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "anilistId" INTEGER,
    "tmdbId" INTEGER,
    "episodeData" JSONB,
    "mediaId" TEXT NOT NULL,
    "releaseDate" TEXT,
    "staffData" JSONB,
    "castData" JSONB,
    "studioData" JSONB,
    "themeData" JSONB,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "episodes" (
    "id" TEXT NOT NULL,
    "anilistId" INTEGER,
    "tmdbId" INTEGER,
    "episodeData" JSONB,
    "mediaId" TEXT NOT NULL,

    CONSTRAINT "episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_lists" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "media_type" "MediaType" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_list_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "list_id" UUID NOT NULL,
    "media_id" TEXT NOT NULL,
    "media_title" TEXT,
    "media_image" TEXT,
    "rank_position" INTEGER NOT NULL,

    CONSTRAINT "user_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_rankings" (
    "media_id" TEXT NOT NULL,
    "media_type" "MediaType" NOT NULL,
    "elo_score" DOUBLE PRECISION NOT NULL DEFAULT 1200.0,
    "rank" INTEGER,

    CONSTRAINT "global_rankings_pkey" PRIMARY KEY ("media_id")
);

-- CreateTable
CREATE TABLE "people" (
    "id" TEXT NOT NULL,
    "tmdbId" INTEGER,
    "anilistId" INTEGER,
    "igdbId" INTEGER,
    "malId" INTEGER,
    "name" TEXT NOT NULL,
    "nativeName" TEXT,
    "biography" TEXT,
    "profileImage" TEXT,
    "birthDate" TEXT,
    "deathDate" TEXT,
    "knownForDepartment" TEXT,
    "mergedCredits" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_anilistId_key" ON "media"("anilistId");

-- CreateIndex
CREATE UNIQUE INDEX "media_tmdbId_key" ON "media"("tmdbId");

-- CreateIndex
CREATE UNIQUE INDEX "media_igdbId_key" ON "media"("igdbId");

-- CreateIndex
CREATE UNIQUE INDEX "media_mangadexId_key" ON "media"("mangadexId");

-- CreateIndex
CREATE UNIQUE INDEX "media_malId_key" ON "media"("malId");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_anilistId_key" ON "seasons"("anilistId");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_tmdbId_key" ON "seasons"("tmdbId");

-- CreateIndex
CREATE UNIQUE INDEX "episodes_anilistId_key" ON "episodes"("anilistId");

-- CreateIndex
CREATE UNIQUE INDEX "episodes_tmdbId_key" ON "episodes"("tmdbId");

-- CreateIndex
CREATE INDEX "user_lists_user_id_media_type_idx" ON "user_lists"("user_id", "media_type");

-- CreateIndex
CREATE INDEX "user_list_items_list_id_rank_position_idx" ON "user_list_items"("list_id", "rank_position");

-- CreateIndex
CREATE UNIQUE INDEX "user_list_items_list_id_media_id_key" ON "user_list_items"("list_id", "media_id");

-- CreateIndex
CREATE INDEX "global_rankings_media_type_elo_score_idx" ON "global_rankings"("media_type", "elo_score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "people_tmdbId_key" ON "people"("tmdbId");

-- CreateIndex
CREATE UNIQUE INDEX "people_anilistId_key" ON "people"("anilistId");

-- CreateIndex
CREATE UNIQUE INDEX "people_igdbId_key" ON "people"("igdbId");

-- CreateIndex
CREATE UNIQUE INDEX "people_malId_key" ON "people"("malId");

-- CreateIndex
CREATE UNIQUE INDEX "UserStatsCache_user_id_media_type_key" ON "UserStatsCache"("user_id", "media_type");

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_relatedMediaId_fkey" FOREIGN KEY ("relatedMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_lists" ADD CONSTRAINT "user_lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_list_items" ADD CONSTRAINT "user_list_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "user_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
