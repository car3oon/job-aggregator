"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function login(prevState: unknown, formData: FormData) {
  const password = formData.get("password");
  const envPassword = process.env.APP_PASSWORD;

  if (!envPassword) {
    return { error: "Missing password in server configuration (.env)" };
  }

  if (password === envPassword) {
    // Password is correct - set security cookie for 30 days
    const cookieStore = await cookies();
    cookieStore.set("job_auth", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 days
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
  cookieStore.delete("job_auth");
  redirect("/login");
}
