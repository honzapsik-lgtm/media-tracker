import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const ADMIN_AUTH_ERRORS = {
  AUTH_REQUIRED: "AUTH_REQUIRED",
  ADMIN_REQUIRED: "ADMIN_REQUIRED",
  ADMIN_USER_NOT_FOUND: "ADMIN_USER_NOT_FOUND",
} as const;

export type AdminAuthErrorCode = keyof typeof ADMIN_AUTH_ERRORS;

export type AdminUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
};

export class AdminAuthError extends Error {
  code: AdminAuthErrorCode;

  constructor(code: AdminAuthErrorCode) {
    super(code);
    this.code = code;
  }
}

export function isAdminUser(user: { role?: string | null }) {
  return user.role === "admin";
}

export function adminStatusForError(error: unknown) {
  if (!(error instanceof AdminAuthError)) return 500;
  if (error.code === ADMIN_AUTH_ERRORS.AUTH_REQUIRED) return 401;
  return 403;
}

export async function requireAdmin(): Promise<AdminUser> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new AdminAuthError(ADMIN_AUTH_ERRORS.AUTH_REQUIRED);
  }

  const user = session.user.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, email: true, name: true, role: true },
      })
    : session.user.email
      ? await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true, email: true, name: true, role: true },
        })
      : null;

  if (!user) {
    throw new AdminAuthError(ADMIN_AUTH_ERRORS.ADMIN_USER_NOT_FOUND);
  }

  if (!isAdminUser(user)) {
    throw new AdminAuthError(ADMIN_AUTH_ERRORS.ADMIN_REQUIRED);
  }

  return user;
}
