import { PrismaClient } from "@prisma/client";

/**
 * Prisma singleton.
 *
 * Next.js hot-reloads server modules in dev, which would otherwise spawn a
 * fresh PrismaClient on every change and exhaust SQLite's file handles.
 * Stashing the instance on globalThis keeps a single connection alive.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
