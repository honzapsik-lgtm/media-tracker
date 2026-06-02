import { NextResponse } from "next/server";
import {
  AdminAuthError,
  adminStatusForError,
  requireAdmin,
} from "@/lib/admin-auth";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ ok: true, admin: true });
  } catch (error) {
    const code = error instanceof AdminAuthError ? error.code : "ADMIN_REQUIRED";
    return NextResponse.json({ error: code }, { status: adminStatusForError(error) });
  }
}
