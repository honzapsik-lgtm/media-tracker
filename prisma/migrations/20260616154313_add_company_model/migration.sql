-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "tmdbId" INTEGER,
    "anilistId" INTEGER,
    "igdbId" INTEGER,
    "tmdbNetworkId" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "country" TEXT,
    "mergedWorks" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_tmdbId_key" ON "companies"("tmdbId");

-- CreateIndex
CREATE UNIQUE INDEX "companies_anilistId_key" ON "companies"("anilistId");

-- CreateIndex
CREATE UNIQUE INDEX "companies_igdbId_key" ON "companies"("igdbId");

-- CreateIndex
CREATE UNIQUE INDEX "companies_tmdbNetworkId_key" ON "companies"("tmdbNetworkId");
