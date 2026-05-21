import Link from "next/link";
import type { StockSummary } from "@/types/stock";
import { ScoreGauge } from "@/components/ScoreGauge";
import { vi } from "@/lib/i18n/vi";
import { sortSignalsByPriority } from "@/lib/signals";

export function StockCard({ stock }: { stock: StockSummary }) {
  const hasPriceData = stock.dataStatus === "ready";
  const isUp = stock.dayChangePercent >= 0;
  const displaySignals = sortSignalsByPriority(stock.topSignals ?? []).slice(0, 2);
  const statusColor =
    stock.status === vi.score.constructive
      ? "border-emerald-300/40 bg-emerald-50 text-emerald-700 dark:border-emerald-300/25 dark:bg-emerald-400/10 dark:text-emerald-300"
      : stock.status === vi.score.neutral
        ? "border-amber-300/40 bg-amber-50 text-amber-700 dark:border-amber-300/25 dark:bg-amber-400/10 dark:text-amber-300"
        : "border-rose-300/40 bg-rose-50 text-rose-700 dark:border-rose-300/25 dark:bg-rose-400/10 dark:text-rose-300";

  return (
    <Link
      href={`/stock/${stock.symbol}`}
      className="group block w-full min-w-0 overflow-hidden rounded-2xl border border-sky-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.10)] ring-1 ring-slate-900/[0.03] transition hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-sky-50 active:scale-[0.99] dark:border-cyan-400/15 dark:bg-[#0b1b31] dark:shadow-[0_18px_60px_rgba(2,8,23,0.22)] dark:ring-white/5 dark:hover:border-cyan-300/30 dark:hover:bg-[#10223b]"
    >
      <div className="grid grid-cols-[1fr_auto] gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{stock.symbol}</h2>
            <span className="rounded-md border border-cyan-300 bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-700 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-200">
              {stock.exchange}
            </span>
          </div>
          <p className="mt-3 break-words text-base leading-6 text-slate-700 dark:text-slate-300">{stock.name}</p>
          <p className="mt-3 text-xs font-medium uppercase tracking-normal text-slate-500">{stock.sector}</p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {hasPriceData ? (
            <>
              <ScoreGauge score={stock.score} size="compact" />
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusColor}`}>{stock.status}</span>
            </>
          ) : (
            <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-600 dark:bg-white/5 dark:text-slate-300">
              Chưa có dữ liệu giá
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-sky-100 pt-5 dark:border-cyan-400/10">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{vi.stock.close}</p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-slate-950 dark:text-white">
            {hasPriceData ? stock.lastClose.toFixed(2) : "Chưa có"}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{vi.stock.change}</p>
          <p className={`mt-2 text-xl font-semibold tabular-nums ${hasPriceData ? (isUp ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300") : "text-slate-400"}`}>
            {hasPriceData ? `${isUp ? "+" : ""}${stock.dayChangePercent.toFixed(2)}%` : "Chưa có"}
          </p>
        </div>
      </div>

      <p className="mt-5 line-clamp-2 break-words text-base font-medium text-slate-700 group-hover:text-slate-950 dark:text-slate-300 dark:group-hover:text-white">
        {hasPriceData ? stock.signal : stock.dataError ?? "Chưa có dữ liệu giá"}
      </p>

      {hasPriceData && displaySignals.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {displaySignals.map((signal) => (
            <span
              key={signal.code}
              className={`max-w-full rounded-full border px-3 py-1 text-sm font-medium ${getSignalClass(signal.sentiment)}`}
            >
              {signal.labelVi}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}

function getSignalClass(sentiment: "bullish" | "bearish" | "neutral"): string {
  if (sentiment === "bullish") return "border-emerald-300/40 bg-emerald-50 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-400/10 dark:text-emerald-300";
  if (sentiment === "bearish") return "border-rose-300/40 bg-rose-50 text-rose-700 dark:border-rose-300/20 dark:bg-rose-400/10 dark:text-rose-300";
  return "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-300/15 dark:bg-slate-400/10 dark:text-slate-300";
}
