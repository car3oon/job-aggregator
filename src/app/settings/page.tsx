import { prisma } from "@/lib/prisma";
import { CategoriesManager } from "@/components/CategoriesManager";

export default async function SettingsPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-2xl mx-auto py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <div className="bg-card border rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-2">Job Categories</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Add tags to seamlessly organize and filter your scraped job listings.
        </p>

        <CategoriesManager initialCategories={categories} />
      </div>
    </div>
  );
}
