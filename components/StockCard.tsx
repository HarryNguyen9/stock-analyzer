import Link from "next/link";
import type { StockSummary } from "@/types/stock";
import { ScoreGauge } from "@/components/ScoreGauge";
import { vi } from "@/lib/i18n/vi";
import { sortSignalsByPriority } from "@/lib/signals";

export function StockCard({ stock }: { stock: StockSummary }) {
  const isUp = stock.dayChangePercent >= 0;
  const displaySignals = sortSignalsByPriority(stock.topSignals ?? []).slice(0, 2);
  const statusColor =
    stock.status === vi.score.constructive
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : stock.status === vi.score.neutral
        ? "text-amber-700 bg-amber-50 border-amber-200"
        : "text-rose-700 bg-rose-50 border-rose-200";

  return (
    <Link
      href={`/stock/${stock.symbol}`}
      className="group rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-950">{stock.symbol}</h2>
            <span className="rounded border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">
              {stock.exchange}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-slate-500">{stock.name}</p>
          <p className="mt-3 text-xs font-medium uppercase tracking-normal text-slate-400">
            {stock.sector}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <ScoreGauge score={stock.score} size="compact" />
          <span className={`rounded border px-2 py-0.5 text-xs font-medium ${statusColor}`}>
            {stock.status}
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
        <div>
          <p className="text-slate-500">{vi.stock.close}</p>
          <p className="mt-1 font-semibold text-slate-950">{stock.lastClose.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-slate-500">{vi.stock.change}</p>
          <p className={`mt-1 font-semibold ${isUp ? "text-emerald-600" : "text-rose-600"}`}>
            {isUp ? "+" : ""}
            {stock.dayChangePercent.toFixed(2)}%
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm font-medium text-slate-700 group-hover:text-slate-950">
        {stock.dataStatus === "ready" ? stock.signal : stock.dataError}
      </p>

      {stock.dataStatus === "ready" && displaySignals.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {displaySignals.map((signal) => (
            <span
              key={signal.code}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${getSignalClass(signal.sentiment)}`}
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
  if (sentiment === "bullish") return "bg-emerald-50 text-emerald-700";
  if (sentiment === "bearish") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-600";
}
