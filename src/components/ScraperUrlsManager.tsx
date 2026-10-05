"use client";

import { useState, useTransition } from "react";
import { type ScraperUrl } from "@prisma/client";
import {
  addScraperUrl,
  deleteScraperUrl,
  toggleScraperUrl,
  updateScraperUrl,
} from "@/app/actions/scraperUrl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, Play, Pause, Pencil, Check } from "lucide-react";
import { toast } from "@/components/ui/toast";

export function ScraperUrlsManager({
  initialUrls,
}: {
  initialUrls: ScraperUrl[];
}) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editName, setEditName] = useState("");

  const handleAdd = () => {
    if (!url.trim()) return;

    startTransition(async () => {
      const result = await addScraperUrl(url, name);

      if (result?.error) {
        toast.add({ type: "error", title: "Error", description: result.error });
      } else {
        toast.add({ type: "success", title: "Success", description: "URL added to scraper successfully!" });
        setUrl("");
        setName("");
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteScraperUrl(id);
      if (result?.error) {
        toast.add({ type: "error", title: "Error", description: result.error });
      } else {
        toast.add({ type: "success", title: "Success", description: "URL removed." });
      }
    });
  };

  const handleToggle = (id: string, currentStatus: boolean) => {
    startTransition(async () => {
      const result = await toggleScraperUrl(id, !currentStatus);
      if (result?.error) {
        toast.add({ type: "error", title: "Error", description: result.error });
      }
    });
  };

  const handleEditInit = (item: ScraperUrl) => {
    setEditingId(item.id);
    setEditUrl(item.url);
    setEditName(item.name || "");
  };

  const handleSaveEdit = (item: ScraperUrl) => {
    if (!editUrl.trim()) return;
    
    startTransition(async () => {
      const result = await updateScraperUrl(item.id, editUrl, editName);
      if (result?.error) {
        toast.add({ type: "error", title: "Error", description: result.error });
      } else {
        toast.add({ type: "success", title: "Success", description: "Source updated!" });
        setEditingId(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Service Name (Optional) e.g. JustJoinIT"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
          className="sm:w-1/3"
        />
        <Input
          placeholder="https://... (URL to scrape)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          disabled={isPending}
          className="flex-1"
        />
        <Button onClick={handleAdd} disabled={isPending || !url.trim()}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add URL"}
        </Button>
      </div>

      <div className="space-y-3">
        {initialUrls.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            No scraper URLs added yet.
          </p>
        )}

        {initialUrls.map((item) => (
          <div
            key={item.id}
            className={`flex flex-col p-4 rounded-lg border transition-colors ${
              item.isActive ? "bg-card" : "bg-muted/50 opacity-70"
            }`}
          >
            {editingId === item.id ? (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} disabled={isPending} placeholder="Service Name (Optional)" />
                  <Input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} disabled={isPending} placeholder="URL" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingId(null)} disabled={isPending}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={() => handleSaveEdit(item)} disabled={isPending || !editUrl.trim()}>
                    {isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />} Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="overflow-hidden pr-4">
                  <p className="font-medium truncate">
                    {item.name || "Unnamed Source"}
                  </p>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-muted-foreground hover:underline truncate block"
                  >
                    {item.url}
                  </a>
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
                    title={item.isActive ? "Pause scraping" : "Resume scraping"}
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
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
