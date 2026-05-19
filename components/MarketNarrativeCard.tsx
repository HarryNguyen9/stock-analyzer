import type { MarketMood, MarketNarrative } from "@/lib/market/narrative";

export function MarketNarrativeCard({ narrative }: { narrative: MarketNarrative }) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className={`animate-fade-in rounded-2xl border p-4 shadow-sm transition dark:shadow-none sm:p-5 ${getMoodClass(narrative.marketMood)}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Nhịp thị trường</h2>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getBadgeClass(narrative.marketMood)}`}>
                {getMoodLabel(narrative.marketMood)}
              </span>
            </div>
            <p className="mt-3 text-xl font-semibold leading-7 text-slate-950 dark:text-white">
              {narrative.headlineVi}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {narrative.summaryVi}
            </p>
          </div>

          <div className="shrink-0 rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-950/50 dark:text-slate-200">
            {getComparisonLabel(narrative.comparison.status)}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1.3fr_1fr]">
          <NarrativeList title="Động lực chính" items={narrative.keyDrivers} />
          <NarrativeList title="Điểm cần chú ý" items={narrative.riskNotes.length > 0 ? narrative.riskNotes : ["Chưa có rủi ro nổi bật trong snapshot hiện tại."]} />
        </div>
      </div>
    </section>
  );
}

function NarrativeList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-white/60 bg-white/65 p-3 dark:border-slate-800/80 dark:bg-slate-950/35">
      <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h3>
      <ul className="mt-2 space-y-2">
        {items.slice(0, 4).map((item, index) => (
          <li
            key={`${title}-${item}`}
            className="animate-fade-in text-sm leading-5 text-slate-600 dark:text-slate-300"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function getMoodClass(mood: MarketMood): string {
  if (mood === "bullish") {
    return "border-emerald-200 bg-emerald-50/90 dark:border-emerald-950 dark:bg-emerald-950/30";
  }

  if (mood === "bearish") {
    return "border-rose-200 bg-rose-50/90 dark:border-rose-950 dark:bg-rose-950/25";
  }

  if (mood === "mixed") {
    return "border-amber-200 bg-amber-50/90 dark:border-amber-950 dark:bg-amber-950/25";
  }

  return "border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/70";
}

function getBadgeClass(mood: MarketMood): string {
  if (mood === "bullish") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (mood === "bearish") return "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
  if (mood === "mixed") return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

function getMoodLabel(mood: MarketMood): string {
  if (mood === "bullish") return "Tích cực";
  if (mood === "bearish") return "Tiêu cực";
  if (mood === "mixed") return "Phân hóa";
  return "Trung tính";
}

function getComparisonLabel(status: MarketNarrative["comparison"]["status"]): string {
  if (status === "improved") return "Tốt hơn snapshot trước";
  if (status === "weakened") return "Yếu hơn snapshot trước";
  return "Ít thay đổi";
}
