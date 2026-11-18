import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CategoriesManager } from "@/components/CategoriesManager";

export default async function CategoriesSettingsPage() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Categorization Rules</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Define matching keywords and exclusions for automated job
          categorization.
        </p>
      </div>
      <CategoriesManager initialCategories={categories} />
    </div>
  );
}
