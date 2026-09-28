import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/bookified";

declare global {
  var _pgPool: Pool | undefined;
}

const pool =
  global._pgPool ||
  new Pool({
    connectionString,
    ssl:
      process.env.NODE_ENV === "production" ||
      connectionString.includes("sslmode=require") ||
      connectionString.includes("neon.tech") ||
      connectionString.includes("supabase.co")
        ? { rejectUnauthorized: false }
        : false,
  });

if (process.env.NODE_ENV !== "production") {
  global._pgPool = pool;
}

export const db = drizzle(pool, { schema });
export default db;
