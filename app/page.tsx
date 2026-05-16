import { StockCard } from "@/components/StockCard";
import { vi } from "@/lib/i18n/vi";
import { getStockSummaries } from "@/lib/data-source/prices";

export default async function Home() {
  const stocks = await getStockSummaries();
  const averageScore = Math.round(
    stocks.reduce((total, stock) => total + stock.score, 0) / stocks.length,
  );
  const positiveCount = stocks.filter((stock) => stock.dayChangePercent >= 0).length;
  const hasDataError = stocks.some((stock) => stock.dataStatus === "error");

  return (
    <main className="min-h-screen">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-normal text-emerald-700">
                {vi.home.eyebrow}
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
                {vi.home.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                {vi.home.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:w-80">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">{vi.home.averageScore}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{averageScore}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">{vi.home.greenToday}</p>
                <p className="mt-2 text-3xl font-semibold text-emerald-700">
                  {positiveCount}/{stocks.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-950">{vi.home.watchlist}</h2>
          <p className="text-sm text-slate-500">
            {hasDataError ? vi.home.dataError : vi.home.localData}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stocks.map((stock) => (
            <StockCard key={stock.symbol} stock={stock} />
          ))}
        </div>
      </section>
    </main>
  );
}
