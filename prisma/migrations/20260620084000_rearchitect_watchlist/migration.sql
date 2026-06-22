-- CreateEnum
CREATE TYPE "WatchlistStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'DROPPED');

-- Drop existing default constraint
ALTER TABLE "user_watchlist" ALTER COLUMN "status" DROP DEFAULT;

-- Map existing status strings to enum values
UPDATE "user_watchlist" SET "status" = 'PLANNING' WHERE "status" = 'plan_to_watch' OR "status" IS NULL;
UPDATE "user_watchlist" SET "status" = 'IN_PROGRESS' WHERE "status" = 'watching' OR "status" = 'in_progress';
UPDATE "user_watchlist" SET "status" = 'COMPLETED' WHERE "status" = 'completed';
UPDATE "user_watchlist" SET "status" = 'ON_HOLD' WHERE "status" = 'on_hold' OR "status" = 'on-hold';
UPDATE "user_watchlist" SET "status" = 'DROPPED' WHERE "status" = 'dropped';

-- Fallback for any other values
UPDATE "user_watchlist" SET "status" = 'PLANNING' WHERE "status" NOT IN ('PLANNING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'DROPPED');

-- AlterTable for user_watchlist
ALTER TABLE "user_watchlist" ALTER COLUMN "status" TYPE "WatchlistStatus" USING "status"::"WatchlistStatus";
ALTER TABLE "user_watchlist" ALTER COLUMN "status" SET DEFAULT 'PLANNING';
ALTER TABLE "user_watchlist" ALTER COLUMN "status" SET NOT NULL;

ALTER TABLE "user_watchlist" ADD COLUMN     "started_at" TIMESTAMPTZ(6),
ADD COLUMN     "finished_at" TIMESTAMPTZ(6),
ADD COLUMN     "is_rewatching" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_rereading" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hoursPlayed" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "platform" TEXT,
ADD COLUMN     "watchCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "activity_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "media_id" TEXT NOT NULL,
    "increment" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_log_user_id_created_at_idx" ON "activity_log"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add rawgId to people
ALTER TABLE "people" ADD COLUMN "rawgId" INTEGER;
CREATE UNIQUE INDEX "people_rawgId_key" ON "people"("rawgId");
