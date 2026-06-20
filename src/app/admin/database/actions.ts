"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { wipeAppData } from "@/lib/db-wipe";
import { appLog } from "@/lib/logger";
import { createRequestId } from "@/lib/request-id";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function wipeDatabaseAction() {
  const requestId = createRequestId();
  const admin = await requireAdmin();

  // Backup admin users before wiping
  const admins = await prisma.user.findMany({
    where: { role: 'admin' },
    select: { id: true }
  });

  await wipeAppData();

  // Explicitly restore admin rights
  if (admins.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: admins.map(a => a.id) } },
      data: { role: 'admin' }
    });
  }

  await appLog({
    level: "warn",
    event: "admin.database.wipe.completed",
    requestId,
    userId: admin.id,
    persist: true,
  });

  revalidatePath("/");
  return { success: true };
}
