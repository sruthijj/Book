import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const DEFAULT_URL =
  "postgresql://neondb_owner:npg_iZuB6a9YsqvT@ep-wild-mud-b4smrt0q-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

function getCleanConnectionString(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw || typeof raw !== "string") {
    return DEFAULT_URL;
  }

  // Remove leading/trailing quotes and extra whitespace often introduced when pasting into Vercel UI
  let cleaned = raw.trim().replace(/^["']|["']$/g, "").trim();

  // Fix truncated URLs (e.g., if copied ending in .te instead of .tech/neondb)
  if (cleaned.includes("neon.te") && !cleaned.includes("neon.tech")) {
    cleaned = cleaned.replace(/neon\.te.*$/, "neon.tech/neondb?sslmode=require&channel_binding=require");
  }

  // Ensure database path exists
  if (!cleaned.includes("/neondb") && !cleaned.includes("/postgres")) {
    const queryIdx = cleaned.indexOf("?");
    if (queryIdx !== -1) {
      cleaned = `${cleaned.slice(0, queryIdx)}/neondb${cleaned.slice(queryIdx)}`;
    } else {
      cleaned = `${cleaned.replace(/\/+$/, "")}/neondb`;
    }
  }

  // Ensure sslmode=require is set
  if (!cleaned.includes("sslmode=")) {
    cleaned += (cleaned.includes("?") ? "&" : "?") + "sslmode=require";
  }

  // Final sanity check: must start with postgresql and contain neon.tech
  if (!cleaned.startsWith("postgres") || !cleaned.includes("neon.tech")) {
    console.warn("[DB] Invalid DATABASE_URL detected, using verified Neon connection string fallback");
    return DEFAULT_URL;
  }

  return cleaned;
}

const connectionString = getCleanConnectionString();
const sql = neon(connectionString);

export const db = drizzle(sql, { schema });
export default db;
