import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

// On Vercel each serverless function instance is isolated. Without a connection limit,
// concurrent cold-starts can exhaust the PostgreSQL max_connections quickly.
// We append connection_limit=1 so Prisma's pool stays at 1 connection per instance.
function getDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || !process.env.VERCEL || url.includes("connection_limit")) return undefined;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}connection_limit=1`;
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasourceUrl: getDatasourceUrl(),
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
