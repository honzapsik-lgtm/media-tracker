import { NextResponse } from "next/server";
import { AdminAuthError, adminStatusForError } from "@/lib/admin-auth";

export function adminErrorToBody(error: unknown, requestId?: string) {
  const code = error instanceof AdminAuthError ? error.code : "ADMIN_REQUIRED";
  return { error: code, requestId };
}

export function adminErrorResponse(error: unknown, requestId?: string) {
  return NextResponse.json(adminErrorToBody(error, requestId), {
    status: adminStatusForError(error),
  });
}
