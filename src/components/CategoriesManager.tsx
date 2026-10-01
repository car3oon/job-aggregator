"use client";

import { useState, useTransition } from "react";
import { type Category } from "@prisma/client";
import { addCategory, deleteCategory } from "@/app/actions/category";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toast";

export function CategoriesManager({
  initialCategories,
}: {
  initialCategories: Category[];
}) {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleAdd = () => {
    if (!name.trim()) return;

    startTransition(async () => {
      const result = await addCategory(name);

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
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteCategory(id);

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
          description: "Category deleted!",
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Input
          placeholder="e.g. Frontend, React, Remote..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          disabled={isPending}
        />
        <Button onClick={handleAdd} disabled={isPending || !name.trim()}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Tag"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {initialCategories.length === 0 && (
          <span className="text-sm text-muted-foreground italic">
            No categories added yet.
          </span>
        )}

        {initialCategories.map((cat) => (
          <div
            key={cat.id}
            className="inline-flex items-center rounded-full border border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 px-3 py-1.5 text-sm
  transition-all"
          >
            {cat.name}
            <button
              onClick={() => handleDelete(cat.id)}
              disabled={isPending}
              className="ml-1 rounded-full hover:bg-destructive/20 hover:text-destructive p-0.5 transition-colors focus:outline-none"
              aria-label="Delete category"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
