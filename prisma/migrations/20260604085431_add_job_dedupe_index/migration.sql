-- CreateTable
CREATE TABLE "media_stats" (
    "id" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "community_average" DECIMAL DEFAULT 0,
    "total_ratings" INTEGER DEFAULT 0,

    CONSTRAINT "media_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "user_id" UUID NOT NULL,
    "badge_id" TEXT NOT NULL,
    "unlocked_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("user_id","badge_id")
);

-- CreateTable
CREATE TABLE "user_ranked_lists" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "media_id" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "rank_position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_ranked_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_ratings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "media_id" TEXT NOT NULL,
    "media_title" TEXT,
    "media_image" TEXT,
    "score" INTEGER NOT NULL,
    "review_text" TEXT,
    "username" TEXT,
    "avatar_url" TEXT,
    "criteria_scores" JSONB DEFAULT '{}',
    "is_deep_review" BOOLEAN DEFAULT false,
    "rank_position" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_watchlist" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "media_id" TEXT NOT NULL,
    "media_title" TEXT,
    "media_image" TEXT,
    "media_type" TEXT,
    "status" TEXT DEFAULT 'plan_to_watch',
    "added_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "realName" TEXT,
    "stateRegion" TEXT,
    "country" TEXT,
    "showcaseBadges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "role" TEXT NOT NULL DEFAULT 'user',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "ApiCache" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStatsCache" (
    "user_id" UUID NOT NULL,
    "media_type" TEXT NOT NULL,
    "stats_json" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dedupe_key" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "message" TEXT,
    "requestId" TEXT,
    "userId" TEXT,
    "mediaId" TEXT,
    "mediaType" TEXT,
    "jobId" TEXT,
    "durationMs" INTEGER,
    "metadata" JSONB,
    "errorName" TEXT,
    "errorMessage" TEXT,
    "errorStack" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_ranked_lists_user_id_media_id_key" ON "user_ranked_lists"("user_id", "media_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_ratings_user_id_media_id_key" ON "user_ratings"("user_id", "media_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_watchlist_user_id_media_id_key" ON "user_watchlist"("user_id", "media_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "UserStatsCache_user_id_media_type_key" ON "UserStatsCache"("user_id", "media_type");

-- CreateIndex
CREATE INDEX "BackgroundJob_status_run_at_idx" ON "BackgroundJob"("status", "run_at");

-- CreateIndex
CREATE INDEX "BackgroundJob_type_status_idx" ON "BackgroundJob"("type", "status");

-- CreateIndex
CREATE INDEX "BackgroundJob_locked_at_idx" ON "BackgroundJob"("locked_at");

-- CreateIndex
CREATE INDEX "BackgroundJob_dedupe_key_idx" ON "BackgroundJob"("dedupe_key");

-- CreateIndex
CREATE INDEX "BackgroundJob_created_at_idx" ON "BackgroundJob"("created_at");

-- CreateIndex
CREATE INDEX "SystemLog_level_createdAt_idx" ON "SystemLog"("level", "createdAt");

-- CreateIndex
CREATE INDEX "SystemLog_event_createdAt_idx" ON "SystemLog"("event", "createdAt");

-- CreateIndex
CREATE INDEX "SystemLog_requestId_idx" ON "SystemLog"("requestId");

-- CreateIndex
CREATE INDEX "SystemLog_userId_createdAt_idx" ON "SystemLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SystemLog_mediaId_createdAt_idx" ON "SystemLog"("mediaId", "createdAt");

-- CreateIndex
CREATE INDEX "SystemLog_jobId_idx" ON "SystemLog"("jobId");

-- CreateIndex
CREATE INDEX "SystemLog_createdAt_idx" ON "SystemLog"("createdAt");

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_ranked_lists" ADD CONSTRAINT "user_ranked_lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_ratings" ADD CONSTRAINT "user_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_watchlist" ADD CONSTRAINT "user_watchlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStatsCache" ADD CONSTRAINT "UserStatsCache_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Create partial unique index to prevent race conditions on background jobs
CREATE UNIQUE INDEX background_job_dedupe_active_idx ON "BackgroundJob" ("dedupe_key") WHERE "dedupe_key" IS NOT NULL AND "status" IN ('pending', 'processing');
