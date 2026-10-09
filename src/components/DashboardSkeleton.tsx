export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8" role="status" aria-busy="true">
      <span className="sr-only">Loading dashboard</span>
      <aside className="space-y-8 lg:col-span-1" aria-hidden="true">
        {[1, 2, 3].map((section) => (
          <div key={section} className="bg-card border rounded-xl p-4 shadow-sm space-y-3 animate-pulse motion-reduce:animate-none">
            <div className="h-4 w-1/2 bg-muted rounded-md" />
            {[1, 2, 3].map((row) => (
              <div key={row} className="h-12 bg-muted/60 rounded-md" />
            ))}
          </div>
        ))}
      </aside>
      <div className="lg:col-span-3 space-y-6">
        <div className="h-9 w-2/3 bg-muted rounded-md animate-pulse motion-reduce:animate-none" aria-hidden="true" />
        <JobListSkeleton />
      </div>
    </div>
  );
}

export function JobListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4" aria-busy="true" aria-label="Loading job offers">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="bg-card border rounded-xl p-5 shadow-sm animate-pulse"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2.5 flex-1">
              <div className="flex items-center gap-2">
                <div className="h-5 bg-muted rounded-md w-2/3" />
                <div className="h-4 bg-muted/60 rounded-full w-10" />
              </div>
              <div className="h-4 bg-muted/60 rounded-md w-1/4" />
              <div className="flex items-center gap-2 pt-2">
                <div className="h-6 w-20 bg-muted/70 rounded-md" />
                <div className="h-6 w-24 bg-muted/70 rounded-md" />
                <div className="h-6 w-24 bg-muted/70 rounded-md" />
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-1.5 w-1/3">
              <div className="h-5 w-16 bg-muted/60 rounded-full" />
              <div className="h-5 w-20 bg-muted/60 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

