"use client";

import { useState, useTransition, useRef } from "react";
import {
  uploadCvVersion,
  renameCvVersion,
  replaceCvVersion,
  deleteCvVersion,
  type CvVersionMetadata,
} from "@/app/actions/cvActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  FileText,
  Upload,
  Loader2,
  Pencil,
  Trash2,
  RefreshCw,
  Check,
  X,
  AlertCircle,
} from "lucide-react";

type PendingAction = {
  type: "upload" | "rename" | "replace" | "delete";
  id?: string;
  label?: string;
};

export function CvLibraryTab({
  initialCvs,
}: {
  initialCvs: CvVersionMetadata[];
}) {
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const label = (formData.get("label") as string | null)?.trim() ?? "";

    setPendingAction({ type: "upload", label });
    startTransition(async () => {
      try {
        const res = await uploadCvVersion(formData);
        if (!res.ok) {
          setError(res.error ?? "Upload failed");
        } else {
          form.reset();
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      } finally {
        setPendingAction(null);
      }
    });
  }

  function handleRename(id: string) {
    setError(null);
    setPendingAction({ type: "rename", id });
    startTransition(async () => {
      try {
        const res = await renameCvVersion(id, editLabel);
        if (!res.ok) setError(res.error ?? "Rename failed");
        else setEditingId(null);
      } finally {
        setPendingAction(null);
      }
    });
  }

  function handleReplace(id: string, file: File) {
    setError(null);
    setPendingAction({ type: "replace", id });
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      try {
        const res = await replaceCvVersion(id, formData);
        if (!res.ok) setError(res.error ?? "Replace failed");
      } finally {
        setPendingAction(null);
      }
    });
  }

  function handleDelete(id: string) {
    setError(null);
    setPendingAction({ type: "delete", id });
    startTransition(async () => {
      try {
        const res = await deleteCvVersion(id);
        if (!res.ok) setError("Delete failed");
      } finally {
        setPendingAction(null);
      }
    });
  }

  const isFull = initialCvs.length >= 10;
  const sortedCvs = [...initialCvs].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Form */}
      <form
        onSubmit={handleUpload}
        className="flex flex-col sm:flex-row items-end gap-3 p-4 rounded-xl border bg-muted/20"
      >
        <div className="w-full sm:w-1/3">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Version Label
          </label>
          <Input
            name="label"
            type="text"
            required
            placeholder="e.g., Frontend, Fullstack"
            disabled={isPending || isFull}
          />
        </div>
        <div className="w-full sm:flex-1">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            CV File (PDF or DOCX, max 5 MB)
          </label>
          <input
            ref={fileInputRef}
            name="file"
            type="file"
            required
            accept=".pdf,.docx"
            disabled={isPending || isFull}
            className="w-full text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-border file:font-medium file:bg-background hover:file:bg-muted disabled:opacity-50 cursor-pointer"
          />
        </div>
        <Button
          type="submit"
          disabled={isPending || isFull}
          className="w-full sm:w-auto shrink-0"
        >
          {isPending && pendingAction?.type === "upload" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              Processing…
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-1.5" />
              Upload CV
            </>
          )}
        </Button>
      </form>

      {/* CV List */}
      <div className="divide-y border rounded-xl overflow-hidden bg-card shadow-xs">
        {/* Upload in-progress optimistic skeleton row */}
        {isPending && pendingAction?.type === "upload" && (
          <div className="p-4 flex items-center justify-between gap-3 bg-primary/5 border-l-2 border-primary animate-pulse">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">
                  {pendingAction.label
                    ? `Processing "${pendingAction.label}"…`
                    : "Processing new CV…"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Extracting text layer and calculating hashes
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-primary shrink-0">
              Uploading…
            </span>
          </div>
        )}

        {sortedCvs.length === 0 && !isPending ? (
          <div className="p-8 text-center text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No CV versions uploaded yet</p>
            <p className="text-xs mt-1">
              Upload your first CV version above to enable AI-powered job
              matching.
            </p>
          </div>
        ) : (
          sortedCvs.map((cv) => {
            const isDeleting =
              isPending &&
              pendingAction?.type === "delete" &&
              pendingAction.id === cv.id;
            const isReplacing =
              isPending &&
              pendingAction?.type === "replace" &&
              pendingAction.id === cv.id;
            const isRenaming =
              isPending &&
              pendingAction?.type === "rename" &&
              pendingAction.id === cv.id;

            return (
              <div
                key={cv.id}
                className={cn(
                  "p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors",
                  isDeleting
                    ? "opacity-40 bg-destructive/5"
                    : isReplacing
                      ? "opacity-60 bg-muted/20"
                      : "hover:bg-muted/30"
                )}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                    {isReplacing || isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    {editingId === cv.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className="h-7 text-xs w-48"
                          autoFocus
                          disabled={isRenaming}
                        />
                        <Button
                          type="button"
                          size="xs"
                          onClick={() => handleRename(cv.id)}
                          disabled={isPending || !editLabel.trim()}
                        >
                          {isRenaming ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <Check className="w-3 h-3 mr-1" />
                          )}
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => setEditingId(null)}
                          disabled={isPending}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <p className="font-semibold text-sm text-foreground truncate">
                        {cv.label}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {isReplacing ? (
                        <span className="text-primary font-medium">
                          Extracting replacement file…
                        </span>
                      ) : isDeleting ? (
                        <span className="text-destructive font-medium">
                          Deleting CV version…
                        </span>
                      ) : (
                        <>
                          {cv.originalFilename} •{" "}
                          {cv.wordCount.toLocaleString()} words • Updated{" "}
                          {new Intl.DateTimeFormat("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }).format(new Date(cv.updatedAt))}
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setEditingId(cv.id);
                      setEditLabel(cv.label);
                    }}
                    disabled={isPending}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1" />
                    Rename
                  </Button>

                  <label
                    className={cn(
                      "inline-flex items-center justify-center rounded-lg text-xs font-medium h-6 px-2 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors",
                      isPending && "pointer-events-none opacity-50"
                    )}
                  >
                    {isReplacing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                        Replacing…
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 mr-1" />
                        Replace
                      </>
                    )}
                    <input
                      type="file"
                      accept=".pdf,.docx"
                      disabled={isPending}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleReplace(cv.id, f);
                      }}
                    />
                  </label>

                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => handleDelete(cv.id)}
                    disabled={isPending}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                        Deleting…
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Delete
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
