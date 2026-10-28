import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  itemName?: string;
  /**
   * If provided, renders semantic Next.js Links with precomputed URLs.
   * If omitted, renders client-side interactive Buttons calling `onPageChange`.
   */
  getPageUrl?: (page: number) => string;
  onPageChange?: (page: number) => void;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  itemName = "items",
  getPageUrl,
  onPageChange,
  className = "",
}: PaginationProps) {
  if (totalItems === 0 || totalPages <= 1) {
    return null;
  }

  const validPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const isFirst = validPage <= 1;
  const isLast = validPage >= totalPages;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4 px-1 ${className}`}
    >
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{startIndex + 1}</span>–
        <span className="font-medium text-foreground">{endIndex}</span> of{" "}
        <span className="font-medium text-foreground">{totalItems}</span> {itemName}
      </p>

      <div className="flex items-center gap-2">
        {getPageUrl ? (
          <Link
            href={getPageUrl(validPage - 1)}
            aria-disabled={isFirst}
            tabIndex={isFirst ? -1 : undefined}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              isFirst
                ? "pointer-events-none opacity-40 border-border bg-muted/20 text-muted-foreground"
                : "bg-card hover:bg-accent border-border text-foreground cursor-pointer shadow-sm"
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </Link>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={isFirst}
            onClick={() => onPageChange?.(validPage - 1)}
            className="gap-1 text-xs"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </Button>
        )}

        <span className="text-xs font-medium text-muted-foreground px-2">
          Page {validPage} of {totalPages}
        </span>

        {getPageUrl ? (
          <Link
            href={getPageUrl(validPage + 1)}
            aria-disabled={isLast}
            tabIndex={isLast ? -1 : undefined}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              isLast
                ? "pointer-events-none opacity-40 border-border bg-muted/20 text-muted-foreground"
                : "bg-card hover:bg-accent border-border text-foreground cursor-pointer shadow-sm"
            }`}
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={isLast}
            onClick={() => onPageChange?.(validPage + 1)}
            className="gap-1 text-xs"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
