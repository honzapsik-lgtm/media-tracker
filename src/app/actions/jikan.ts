"use server";

import { readApiCache } from "@/lib/api-cache";

export async function checkFranchiseReady(mediaId: string) {
  const cached = await readApiCache<any>(mediaId);
  return cached?.franchise || null;
}
