"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, PlusCircle, X } from "lucide-react";
import { addManualJob } from "@/app/actions/job";
import { inferJobSourceFromUrl, MANUAL_JOB_LIMITS } from "@/lib/job-source";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface SelectOption {
  id: string;
  name: string;
}

interface MultiSelectFieldProps {
  id: string;
  label: string;
  placeholder: string;
  emptyLabel: string;
  options: SelectOption[];
  selectedIds: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}

function MultiSelectField({
  id,
  label,
  placeholder,
  emptyLabel,
  options,
  selectedIds,
  onAdd,
  onRemove,
}: MultiSelectFieldProps) {
  const selectedSet = new Set(selectedIds);
  const availableOptions = options.filter((opt) => !selectedSet.has(opt.id));
  const selectedOptions = options.filter((opt) => selectedSet.has(opt.id));

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value=""
        onChange={(e) => {
          if (e.target.value) {
            onAdd(e.target.value);
          }
        }}
        disabled={options.length === 0 || availableOptions.length === 0}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">
          {options.length === 0
            ? emptyLabel
            : availableOptions.length === 0
              ? "All options selected"
              : placeholder}
        </option>
        {availableOptions.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.name}
          </option>
        ))}
      </select>

      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selectedOptions.map((opt) => (
            <span
              key={opt.id}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
            >
              <span>{opt.name}</span>
              <button
                type="button"
                onClick={() => onRemove(opt.id)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors cursor-pointer"
                aria-label={`Remove ${opt.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function AddJobForm({
  categories,
  workPreferences,
}: {
  categories: SelectOption[];
  workPreferences: SelectOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [url, setUrl] = useState("");
  const [source, setSource] = useState("");
  const [sourceEdited, setSourceEdited] = useState(false);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [workPreferenceIds, setWorkPreferenceIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleUrlChange = (nextUrl: string) => {
    setUrl(nextUrl);
    if (!sourceEdited) {
      setSource(nextUrl.trim() ? inferJobSourceFromUrl(nextUrl) : "");
    }
  };

  const handleSourceChange = (nextSource: string) => {
    setSource(nextSource);
    setSourceEdited(nextSource.trim().length > 0);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await addManualJob({
        url,
        source,
        title,
        company,
        description,
        categoryIds,
        workPreferenceIds,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      router.push("/");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="job-url">Job URL *</Label>
          <Input
            id="job-url"
            type="url"
            required
            maxLength={MANUAL_JOB_LIMITS.url}
            placeholder="https://www.linkedin.com/jobs/view/..."
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="job-source">Source</Label>
          <Input
            id="job-source"
            type="text"
            maxLength={MANUAL_JOB_LIMITS.source}
            placeholder="Auto-detected from URL"
            value={source}
            onChange={(e) => handleSourceChange(e.target.value)}
            disabled={isPending}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="job-title">Job Title *</Label>
          <Input
            id="job-title"
            type="text"
            required
            maxLength={MANUAL_JOB_LIMITS.title}
            placeholder="e.g. Senior Frontend Engineer"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="job-company">Company</Label>
          <Input
            id="job-company"
            type="text"
            maxLength={MANUAL_JOB_LIMITS.company}
            placeholder="e.g. Acme Corp"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            disabled={isPending}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MultiSelectField
          id="job-categories"
          label="Categories"
          placeholder="Select categories..."
          emptyLabel="No categories configured"
          options={categories}
          selectedIds={categoryIds}
          onAdd={(id) => setCategoryIds((prev) => [...prev, id])}
          onRemove={(id) =>
            setCategoryIds((prev) => prev.filter((item) => item !== id))
          }
        />

        <MultiSelectField
          id="job-work-preferences"
          label="Work Preferences"
          placeholder="Select work preferences..."
          emptyLabel="No work preferences configured"
          options={workPreferences}
          selectedIds={workPreferenceIds}
          onAdd={(id) => setWorkPreferenceIds((prev) => [...prev, id])}
          onRemove={(id) =>
            setWorkPreferenceIds((prev) => prev.filter((item) => item !== id))
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="job-description">Job Description *</Label>
        <Textarea
          id="job-description"
          required
          rows={12}
          maxLength={MANUAL_JOB_LIMITS.description}
          className="min-h-[240px] resize-y"
          placeholder="Paste the full job description here. This text will be used for AI Analysis and Interview Prep."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isPending}
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Link href="/">
          <Button type="button" variant="outline" disabled={isPending}>
            Cancel
          </Button>
        </Link>
        <Button type="submit" disabled={isPending} className="gap-2">
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <PlusCircle className="h-4 w-4" />
              <span>Add to Inbox</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
