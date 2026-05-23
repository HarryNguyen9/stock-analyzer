import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminTriggerSyncButton } from "@/components/AdminTriggerSyncButton";
import {
  getDataQualitySnapshot,
  isAdminToolsEnabled,
  type DataQualityJob,
} from "@/lib/admin/data-quality";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Data Quality - StockVN Admin",
};

export default async function DataQualityPage() {
  if (!isAdminToolsEnabled()) {
    notFound();
  }

  const data = await getDataQualitySnapshot();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-emerald-700 dark:text-emerald-400">
              Admin
            </p>
             <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">Chất lượng dữ liệu</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Cập nhật lúc {formatDateTime(data.generatedAt)}
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            Về dashboard
          </Link>
        </header>

        <AdminTriggerSyncButton />

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QualityCard label="Tổng mã" value={data.totalSymbols} tone="good" />
          <QualityCard label="Mã đang hoạt động" value={data.activeSymbols} tone="good" />
          <QualityCard label="Mã ngừng hoạt động" value={data.inactiveSymbols} tone={data.inactiveSymbols > 0 ? "warning" : "good"} />
          <QualityCard label="Ngừng/không hỗ trợ" value={data.inactiveUnsupportedSymbols} tone={data.inactiveUnsupportedSymbols > 0 ? "warning" : "good"} />
          <QualityCard label="Chưa có giá" value={data.symbolsWithNoPriceData} tone={data.symbolsWithNoPriceData > 0 ? "warning" : "good"} />
          <QualityCard label="Dưới 20 nến" value={data.symbolsWithLessThan20Candles} tone={data.symbolsWithLessThan20Candles > 0 ? "warning" : "good"} />
          <QualityCard label="Từ 20 nến trở lên" value={data.symbolsWithAtLeast20Candles} tone="good" />
          <QualityCard label="Mã lỗi" value={data.failedSymbols} tone={data.failedSymbols > 0 ? "danger" : "good"} />
          <QualityCard label="Mã không hỗ trợ" value={data.unsupportedSymbols} tone={data.unsupportedSymbols > 0 ? "warning" : "good"} />
          <QualityCard
            label="Ảnh chụp mới nhất"
            value={data.latestSnapshotUpdatedAt ? formatDateTime(data.latestSnapshotUpdatedAt) : "Chưa có"}
            tone={data.latestSnapshotUpdatedAt ? "good" : "warning"}
          />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Tác vụ đồng bộ gần đây</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <JobCard title="sync-prices" job={data.latestJobs.syncPrices} />
            <JobCard title="backfill-missing-prices" job={data.latestJobs.backfillMissingPrices} />
            <JobCard title="refresh-universe" job={data.latestJobs.refreshUniverse} />
            <JobCard title="sync-symbol-metadata" job={data.latestJobs.syncSymbolMetadata} />
          </div>
        </section>
      </div>
    </main>
  );
}

function QualityCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "good" | "warning" | "danger";
}) {
  return (
    <article className={`rounded-lg border p-4 shadow-sm ${getToneClass(tone)}`}>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 break-words text-2xl font-semibold tabular-nums text-slate-950 dark:text-white">{value}</p>
    </article>
  );
}

function JobCard({ title, job }: { title: string; job: DataQualityJob | null }) {
  if (!job) {
    return (
      <article className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
        <h3 className="font-semibold text-slate-950 dark:text-white">{title}</h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Chưa có job gần đây.</p>
      </article>
    );
  }

  const tone = job.status === "success" ? "good" : job.status === "running" ? "warning" : "danger";

  return (
    <article className={`rounded-lg border p-4 ${getToneClass(tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-slate-950 dark:text-white">{title}</h3>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-950/60 dark:text-slate-200">
          {job.status === "success" ? "Thành công" : job.status === "running" ? "Đang chạy" : "Thất bại"}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <JobMetric label="Đã chọn" value={job.selectedCount} />
        <JobMetric label="Thành công" value={job.successCount} />
        <JobMetric label="Thất bại" value={job.failedCount} />
      </dl>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        {job.finishedAt ? formatDateTime(job.finishedAt) : job.startedAt ? formatDateTime(job.startedAt) : "Không rõ thời gian"}
        {job.durationMs ? ` · ${Math.round(job.durationMs / 1000)}s` : ""}
      </p>
      {job.errorMessage ? (
        <p className="mt-2 line-clamp-2 text-sm text-rose-700 dark:text-rose-300">{job.errorMessage}</p>
      ) : null}
    </article>
  );
}

function JobMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/70 p-2 dark:bg-slate-950/50">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 font-semibold tabular-nums text-slate-950 dark:text-white">{value}</dd>
    </div>
  );
}

function getToneClass(tone: "good" | "warning" | "danger"): string {
  if (tone === "good") {
    return "border-emerald-200 bg-emerald-50/70 dark:border-emerald-950 dark:bg-emerald-950/25";
  }

  if (tone === "warning") {
    return "border-amber-200 bg-amber-50/70 dark:border-amber-950 dark:bg-amber-950/25";
  }

  return "border-rose-200 bg-rose-50/70 dark:border-rose-950 dark:bg-rose-950/25";
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}
