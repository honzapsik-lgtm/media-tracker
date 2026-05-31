import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 1. Create a PostgreSQL connection pool using the pg driver
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 2. Wrap the pool in the Prisma adapter
const adapter = new PrismaPg(pool);

// 3. Instantiate PrismaClient with the adapter
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

// Cache the connection in development to prevent pool exhaustion
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;