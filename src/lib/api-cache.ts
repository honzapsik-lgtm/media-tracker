import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function readApiCache<T>(id: string): Promise<T | null> {
  const cached = await prisma.apiCache.findUnique({ where: { id } });
  if (!cached || cached.expires_at <= new Date()) return null;

  return cached.data as T;
}

export async function writeApiCache(
  id: string,
  provider: string,
  data: unknown,
  ttlSeconds: number
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  await prisma.apiCache.upsert({
    where: { id },
    update: {
      provider,
      data: data as Prisma.InputJsonValue,
      created_at: now,
      expires_at: expiresAt,
    },
    create: {
      id,
      provider,
      data: data as Prisma.InputJsonValue,
      expires_at: expiresAt,
    },
  });
}
