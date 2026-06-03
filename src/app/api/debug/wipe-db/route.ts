import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { readAdminPostBody } from "@/lib/admin-api";
import { ADMIN_DEBUG_WIPE_CONFIRM_TEXT } from "@/lib/admin-constants";
import { authOptions } from "@/lib/auth";
import { wipeAppData } from "@/lib/db-wipe";
import { appLog } from "@/lib/logger";
import { getOrCreateRequestId } from "@/lib/request-id";

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Database wipe is disabled in production." }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  const body = await readAdminPostBody(request);
  if (typeof body.confirm !== "string" || body.confirm.trim() !== ADMIN_DEBUG_WIPE_CONFIRM_TEXT) {
    await appLog({
      level: "warn",
      event: "debug.wipe_db_confirmation_missing",
      requestId,
      userId: session.user.id,
      persist: true,
    });
    return NextResponse.json({ error: "CONFIRMATION_REQUIRED", requestId }, { status: 400 });
  }

  await wipeAppData();
  await appLog({
    level: "warn",
    event: "debug.wipe_db.completed",
    requestId,
    userId: session.user.id,
    persist: true,
  });

  return NextResponse.json({ ok: true });
}
