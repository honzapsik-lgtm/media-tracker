import { prisma } from "@/lib/prisma";
import { ActivityType, MediaType } from "@prisma/client";

export interface LogActivityParams {
  userId: string;
  type: ActivityType;
  mediaId?: string | null;
  mediaTitle?: string | null;
  mediaImage?: string | null;
  mediaType?: MediaType | null;
  data?: Record<string, any>;
}

export async function logUserActivity(params: LogActivityParams) {
  try {
    return await prisma.userActivity.create({
      data: {
        user_id: params.userId,
        type: params.type,
        media_id: params.mediaId || null,
        media_title: params.mediaTitle || null,
        media_image: params.mediaImage || null,
        media_type: params.mediaType || null,
        data: params.data || {},
      },
    });
  } catch (error) {
    console.error("Failed to log user activity:", error);
    return null;
  }
}
