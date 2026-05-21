import Link from "next/link";
import type { MarketAlert, MarketAlertGroup, MarketAlertSeverity } from "@/lib/pipeline/snapshot";

export function MarketAlerts({ alerts }: { alerts: MarketAlert[] }) {
  const topAlerts = alerts.slice(0, 8);
  const groups = groupAlerts(topAlerts);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className="animate-fade-in rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 sm:p-5">
        <SectionHeader count={topAlerts.length} />

        {topAlerts.length > 0 ? (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.id}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{getGroupLabel(group.id)}</h3>
                  <span className="text-xs text-slate-400 dark:text-slate-500">{group.items.length}</span>
                </div>
                <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
                  {group.items.map((alert, index) => (
                    <AlertCard key={alert.dedupeKey} alert={alert} index={index} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
            Chưa có đủ tín hiệu chất lượng cao.
          </div>
        )}
      </div>
    </section>
  );
}

function SectionHeader({ count }: { count: number }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Tín hiệu nổi bật</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Các chuyển động đáng chú ý được lọc từ điểm kỹ thuật, thanh khoản, ngành và độ rộng thị trường.
        </p>
      </div>
      <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400 sm:inline-flex">
        {count} tín hiệu
      </span>
    </div>
  );
}

function AlertCard({ alert, index }: { alert: MarketAlert; index: number }) {
  const content = (
    <div
      className={`h-full min-h-40 w-72 shrink-0 snap-start rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${getToneClass(alert.severity)}`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getBadgeClass(alert.severity)}`}>
          {getSeverityLabel(alert.severity)}
        </span>
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{formatTime(alert.created_at)}</span>
      </div>

      <div className="mt-4">
        <h3 className="line-clamp-2 text-base font-semibold text-slate-950 dark:text-white">{alert.title}</h3>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{alert.description}</p>
      </div>

      {alert.symbol || alert.sector ? (
        <p className="mt-4 text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
          {alert.symbol ?? alert.sector}
        </p>
      ) : null}
    </div>
  );

  if (alert.symbol) {
    return (
      <Link href={`/stock/${alert.symbol}`} prefetch={false} className="block shrink-0">
        {content}
      </Link>
    );
  }

  return content;
}

function groupAlerts(alerts: MarketAlert[]): Array<{ id: MarketAlertGroup; items: MarketAlert[] }> {
  const order: MarketAlertGroup[] = ["market", "sector", "symbol"];

  return order
    .map((id) => ({
      id,
      items: alerts.filter((alert) => (alert.group ?? getFallbackGroup(alert)) === id),
    }))
    .filter((group) => group.items.length > 0);
}

function getFallbackGroup(alert: MarketAlert): MarketAlertGroup {
  if (alert.symbol) return "symbol";
  if (alert.sector) return "sector";
  return "market";
}

function getGroupLabel(group: MarketAlertGroup): string {
  if (group === "market") return "Market";
  if (group === "sector") return "Sector";
  return "Symbol";
}

function getToneClass(severity: MarketAlertSeverity): string {
  if (severity === "bullish") {
    return "border-emerald-200 bg-emerald-50/80 hover:border-emerald-300 dark:border-emerald-950 dark:bg-emerald-950/30";
  }

  if (severity === "bearish") {
    return "border-rose-200 bg-rose-50/80 hover:border-rose-300 dark:border-rose-950 dark:bg-rose-950/25";
  }

  if (severity === "warning") {
    return "border-amber-200 bg-amber-50/80 hover:border-amber-300 dark:border-amber-950 dark:bg-amber-950/25";
  }

  return "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700";
}

function getBadgeClass(severity: MarketAlertSeverity): string {
  if (severity === "bullish") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (severity === "bearish") return "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
  if (severity === "warning") return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

function getSeverityLabel(severity: MarketAlertSeverity): string {
  if (severity === "bullish") return "Tích cực";
  if (severity === "bearish") return "Rủi ro";
  if (severity === "warning") return "Cảnh báo";
  return "Theo dõi";
}

function formatTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}
