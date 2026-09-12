import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePersonSlug } from "@/lib/person";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const personSlug = resolvedParams.id;
  const parsed = parsePersonSlug(personSlug);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid person ID" }, { status: 400 });
  }

  const [provider, rawId] = parsed;

  const tmdbId = provider === 'tmdb' ? parseInt(rawId, 10) : null;
  const anilistId = provider === 'anilist' ? parseInt(rawId, 10) : null;
  const igdbId = provider === 'igdb' ? parseInt(rawId, 10) : null;
  const rawgId = provider === 'rawg' ? parseInt(rawId, 10) : null;
  const mangadexId = provider === 'mangadex' ? rawId : null;

  const dbPerson = await prisma.person.findFirst({
    where: {
      OR: [
        ...(tmdbId ? [{ tmdbId }] : []),
        ...(anilistId ? [{ anilistId }] : []),
        ...(igdbId ? [{ igdbId }] : []),
        ...(rawgId ? [{ rawgId }] : []),
        ...(mangadexId ? [{ mangadexId }] : []),
      ]
    }
  });

  if (!dbPerson) {
    return NextResponse.json({ status: "not_found", isSyncing: false });
  }

  const activeJob = await prisma.backgroundJob.findFirst({
    where: {
      dedupe_key: `sync-person-${dbPerson.id}`,
      status: { in: ["pending", "processing"] }
    }
  });

  return NextResponse.json({
    status: activeJob ? "syncing" : "idle",
    isSyncing: !!activeJob,
    credits: dbPerson.mergedCredits
  });
}
