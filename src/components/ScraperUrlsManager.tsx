"use client";

import { useState, useTransition } from "react";
import { type ScraperUrl } from "@prisma/client";
import {
  addScraperUrl,
  deleteScraperUrl,
  toggleScraperUrl,
} from "@/app/actions/scraperUrl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, Play, Pause } from "lucide-react";
import { toast } from "@/components/ui/toast";

export function ScraperUrlsManager({
  initialUrls,
}: {
  initialUrls: ScraperUrl[];
}) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleAdd = () => {
    if (!url.trim()) return;

    startTransition(async () => {
      const result = await addScraperUrl(url, name);

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
          description: "URL added to scraper successfully!",
        });
        setUrl("");
        setName("");
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteScraperUrl(id);

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
          description: "URL removed.",
        });
      }
    });
  };

  const handleToggle = (id: string, currentStatus: boolean) => {
    startTransition(async () => {
      const result = await toggleScraperUrl(id, !currentStatus);

      if (result?.error) {
        toast.add({
          type: "error",
          title: "Error",
          description: result.error,
        });
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
            className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
              item.isActive ? "bg-card" : "bg-muted/50 opacity-70"
            }`}
          >
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
        ))}
      </div>
    </div>
  );
}
