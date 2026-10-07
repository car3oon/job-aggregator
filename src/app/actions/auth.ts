"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/session";

export async function login(prevState: unknown, formData: FormData) {
  const password = formData.get("password");
  const envPassword = process.env.ADMIN_PASSWORD;

  if (!envPassword) {
    return { error: "Missing password in server configuration (.env)" };
  }

  if (password === envPassword) {
    let session: string;
    try {
      session = createSessionToken();
    } catch {
      return { error: "Missing or invalid session configuration (SESSION_SECRET)." };
    }

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    // Redirect to the home page
    redirect("/");
  } else {
    // Incorrect password
    return { error: "Incorrect password. Please try again." };
  }
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
