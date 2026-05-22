export default function CoveredWarrantDetailLoading() {
  return (
    <main className="min-h-screen bg-[#071126] pb-10 text-slate-100">
      <div className="sticky top-0 z-50 border-b border-cyan-300/10 bg-[#071126]/88 backdrop-blur-xl">
        <div className="mx-auto flex min-h-14 w-full max-w-7xl items-center justify-between gap-3 px-3 sm:px-6 lg:px-8">
          <div className="h-10 w-20 animate-pulse rounded-2xl bg-cyan-400/10" />
          <div className="h-6 w-32 animate-pulse rounded-full bg-cyan-400/10" />
          <div className="h-10 w-28 animate-pulse rounded-2xl bg-cyan-400/10" />
        </div>
      </div>

      <section className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="h-56 animate-pulse rounded-2xl border border-cyan-300/10 bg-cyan-400/10" />
        <div className="mt-5 h-14 animate-pulse rounded-[1.6rem] border border-cyan-300/10 bg-cyan-400/10" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl border border-cyan-300/10 bg-cyan-400/10" />
          ))}
        </div>
      </section>
    </main>
  );
}
