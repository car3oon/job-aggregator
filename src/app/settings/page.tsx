import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

export default async function SettingsPage() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  redirect("/settings/categories");
}
