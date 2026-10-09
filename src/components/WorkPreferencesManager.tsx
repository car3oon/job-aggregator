"use client";

import { useState, useTransition } from "react";
import { type WorkPreference } from "@prisma/client";
import {
  addWorkPreference,
  deleteWorkPreference,
  toggleWorkPreference,
  updateWorkPreference,
} from "@/app/actions/workPreference";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, Play, Pause, MapPin, Pencil, Check } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useEscapeKey } from "@/hooks/useEscapeKey";

export function WorkPreferencesManager({
  initialPreferences,
}: {
  initialPreferences: WorkPreference[];
}) {
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [isPending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editKeywords, setEditKeywords] = useState("");

  useEscapeKey(() => setEditingId(null), editingId !== null && !isPending);

  const handleAdd = () => {
    if (!name.trim() || !keywords.trim()) return;

    startTransition(async () => {
      const result = await addWorkPreference(name, keywords);

      if (result?.error) {
        toast.add({ type: "error", title: "Error", description: result.error });
      } else {
        toast.add({ type: "success", title: "Success", description: "Preference added!" });
        setName("");
        setKeywords("");
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteWorkPreference(id);
      if (result?.error) {
        toast.add({ type: "error", title: "Error", description: result.error });
      }
    });
  };

  const handleToggle = (id: string, currentStatus: boolean) => {
    startTransition(async () => {
      const result = await toggleWorkPreference(id, !currentStatus);
      if (result?.error) {
        toast.add({ type: "error", title: "Error", description: result.error });
      }
    });
  };

  const handleEditInit = (pref: WorkPreference) => {
    setEditingId(pref.id);
    setEditName(pref.name);
    setEditKeywords(pref.keywords.join(", "));
  };

  const handleSaveEdit = (pref: WorkPreference) => {
    if (!editName.trim()) return;
    
    startTransition(async () => {
      const result = await updateWorkPreference(pref.id, editName, editKeywords, pref.isActive);
      if (result?.error) {
        toast.add({ type: "error", title: "Error", description: result.error });
      } else {
        toast.add({ type: "success", title: "Success", description: "Preference updated!" });
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
        className="flex flex-col sm:flex-row gap-2"
      >
        <Input
          placeholder="Name (e.g. Remote, Warsaw Hybrid)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
          className="sm:w-1/3"
        />
        <Input
          placeholder="Keywords (e.g. remote, zdalna, warszawa)"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          disabled={isPending}
          className="flex-1"
        />
        <Button type="submit" disabled={isPending || !name.trim() || !keywords.trim()}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
        </Button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {initialPreferences.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            No work preferences added yet.
          </p>
        )}

        {initialPreferences.map((item) => (
          <div
            key={item.id}
            className={`flex flex-col p-4 rounded-lg border transition-colors ${
              item.isActive ? "bg-card" : "bg-muted/50 opacity-70"
            }`}
          >
            {editingId === item.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveEdit(item);
                }}
                className="flex flex-col gap-3"
              >
                <div className="flex flex-col gap-3">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} disabled={isPending} placeholder="Name" />
                  <Input value={editKeywords} onChange={(e) => setEditKeywords(e.target.value)} disabled={isPending} placeholder="Keywords" />
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
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {item.name}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Keywords: {item.keywords.join(", ")}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditInit(item)}
                    disabled={isPending}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={item.isActive ? "outline" : "secondary"}
                    size="sm"
                    onClick={() => handleToggle(item.id, item.isActive)}
                    disabled={isPending}
                    title={item.isActive ? "Disable preference" : "Enable preference"}
                  >
                    {item.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                    disabled={isPending}
                  >
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
