"use client";

import { useState, useTransition } from "react";
import { type WorkPreference } from "@prisma/client";
import {
  addWorkPreference,
  deleteWorkPreference,
  toggleWorkPreference,
} from "@/app/actions/workPreference";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, Play, Pause, MapPin } from "lucide-react";
import { toast } from "@/components/ui/toast";

export function WorkPreferencesManager({
  initialPreferences,
}: {
  initialPreferences: WorkPreference[];
}) {
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleAdd = () => {
    if (!name.trim() || !keywords.trim()) return;

    startTransition(async () => {
      const result = await addWorkPreference(name, keywords);

      if (result?.error) {
        toast.add({ type: "error", title: "Error", description: result.error });
      } else {
        toast.add({
          type: "success",
          title: "Success",
          description: "Preference added!",
        });
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-2">
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
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          disabled={isPending}
          className="flex-1"
        />
        <Button
          onClick={handleAdd}
          disabled={isPending || !name.trim() || !keywords.trim()}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
        </Button>
      </div>

      <div className="space-y-3">
        {initialPreferences.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            No work preferences added yet.
          </p>
        )}

        {initialPreferences.map((item) => (
          <div
            key={item.id}
            className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
              item.isActive ? "bg-card" : "bg-muted/50 opacity-70"
            }`}
          >
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
                variant={item.isActive ? "outline" : "secondary"}
                size="sm"
                onClick={() => handleToggle(item.id, item.isActive)}
                disabled={isPending}
                title={
                  item.isActive ? "Disable preference" : "Enable preference"
                }
              >
                {item.isActive ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
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
        ))}
      </div>
    </div>
  );
}
