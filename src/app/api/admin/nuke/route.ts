import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { appLog } from "@/lib/logger";
import { createRequestId } from "@/lib/request-id";
import { revalidatePath } from "next/cache";
import { wipeAppData } from "@/lib/db-wipe";

export async function POST() {
  const requestId = createRequestId();
  let admin = null;

  try {
    admin = await requireAdmin();
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Rely on central wipeAppData utility to ensure 100% deletion of non-auth records
    await wipeAppData();

    await appLog({
      level: "warn",
      event: "admin.database.nuked",
      requestId,
      userId: admin.id,
      persist: true,
      message: "Database was nuked by admin.",
    });

    revalidatePath("/", "layout");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Nuke error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
