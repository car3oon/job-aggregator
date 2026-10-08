"use client";

import { useState, useTransition } from "react";
import { type Category } from "@prisma/client";
import { addCategory, deleteCategory, updateCategory } from "@/app/actions/category";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, Hash, Pencil, Check, Ban } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useEscapeKey } from "@/hooks/useEscapeKey";

export function CategoriesManager({
  initialCategories,
}: {
  initialCategories: Category[];
}) {
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [excluded, setExcluded] = useState("");
  const [isPending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editKeywords, setEditKeywords] = useState("");
  const [editExcluded, setEditExcluded] = useState("");

  useEscapeKey(() => setEditingId(null), editingId !== null && !isPending);

  const handleAdd = () => {
    if (!name.trim()) return;

    startTransition(async () => {
      const result = await addCategory(name, keywords, excluded);

      if (result?.error) {
        toast.add({ type: "error", title: "Error", description: result.error });
      } else {
        toast.add({ type: "success", title: "Success", description: "Category added successfully!" });
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
        toast.add({ type: "success", title: "Success", description: "Category deleted!" });
      }
    });
  };

  const handleEditInit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditKeywords(cat.keywords.join(", "));
    setEditExcluded(cat.excluded.join(", "));
  };

  const handleSaveEdit = (id: string) => {
    if (!editName.trim()) return;
    
    startTransition(async () => {
      const result = await updateCategory(id, editName, editKeywords, editExcluded);
      if (result?.error) {
        toast.add({ type: "error", title: "Error", description: result.error });
      } else {
        toast.add({ type: "success", title: "Success", description: "Category updated!" });
        setEditingId(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAdd();
        }}
        className="grid grid-cols-1 md:grid-cols-3 gap-3"
      >
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
          />
          <Button type="submit" disabled={isPending || !name.trim()}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
        </div>
      </form>

      <div className="space-y-3">
        {initialCategories.length === 0 && (
          <span className="text-sm text-muted-foreground italic">
            No categories added yet.
          </span>
        )}

        {initialCategories.map((cat) => (
          <div
            key={cat.id}
            className="flex flex-col p-4 rounded-lg border bg-card gap-4"
          >
            {editingId === cat.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveEdit(cat.id);
                }}
                className="flex flex-col gap-3"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} disabled={isPending} placeholder="Name" />
                  <Input value={editKeywords} onChange={(e) => setEditKeywords(e.target.value)} disabled={isPending} placeholder="Required Keywords" />
                  <Input value={editExcluded} onChange={(e) => setEditExcluded(e.target.value)} disabled={isPending} placeholder="Excluded Keywords" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)} disabled={isPending}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={isPending || !editName.trim()}>
                    {isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />} Save
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    {cat.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {cat.keywords.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        {cat.keywords.join(", ")}
                      </span>
                    )}
                    {cat.excluded.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Ban className="h-3.5 w-3.5 text-destructive/80" />
                        {cat.excluded.join(", ")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => handleEditInit(cat)} disabled={isPending}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(cat.id)} disabled={isPending}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
