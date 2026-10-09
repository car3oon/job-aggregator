export default function SettingsLoading() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300 motion-reduce:animate-none" role="status" aria-busy="true">
      <span className="sr-only">Loading settings</span>
      <div aria-hidden="true">
        <div className="h-9 w-48 max-w-full bg-muted rounded-lg animate-pulse motion-reduce:animate-none" />
        <div className="h-4 w-96 max-w-full bg-muted/60 rounded-md mt-2 animate-pulse motion-reduce:animate-none" />
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start w-full" aria-hidden="true">
        {/* Sidebar skeleton */}
        <div className="w-full md:w-64 shrink-0">
          <div className="p-1 bg-muted/60 rounded-xl grid grid-cols-3 md:grid-cols-1 gap-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-10 bg-muted/80 rounded-lg animate-pulse motion-reduce:animate-none"
              />
            ))}
          </div>
        </div>

        {/* Main content skeleton */}
        <div className="flex-1 w-full min-w-0">
          <div className="bg-card rounded-xl border shadow-sm p-6 space-y-6 animate-pulse motion-reduce:animate-none">
            <div className="space-y-2">
              <div className="h-6 w-48 max-w-full bg-muted rounded-md" />
              <div className="h-4 w-72 max-w-full bg-muted/60 rounded-md" />
            </div>

            {/* Form inputs skeleton */}
            <div className="space-y-3 p-4 rounded-lg border">
              <div className="h-4 w-24 max-w-full bg-muted/60 rounded-md" />
              <div className="h-8 bg-muted/70 rounded-md" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[1, 2].map((field) => (
                  <div key={field} className="space-y-2">
                    <div className="h-4 w-32 max-w-full bg-muted/60 rounded-md" />
                    <div className="h-[100px] bg-muted/70 rounded-md" />
                  </div>
                ))}
              </div>
              <div className="h-8 w-32 max-w-full bg-muted/70 rounded-md ml-auto" />
            </div>

            {/* List items skeleton */}
            <div className="space-y-3 pt-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 bg-muted/40 border border-muted/50 rounded-lg"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
