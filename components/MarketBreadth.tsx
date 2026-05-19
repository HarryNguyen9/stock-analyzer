import type { MarketBreadthSnapshot } from "@/lib/pipeline/snapshot";

export function MarketBreadth({ breadth }: { breadth: MarketBreadthSnapshot }) {
  const isConstructive = breadth.advancers > breadth.decliners && breadth.percentAboveSMA20 >= 50;
  const isWeak = breadth.decliners > breadth.advancers && breadth.percentAboveSMA20 < 45;
  const toneClass = isConstructive
    ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-950 dark:bg-emerald-950/30"
    : isWeak
      ? "border-rose-200 bg-rose-50/70 dark:border-rose-950 dark:bg-rose-950/25"
      : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900";
  const changeClass = breadth.averageChangePercent >= 0
    ? "text-emerald-700 dark:text-emerald-400"
    : "text-rose-700 dark:text-rose-400";

  if (breadth.totalSymbols === 0) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className={`rounded-lg border p-4 shadow-sm ${toneClass}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Độ rộng thị trường</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Toàn cảnh số mã tăng/giảm và sức khỏe xu hướng ngắn hạn.
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className={`text-2xl font-semibold ${changeClass}`}>
              {breadth.averageChangePercent >= 0 ? "+" : ""}
              {breadth.averageChangePercent.toFixed(2)}%
            </p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Trung bình</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Metric label="Tăng" value={breadth.advancers.toString()} tone="positive" />
          <Metric label="Giảm" value={breadth.decliners.toString()} tone="negative" />
          <Metric label="Không đổi" value={breadth.unchanged.toString()} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="A/D ratio" value={formatRatio(breadth.advanceDeclineRatio)} />
          <Metric label="Trên MA20" value={`${breadth.percentAboveSMA20.toFixed(0)}%`} />
          <Metric label="Trên MA50" value={`${breadth.percentAboveSMA50.toFixed(0)}%`} />
          <Metric
            label="Median"
            value={`${breadth.medianChangePercent >= 0 ? "+" : ""}${breadth.medianChangePercent.toFixed(2)}%`}
            tone={breadth.medianChangePercent >= 0 ? "positive" : "negative"}
          />
          <Metric label="High 20" value={breadth.newHigh20.toString()} tone="positive" />
          <Metric label="Low 20" value={breadth.newLow20.toString()} tone="negative" />
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  const valueClass = tone === "positive"
    ? "text-emerald-700 dark:text-emerald-400"
    : tone === "negative"
      ? "text-rose-700 dark:text-rose-400"
      : "text-slate-950 dark:text-white";

  return (
    <div className="rounded-lg bg-white/75 p-3 dark:bg-slate-950/50">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-base font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}

function formatRatio(value: number | null): string {
  if (value === null) {
    return "N/A";
  }

  return value.toFixed(2);
}
