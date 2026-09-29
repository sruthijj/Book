import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "bookified-jwt-super-secret-key-2026";
const key = new TextEncoder().encode(JWT_SECRET);
const COOKIE_NAME = "bookified_auth_token";

export const NEON_AUTH_URL =
  process.env.NEON_AUTH_URL ||
  "https://ep-wild-mud-b4smrt0q.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth";

export const NEON_AUTH_JWKS_URL =
  process.env.NEON_AUTH_JWKS_URL ||
  "https://ep-wild-mud-b4smrt0q.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth/.well-known/jwks.json";

// Lazily initialize remote JWKS set for Neon Auth
let _neonJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;
function getNeonJWKS() {
  if (!_neonJWKS) {
    _neonJWKS = createRemoteJWKSet(new URL(NEON_AUTH_JWKS_URL));
  }
  return _neonJWKS;
}

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
  [key: string]: unknown;
}

// ─── Password Utilities ──────────────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── JWT Utilities ───────────────────────────────────────────────────────────
export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  // 1. Try verifying with Neon Auth JWKS (EdDSA / Ed25519)
  try {
    const jwks = getNeonJWKS();
    const { payload } = await jwtVerify(token, jwks);
    return {
      userId: (payload.sub || payload.userId || payload.id) as string,
      email: (payload.email || "") as string,
      name: (payload.name || payload.email || "User") as string,
      ...payload,
    };
  } catch {
    // 2. Fall back to internal JWT Secret verification (HS256)
    try {
      const { payload } = await jwtVerify(token, key);
      return payload as unknown as JWTPayload;
    } catch {
      return null;
    }
  }
}

// ─── Cookie Management ───────────────────────────────────────────────────────
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

// ─── Get Current User ────────────────────────────────────────────────────────
export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token =
      cookieStore.get(COOKIE_NAME)?.value ||
      cookieStore.get("neon_auth_session")?.value ||
      cookieStore.get("better-auth.session_token")?.value;

    if (!token) return null;

    const payload = await verifyToken(token);
    if (!payload?.userId) return null;

    // Check database users table
    try {
      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);

      if (user) return user;
    } catch {
      // If query fails or user isn't in users table yet, return token profile
    }

    // Return profile parsed from Neon Auth JWT
    return {
      id: payload.userId,
      name: payload.name || payload.email || "User",
      email: payload.email,
      createdAt: new Date(),
    };
  } catch (error) {
    console.error("Error retrieving current user:", error);
    return null;
  }
}
