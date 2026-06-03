import { NextResponse } from "next/server";
import { AdminAuthError, adminStatusForError } from "@/lib/admin-auth";

export const CONFIRMATION_REQUIRED = "CONFIRMATION_REQUIRED";

export function adminErrorToBody(error: unknown, requestId?: string) {
  const code = error instanceof AdminAuthError ? error.code : "ADMIN_REQUIRED";
  return { error: code, requestId };
}

export function adminErrorResponse(error: unknown, requestId?: string) {
  return NextResponse.json(adminErrorToBody(error, requestId), {
    status: adminStatusForError(error),
  });
}

export function confirmationRequiredResponse(requestId?: string) {
  return NextResponse.json({ error: CONFIRMATION_REQUIRED, requestId }, { status: 400 });
}

export async function readAdminPostBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await request.json().catch(() => ({}))) as Record<string, unknown>;
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData().catch(() => null);
    if (!formData) return {};

    return Object.fromEntries(
      Array.from(formData.entries()).map(([key, value]) => [
        key,
        typeof value === "string" ? value : value.name,
      ])
    );
  }

  return {};
}

export function hasConfirmation(body: Record<string, unknown>, expected: string) {
  return typeof body.confirm === "string" && body.confirm.trim() === expected;
}
