export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
          <Skeleton className="h-20 max-w-md" />
          <Skeleton className="h-10 max-w-2xl" />
          <div className="grid grid-cols-2 gap-3 sm:w-80">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </div>
      </section>
      <section className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <Skeleton className="h-12" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-40" />
          ))}
        </div>
      </section>
    </main>
  );
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800 ${className}`} />;
}
