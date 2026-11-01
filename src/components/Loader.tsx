export function PageLoader() {
  return (
    <main role="status" aria-label="Loading" className="flex min-h-screen items-center justify-center bg-[#0a1016]">
      <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-cyan-400 motion-reduce:animate-none" />
    </main>
  );
}

export function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/10 motion-reduce:animate-none ${className}`} />;
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-[22px] border border-white/5 bg-[#0d1820] px-3 py-3">
          <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-14 shrink-0" />
        </div>
      ))}
    </div>
  );
}
