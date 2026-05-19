export default function StockDetailLoading() {
  return (
    <main className="min-h-screen bg-slate-50 pb-10 dark:bg-slate-950">
      <div className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto h-14 w-full max-w-7xl px-4 sm:px-6 lg:px-8" />
      </div>
      <section className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80 sm:h-[420px]" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <Skeleton className="h-52" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-72" />
        </div>
      </section>
    </main>
  );
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800 ${className}`} />;
}
