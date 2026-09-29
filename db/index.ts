import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_iZuB6a9YsqvT@ep-wild-mud-b4smrt0q-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

declare global {
  var _neonPool: Pool | undefined;
}

const pool =
  global._neonPool ||
  new Pool({
    connectionString,
  });

if (process.env.NODE_ENV !== "production") {
  global._neonPool = pool;
}

export const db = drizzle(pool, { schema });
export default db;
