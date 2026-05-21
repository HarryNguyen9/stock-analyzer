import Link from "next/link";
import { formatTechnicalScore } from "@/lib/ai/score-format";
import { vi } from "@/lib/i18n/vi";
import {
  getScannerDiagnostics,
  getScannerGroups,
  getScoreSentiment,
  type ScannerGroup,
  type ScannerItem,
} from "@/lib/scanner/groups";
import type { SignalSentiment } from "@/lib/technical-analysis/types";
import type { StockSummary } from "@/types/stock";

export function MarketScanner({ stocks, snapshotGroups }: { stocks: StockSummary[]; snapshotGroups?: ScannerGroup[] | null }) {
  const sourceGroups = snapshotGroups ?? getScannerGroups(stocks);
  const diagnostics = snapshotGroups ? null : getScannerDiagnostics(sourceGroups);
  const groups = sourceGroups.filter((group) => group.items.length > 0);

  if (diagnostics) {
    console.info("market scanner quality diagnostics", diagnostics);
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className="animate-fade-in overflow-hidden rounded-2xl border border-cyan-400/15 bg-[#0b1b31] shadow-[0_20px_70px_rgba(2,8,23,0.24)] ring-1 ring-white/5">
        <div className="flex items-center justify-between gap-4 border-b border-cyan-400/10 p-5 sm:p-7">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal text-white sm:text-3xl">{vi.home.scannerTitle}</h2>
            <p className="mt-2 text-sm text-slate-400 sm:text-base">{vi.home.scannerSubtitle}</p>
          </div>
          <div className="hidden h-16 w-16 shrink-0 place-items-center rounded-full border border-cyan-300/20 bg-cyan-400/10 text-cyan-300 shadow-[0_0_36px_rgba(34,211,238,0.14)] sm:grid">
            <TargetIcon />
          </div>
        </div>

        {groups.length > 0 ? (
          <div className="divide-y divide-cyan-400/10">
            {groups.map((group) => (
              <section key={group.id} className="py-5 first:pt-5 last:pb-6">
                <div className="mb-4 flex items-center justify-between gap-4 px-5 sm:px-7">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border ${getGroupIconClass(group.id)}`}>
                      <GroupIcon id={group.id} />
                    </span>
                    <h3 className="truncate text-lg font-semibold text-white">{group.title}</h3>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-sm font-medium text-slate-400">
                    <span>{group.items.length} mã</span>
                    <span className="text-slate-500">›</span>
                  </div>
                </div>
                <div className="flex snap-x gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:px-7 [&::-webkit-scrollbar]:hidden">
                  {group.items.map((item) => (
                    <ScannerCard key={`${group.id}-${item.stock.symbol}`} item={item} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="m-5 rounded-xl border border-dashed border-cyan-400/15 bg-white/[0.03] p-4 text-sm text-slate-400">
            Chưa có đủ tín hiệu chất lượng cao.
          </div>
        )}
      </div>
    </section>
  );
}

function ScannerCard({ item }: { item: ScannerItem }) {
  const isUp = item.stock.dayChangePercent >= 0;
  const sentiment = item.signal?.sentiment ?? getScoreSentiment(item.stock.score);

  return (
    <Link
      href={`/stock/${item.stock.symbol}`}
      prefetch={false}
      className="w-56 shrink-0 snap-start rounded-xl border border-cyan-400/15 bg-[#10223b]/80 p-4 shadow-[0_12px_36px_rgba(2,8,23,0.16)] transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-[#132945] active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-semibold text-white">{item.stock.symbol}</p>
            <span className="rounded-md border border-cyan-400/20 bg-cyan-400/10 px-1.5 py-0.5 text-[11px] font-medium text-cyan-200">
              {item.stock.exchange}
            </span>
          </div>
          <p className="mt-3 text-xl font-semibold tabular-nums text-white">{item.stock.lastClose.toFixed(2)}</p>
        </div>
        <div className="text-right">
          <p className={`text-base font-semibold ${isUp ? "text-emerald-300" : "text-rose-300"}`}>
            {isUp ? "+" : ""}
            {item.stock.dayChangePercent.toFixed(2)}%
          </p>
          <p className="mt-2 text-sm font-medium text-slate-400">{formatTechnicalScore(item.stock.score)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="line-clamp-1 text-sm font-medium text-slate-300">
          {item.signal?.labelVi ?? item.stock.signal}
        </p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${getSentimentClass(sentiment)}`}>
          {vi.home.scannerSentiment[sentiment]}
        </span>
      </div>
    </Link>
  );
}

function getSentimentClass(sentiment: SignalSentiment): string {
  if (sentiment === "bullish") return "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-300/15";
  if (sentiment === "bearish") return "bg-rose-400/10 text-rose-300 ring-1 ring-rose-300/15";
  return "bg-slate-400/10 text-slate-300 ring-1 ring-slate-300/15";
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M22 12h-4" />
      <path d="m12 12 6-6" strokeLinecap="round" />
    </svg>
  );
}

function GroupIcon({ id }: { id: ScannerGroup["id"] }) {
  if (id === "breakout") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
      </svg>
    );
  }

  if (id === "volumeSpike" || id === "strongTrend") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 19V9" />
        <path d="M12 19V5" />
        <path d="M19 19v-7" />
      </svg>
    );
  }

  if (id === "riskWarning") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3 2 21h20L12 3Z" />
        <path d="M12 9v5" />
        <path d="M12 17h.01" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="m12 2 2.9 6 6.6.9-4.8 4.7 1.2 6.5L12 17l-5.9 3.1 1.2-6.5-4.8-4.7 6.6-.9L12 2Z" />
    </svg>
  );
}

function getGroupIconClass(id: ScannerGroup["id"]): string {
  if (id === "breakout") return "border-amber-300/30 bg-amber-400/10 text-amber-300";
  if (id === "riskWarning") return "border-rose-300/30 bg-rose-400/10 text-rose-300";
  return "border-cyan-300/25 bg-cyan-400/10 text-cyan-300";
}
