import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { adminErrorResponse } from "@/lib/admin-api";
import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import { ADMIN_DEFAULT_PAGE_SIZE, ADMIN_MAX_PAGE_SIZE } from "@/lib/admin-constants";
import { appLog, sanitizeLogMetadata } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getOrCreateRequestId } from "@/lib/request-id";

const parsePositiveInt = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

function buildWhere(searchParams: URLSearchParams): Prisma.SystemLogWhereInput {
  const level = searchParams.get("level")?.trim();
  const event = searchParams.get("event")?.trim();
  const requestId = searchParams.get("requestId")?.trim();
  const userId = searchParams.get("userId")?.trim();
  const mediaId = searchParams.get("mediaId")?.trim();
  const jobId = searchParams.get("jobId")?.trim();
  const q = searchParams.get("q")?.trim();

  return {
    ...(level ? { level } : {}),
    ...(event ? { event: { contains: event } } : {}),
    ...(requestId ? { requestId } : {}),
    ...(userId ? { userId } : {}),
    ...(mediaId ? { mediaId } : {}),
    ...(jobId ? { jobId } : {}),
    ...(q
      ? {
          OR: [
            { event: { contains: q } },
            { message: { contains: q } },
            { errorName: { contains: q } },
            { errorMessage: { contains: q } },
          ],
        }
      : {}),
  };
}

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);

  try {
    const admin = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = Math.min(parsePositiveInt(searchParams.get("pageSize"), ADMIN_DEFAULT_PAGE_SIZE), ADMIN_MAX_PAGE_SIZE);
    const where = buildWhere(searchParams);

    const [items, total] = await Promise.all([
      prisma.systemLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          level: true,
          event: true,
          message: true,
          requestId: true,
          userId: true,
          mediaId: true,
          mediaType: true,
          jobId: true,
          durationMs: true,
          metadata: true,
          errorName: true,
          errorMessage: true,
          errorStack: process.env.NODE_ENV !== "production",
          createdAt: true,
        },
      }),
      prisma.systemLog.count({ where }),
    ]);

    await appLog({
      level: "info",
      event: "admin.logs.api.viewed",
      requestId,
      userId: admin.id,
      metadata: { page, pageSize },
    });

    return NextResponse.json({
      items: items.map((item) => ({
        ...item,
        metadata:
          item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
            ? sanitizeLogMetadata(item.metadata as Record<string, unknown>)
            : item.metadata,
      })),
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    await appLog({
      level: error instanceof AdminAuthError ? "warn" : "error",
      event: error instanceof AdminAuthError ? "admin.logs.denied" : "admin.logs.failed",
      requestId,
      error,
      persist: true,
    });
    return adminErrorResponse(error, requestId);
  }
}
