import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  CwContractTab,
  CwOverviewTab,
  CwPricingTab,
  CwRiskTab,
  formatPercent,
  formatPrice,
  formatVolume,
} from "@/components/cw/CwDetailCards";
import { CwDetailTabs } from "@/components/cw/CwDetailTabs";
import { getCoveredWarrantBySymbol } from "@/lib/cw/cw-provider";
import type { CoveredWarrantWithMetrics } from "@/lib/cw/types";

type CwPageProps = {
  params: Promise<{ symbol: string }>;
};

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: CwPageProps): Promise<Metadata> {
  const symbol = normalizeSymbol((await params).symbol);

  return {
    title: `${symbol} - Chi tiết chứng quyền`,
    description: `Thông tin chi tiết chứng quyền ${symbol}.`,
  };
}

export default async function CoveredWarrantDetailPage({ params }: CwPageProps) {
  const symbol = normalizeSymbol((await params).symbol);
  const result = await getCoveredWarrantBySymbol(symbol);

  if (!result.warrant) {
    return <CwEmptyState symbol={symbol} message={result.message ?? "Không tìm thấy mã chứng quyền này."} />;
  }

  const warrant = result.warrant;
  const changePercent = warrant.changePercent ?? 0;
  const isUp = changePercent >= 0;

  return (
    <main className="min-h-screen bg-[#071126] pb-10 text-slate-100">
      <div className="sticky top-0 z-50 border-b border-cyan-300/10 bg-[#071126]/88 shadow-[0_10px_32px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-colors">
        <div className="mx-auto flex min-h-14 w-full max-w-7xl items-center justify-between gap-2 px-2 sm:gap-3 sm:px-6 lg:px-8">
          <CwBackLink />
          <div className="min-w-0 flex-1 px-1 text-center">
            <div className="flex min-w-0 items-center justify-center gap-2">
              <p className="truncate text-base font-black tracking-normal text-white sm:text-lg">{warrant.symbol}</p>
              <span className="rounded-lg border border-cyan-300/20 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-cyan-100">
                {formatTypeBadge(warrant.type)}
              </span>
            </div>
            <p className="mx-auto mt-0.5 max-w-[190px] truncate text-xs text-slate-400 sm:hidden">
              Covered warrant theo {warrant.underlyingSymbol}
            </p>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <section className="border-b border-cyan-300/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_34%),linear-gradient(180deg,#08152d,#071126)]">
        <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
          <CwHero warrant={warrant} source={result.source} updatedAt={result.updatedAt} />
        </div>
      </section>

      <CwDetailTabs
        overview={<CwOverviewTab warrant={warrant} />}
        contract={<CwContractTab warrant={warrant} />}
        pricing={<CwPricingTab warrant={warrant} related={result.related} />}
        risk={<CwRiskTab warrant={warrant} />}
      />
    </main>
  );
}

function CwHero({
  warrant,
  source,
  updatedAt,
}: {
  warrant: CoveredWarrantWithMetrics;
  source: string;
  updatedAt: string | null;
}) {
  const changePercent = warrant.changePercent ?? 0;
  const isUp = changePercent >= 0;

  return (
    <div className="grid gap-4 rounded-2xl border border-cyan-300/10 bg-white/[0.03] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)] ring-1 ring-white/5 lg:grid-cols-[1fr_auto] lg:items-center lg:p-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-4xl font-black tracking-normal text-white sm:text-5xl">{warrant.symbol}</h1>
          <span className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs font-bold text-cyan-100">
            {formatTypeBadge(warrant.type)}
          </span>
          {warrant.issuer ? (
            <span className="rounded-xl border border-slate-500/20 bg-white/5 px-2.5 py-1 text-xs font-bold text-slate-200">
              {warrant.issuer}
            </span>
          ) : null}
          <Link
            href="/?product=covered-warrants"
            className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs font-bold text-emerald-100"
          >
            {warrant.underlyingSymbol}
          </Link>
        </div>
        <p className="mt-2 text-sm text-slate-300 sm:text-base">Covered warrant theo {warrant.underlyingSymbol}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-normal text-slate-500">
          Nguồn: {formatSource(source, warrant.source)}{updatedAt ? ` · ${formatDateTime(updatedAt)}` : ""}
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-cyan-300/10 bg-[#030816]/70 p-4 min-[390px]:grid-cols-2 lg:min-w-[430px]">
        <HeaderStat label="Giá CW" value={formatPrice(warrant.lastPrice)} />
        <HeaderStat
          label="Biến động"
          value={formatPercent(warrant.changePercent)}
          tone={isUp ? "positive" : "negative"}
        />
        <HeaderStat label="Premium" value={formatPercent(warrant.metrics.premiumPercent)} />
        <HeaderStat label="Hòa vốn" value={formatPrice(warrant.metrics.breakEvenPrice)} />
      </div>
    </div>
  );
}

function HeaderStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-300"
      : tone === "negative"
        ? "text-rose-300"
        : "text-white";

  return (
    <div className="rounded-2xl border border-cyan-300/10 bg-[#061326] p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 truncate text-xl font-black tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function CwEmptyState({ symbol, message }: { symbol: string; message: string }) {
  return (
    <main className="min-h-screen bg-[#071126] text-slate-100">
      <div className="sticky top-0 z-50 border-b border-cyan-300/10 bg-[#071126]/88 backdrop-blur-xl">
        <div className="mx-auto flex min-h-14 w-full max-w-4xl items-center justify-between gap-3 px-3 sm:px-6">
          <CwBackLink />
          <ThemeToggle />
        </div>
      </div>
      <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <div className="rounded-2xl border border-dashed border-cyan-300/20 bg-[#09152c] p-6 text-center">
          <p className="text-lg font-black text-white">Không tìm thấy {symbol}</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">{message}</p>
          <Link
            href="/?product=covered-warrants"
            className="mt-5 inline-flex min-h-11 items-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-5 text-sm font-bold text-cyan-100"
          >
            Quay lại Chứng quyền
          </Link>
        </div>
      </section>
    </main>
  );
}

function CwBackLink() {
  return (
    <Link
      href="/?product=covered-warrants"
      aria-label="Về danh sách"
      className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-cyan-300/10 bg-white/5 px-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/30 hover:bg-cyan-300/10"
    >
      <span aria-hidden="true" className="text-lg leading-none">
        ←
      </span>
      <span className="hidden sm:inline">Về danh sách</span>
    </Link>
  );
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function formatTypeBadge(type: string | null): string {
  return type ? type.toUpperCase() : "CW";
}

function formatSource(source: string, rowSource: string | null): string {
  const value = rowSource ?? source;
  return value === "24hmoney" ? "24HMoney / Supabase" : value;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
