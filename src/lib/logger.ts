import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type AppLogInput = {
  level: LogLevel;
  event: string;
  message?: string;
  requestId?: string;
  userId?: string;
  mediaId?: string;
  mediaType?: string;
  jobId?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  error?: unknown;
  persist?: boolean;
};

type TimeOperationInput = Omit<AppLogInput, "level" | "durationMs" | "error"> & {
  level?: Extract<LogLevel, "debug" | "info">;
};

function normalizeError(error: unknown) {
  if (!error) return {};

  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
    };
  }

  try {
    return {
      errorName: "ThrownValue",
      errorMessage: JSON.stringify(error),
    };
  } catch {
    return {
      errorName: "ThrownValue",
      errorMessage: String(error),
    };
  }
}

function consoleWrite(level: LogLevel, payload: Record<string, unknown>) {
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export async function appLog(input: AppLogInput) {
  const timestamp = new Date().toISOString();
  const errorData = normalizeError(input.error);
  const payload = {
    timestamp,
    level: input.level,
    event: input.event,
    message: input.message,
    requestId: input.requestId,
    userId: input.userId,
    mediaId: input.mediaId,
    mediaType: input.mediaType,
    jobId: input.jobId,
    durationMs: input.durationMs,
    metadata: input.metadata,
    ...errorData,
  };

  consoleWrite(input.level, payload);

  const shouldPersist = input.persist === true || input.level === "warn" || input.level === "error";
  if (!shouldPersist) return;

  try {
    await prisma.systemLog.create({
      data: {
        level: input.level,
        event: input.event,
        message: input.message,
        requestId: input.requestId,
        userId: input.userId,
        mediaId: input.mediaId,
        mediaType: input.mediaType,
        jobId: input.jobId,
        durationMs: input.durationMs,
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonObject) : undefined,
        errorName: "errorName" in errorData ? errorData.errorName : undefined,
        errorMessage: "errorMessage" in errorData ? errorData.errorMessage : undefined,
        errorStack: "errorStack" in errorData ? errorData.errorStack : undefined,
      },
    });
  } catch (loggerError) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      event: "logger.persist.failed",
      error: normalizeError(loggerError),
    }));
  }
}

export async function timeOperation<T>(
  input: TimeOperationInput,
  operation: () => Promise<T>
) {
  const startedAt = performance.now();

  try {
    const result = await operation();
    await appLog({
      ...input,
      level: input.level ?? "info",
      durationMs: Math.round(performance.now() - startedAt),
    });
    return result;
  } catch (error) {
    await appLog({
      ...input,
      level: "error",
      durationMs: Math.round(performance.now() - startedAt),
      error,
    });
    throw error;
  }
}
