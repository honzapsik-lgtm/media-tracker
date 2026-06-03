import { Prisma } from "@prisma/client";
import { PERF_WARN_THRESHOLD_MS } from "@/lib/admin-constants";
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
  slowThresholdMs?: number;
  persistSlow?: boolean;
};

type SlowOperationInput = {
  operation: string;
  durationMs: number;
  requestId?: string;
  userId?: string;
  mediaId?: string;
  mediaType?: string;
  thresholdMs?: number;
  metadata?: Record<string, unknown>;
};

const REDACTED = "[REDACTED]";
const MAX_METADATA_DEPTH = 5;
const MAX_METADATA_STRING_LENGTH = 1000;
const SENSITIVE_KEY_PARTS = [
  "password",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "secret",
  "clientsecret",
  "apikey",
  "authorization",
  "cookie",
  "set-cookie",
  "database_url",
  "nextauth_secret",
  "tmdb_api_key",
  "rawg_api_key",
  "google_client_secret",
  "discord_client_secret",
];

function isSensitiveKey(key: string) {
  const normalized = key.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

function truncateString(value: string) {
  if (value.length <= MAX_METADATA_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_METADATA_STRING_LENGTH)}...[TRUNCATED]`;
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value == null) return value;
  if (typeof value === "string") return truncateString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return `[${typeof value}]`;
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_METADATA_DEPTH) return "[MAX_DEPTH]";

  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1, seen));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).slice(0, 100).map(([key, entry]) => [
      key,
      isSensitiveKey(key) ? REDACTED : sanitizeValue(entry, depth + 1, seen),
    ])
  );
}

export function sanitizeLogMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) return undefined;
  return sanitizeValue(metadata, 0, new WeakSet()) as Record<string, unknown>;
}

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
  const metadata = sanitizeLogMetadata(input.metadata);
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
    metadata,
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
        metadata: metadata ? (metadata as Prisma.InputJsonObject) : undefined,
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
  const thresholdMs = input.slowThresholdMs ?? PERF_WARN_THRESHOLD_MS;

  try {
    const result = await operation();
    const durationMs = Math.round(performance.now() - startedAt);
    if (durationMs >= thresholdMs) {
      await logSlowOperation({
        operation: input.event,
        durationMs,
        requestId: input.requestId,
        userId: input.userId,
        mediaId: input.mediaId,
        mediaType: input.mediaType,
        thresholdMs,
        metadata: input.metadata,
      });
    } else if (input.persist === true) {
      await appLog({
        ...input,
        level: input.level ?? "info",
        durationMs,
        persist: true,
      });
    } else if (input.persistSlow === false) {
      await appLog({
        ...input,
        level: input.level ?? "debug",
        durationMs,
        persist: false,
      });
    }
    return result;
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    await appLog({
      ...input,
      level: "error",
      durationMs,
      error,
      persist: true,
    });
    throw error;
  }
}

export async function logSlowOperation(input: SlowOperationInput) {
  await appLog({
    level: "warn",
    event: "performance.slow_operation",
    message: `${input.operation} took ${input.durationMs}ms`,
    requestId: input.requestId,
    userId: input.userId,
    mediaId: input.mediaId,
    mediaType: input.mediaType,
    durationMs: input.durationMs,
    metadata: {
      operation: input.operation,
      thresholdMs: input.thresholdMs ?? PERF_WARN_THRESHOLD_MS,
      ...input.metadata,
    },
    persist: true,
  });
}
