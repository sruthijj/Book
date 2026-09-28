'use server';

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  hashPassword,
  comparePassword,
  signToken,
  setSessionCookie,
  clearSessionCookie,
  getCurrentUser,
} from "@/lib/auth";

export interface AuthResponse {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

function formatDbError(error: any): string {
  const msg = error?.message || String(error);
  if (msg.includes("ECONNREFUSED") || msg.includes("connect ECONNREFUSED")) {
    return "Database connection refused. Please ensure your PostgreSQL server is running or configure your DATABASE_URL in .env.local.";
  }
  if (msg.includes('relation "users" does not exist') || msg.includes('table "users" does not exist')) {
    return "The 'users' database table does not exist yet. Please run 'npm run db:push' in your terminal to create it.";
  }
  if (msg.includes("password authentication failed")) {
    return "Database authentication failed. Please check the credentials in your DATABASE_URL in .env.local.";
  }
  return error?.message || "An unexpected error occurred";
}

export async function signUp(formData: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  try {
    const { name, email, password } = formData;

    if (!name || !email || !password) {
      return { success: false, error: "All fields are required" };
    }

    if (password.length < 6) {
      return { success: false, error: "Password must be at least 6 characters" };
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing) {
      return { success: false, error: "An account with this email already exists" };
    }

    const passwordHash = await hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
      });

    // Create session token and set cookie
    const token = await signToken({
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
    });

    await setSessionCookie(token);
    revalidatePath("/", "layout");

    return {
      success: true,
      user: newUser,
    };
  } catch (error: any) {
    console.error("SignUp error:", error);
    return {
      success: false,
      error: formatDbError(error),
    };
  }
}

export async function signIn(formData: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  try {
    const { email, password } = formData;

    if (!email || !password) {
      return { success: false, error: "Email and password are required" };
    }

    const normalizedEmail = email.toLowerCase().trim();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      return { success: false, error: "Invalid email or password" };
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return { success: false, error: "Invalid email or password" };
    }

    const token = await signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    await setSessionCookie(token);
    revalidatePath("/", "layout");

    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  } catch (error: any) {
    console.error("SignIn error:", error);
    return {
      success: false,
      error: formatDbError(error),
    };
  }
}

export async function signOut() {
  await clearSessionCookie();
  revalidatePath("/", "layout");
  return { success: true };
}

export async function getMe() {
  return getCurrentUser();
}
