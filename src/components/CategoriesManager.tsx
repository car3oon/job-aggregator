"use client";

import { useId, useState, useTransition } from "react";
import { type Category } from "@prisma/client";
import { addCategory, deleteCategory, updateCategory } from "@/app/actions/category";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, Hash, Pencil, Check, Ban } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useEscapeKey } from "@/hooks/useEscapeKey";

export function CategoriesManager({
  initialCategories,
}: {
  initialCategories: Category[];
}) {
  const formId = useId();
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
        className="flex flex-col gap-3 mb-6 p-4 rounded-lg border bg-muted/20"
      >
        <Label htmlFor={`${formId}-name`}>Category Name</Label>
        <Input
          id={`${formId}-name`}
          placeholder="Name (e.g. React Frontend)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
          className="font-medium"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor={`${formId}-keywords`}>Required Keywords</Label>
            <Textarea
              id={`${formId}-keywords`}
              aria-describedby={`${formId}-rules-help`}
              placeholder="Required Keywords (comma separated)"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              disabled={isPending}
              className="min-h-[100px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-excluded`}>Excluded Keywords</Label>
            <Textarea
              id={`${formId}-excluded`}
              aria-describedby={`${formId}-rules-help`}
              placeholder="Excluded (e.g. backend, java)"
              value={excluded}
              onChange={(e) => setExcluded(e.target.value)}
              disabled={isPending}
              className="min-h-[100px]"
            />
          </div>
        </div>
        <p id={`${formId}-rules-help`} className="text-xs text-muted-foreground">
          Separate groups with commas; use + to require every term in a group.
        </p>
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending || !name.trim()}>
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Add Category
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
                <div className="flex flex-col gap-3">
                  <Label htmlFor={`${formId}-${cat.id}-name`}>Category Name</Label>
                  <Input id={`${formId}-${cat.id}-name`} value={editName} onChange={(e) => setEditName(e.target.value)} disabled={isPending} placeholder="Name" className="font-medium" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor={`${formId}-${cat.id}-keywords`}>Required Keywords</Label>
                      <Textarea id={`${formId}-${cat.id}-keywords`} aria-describedby={`${formId}-rules-help`} value={editKeywords} onChange={(e) => setEditKeywords(e.target.value)} disabled={isPending} placeholder="Required Keywords" className="min-h-[80px]" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${formId}-${cat.id}-excluded`}>Excluded Keywords</Label>
                      <Textarea id={`${formId}-${cat.id}-excluded`} aria-describedby={`${formId}-rules-help`} value={editExcluded} onChange={(e) => setEditExcluded(e.target.value)} disabled={isPending} placeholder="Excluded Keywords" className="min-h-[80px]" />
                    </div>
                  </div>
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
