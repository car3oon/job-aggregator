"use client";

import { useState, useTransition } from "react";
import { type Category } from "@prisma/client";
import { addCategory, deleteCategory } from "@/app/actions/category";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Loader2, Hash } from "lucide-react";
import { toast } from "@/components/ui/toast";

export function CategoriesManager({
  initialCategories,
}: {
  initialCategories: Category[];
}) {
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [excluded, setExcluded] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleAdd = () => {
    if (!name.trim()) return;

    startTransition(async () => {
      const result = await addCategory(name, keywords, excluded);

      if (result?.error) {
        toast.add({
          type: "error",
          title: "Error",
          description: result.error,
        });
      } else {
        toast.add({
          type: "success",
          title: "Success",
          description: "Category added successfully!",
        });
        setName("");
        setKeywords("");
        setExcluded("");
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteCategory(id);
      if (result?.error) {
        toast.add({ type: "error", title: "Error", description: result.error });
      } else {
        toast.add({
          type: "success",
          title: "Success",
          description: "Category deleted!",
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Input
          placeholder="Name (e.g. React Frontend)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
        />
        <Input
          placeholder="Required Keywords (comma separated)"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          disabled={isPending}
        />
        <div className="flex gap-2">
          <Input
            placeholder="Excluded (e.g. backend, java)"
            value={excluded}
            onChange={(e) => setExcluded(e.target.value)}
            disabled={isPending}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button onClick={handleAdd} disabled={isPending || !name.trim()}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {initialCategories.length === 0 && (
          <span className="text-sm text-muted-foreground italic">
            No categories added yet.
          </span>
        )}

        {initialCategories.map((cat) => (
          <div
            key={cat.id}
            className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border bg-card gap-2"
          >
            <div>
              <div className="flex items-center gap-2 font-medium">
                <Hash className="h-4 w-4 text-muted-foreground" />
                {cat.name}
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex gap-2">
                {cat.keywords.length > 0 && (
                  <span>✅ {cat.keywords.join(", ")}</span>
                )}
                {cat.excluded.length > 0 && (
                  <span>❌ {cat.excluded.join(", ")}</span>
                )}
              </div>
            </div>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDelete(cat.id)}
              disabled={isPending}
            >
              <X className="h-4 w-4 mr-1" /> Remove
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
