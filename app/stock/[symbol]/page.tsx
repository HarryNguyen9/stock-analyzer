import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CandlestickChart } from "@/components/CandlestickChart";
import { ScoreGauge } from "@/components/ScoreGauge";
import { STOCKS } from "@/data/symbols";
import { getHistoricalPricesResult } from "@/lib/data-source/prices";
import { getSymbolMetadata, readLatestTechnicalSnapshot } from "@/lib/data-source/supabase-provider";
import { createTechnicalSnapshot, debugTechnicalSnapshot } from "@/lib/data-source/technical-snapshot";
import { round } from "@/lib/indicators";
import { vi } from "@/lib/i18n/vi";
import { categoryLabelsVi, sortSignalsByPriority } from "@/lib/signals";
import type { Signal, SignalCategory } from "@/lib/technical-analysis";
import type { ScoreBreakdown } from "@/lib/technical-analysis/types";
import type { StockMetadata } from "@/types/stock";

type StockPageProps = {
  params: Promise<{ symbol: string }>;
};

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: StockPageProps): Promise<Metadata> {
  const symbol = normalizeSymbol((await params).symbol);
  const stock = await getStockMetadataForPage(symbol);

  return {
    title: stock ? `${stock.symbol} - ${vi.stock.technicalScore}` : vi.app.notFoundTitle,
  };
}

export default async function StockDetailPage({ params }: StockPageProps) {
  const symbol = normalizeSymbol((await params).symbol);
  const stock = await getStockMetadataForPage(symbol);

  if (!stock) {
    notFound();
  }

  // Supabase/API later: keep this call as the page data boundary. The app reads
  // local JSON only at request/build time and does not fetch market APIs in UI.
  const priceResult = await getHistoricalPricesResult(symbol);

  if (priceResult.status === "error") {
    return <InvalidDataState stock={stock} message={priceResult.error} />;
  }

  const candles = priceResult.data;
  const technicalRow = await readLatestTechnicalSnapshot(symbol);
  const technical = createTechnicalSnapshot(
    candles,
    technicalRow?.technical_score ?? null,
    technicalRow?.signals ?? null,
  );
  debugTechnicalSnapshot(symbol, "detail", technical);
  const analysis = technical.analysis;
  const signalGroups = groupTechnicalSignals(technical.signals);
  const latest = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  const change = latest.close - previous.close;
  const changePercent = round((change / previous.close) * 100);
  const isUp = change >= 0;

  return (
    <main className="min-h-screen pb-10">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-950">
            {vi.stock.backToWatchlist}
          </Link>

          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl font-semibold tracking-normal text-slate-950 sm:text-6xl">
                  {stock.symbol}
                </h1>
                <span className="rounded border border-slate-200 px-2 py-1 text-sm font-medium text-slate-500">
                  {stock.exchange}
                </span>
              </div>
              <p className="mt-3 text-lg text-slate-600">{stock.name}</p>
              <p className="mt-2 text-sm font-medium uppercase tracking-normal text-slate-400">
                {stock.sector}
              </p>
            </div>

            <div className="flex items-center gap-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <ScoreGauge score={technical.score} />
              <div>
                <p className="text-sm text-slate-500">{vi.stock.technicalScore}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">
                  {scoreLabel(technical.score)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <div className="min-w-0 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label={vi.stock.lastClose} value={latest.close.toFixed(2)} />
            <MetricCard
              label={vi.stock.dailyChange}
              value={`${isUp ? "+" : ""}${change.toFixed(2)}`}
              subValue={`${isUp ? "+" : ""}${changePercent.toFixed(2)}%`}
              tone={isUp ? "positive" : "negative"}
            />
            <MetricCard label={vi.stock.volume} value={formatVolume(latest.volume)} />
            <MetricCard label={vi.stock.latestDate} value={formatDate(latest.date)} />
            <MetricCard label={vi.stock.candles} value={String(candles.length)} />
          </div>

          <CandlestickChart data={candles} />

          <ScoreBreakdownSection breakdown={analysis.scoreBreakdown} />

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{vi.stock.technicalSignals}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {analysis.summaryVi ?? vi.stock.notAvailable}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {signalGroups.map((group) => (
                <div key={group.category} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-950">
                    {categoryLabelsVi[group.category]}
                  </h3>
                  <div className="mt-3 space-y-2">
                    {group.signals.length > 0 ? (
                      group.signals.map((signal) => (
                        <TechnicalSignalBadge key={signal.code} signal={signal} />
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">Chưa có tín hiệu nổi bật.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">{vi.stock.indicators}</h2>
            <dl className="mt-4 space-y-4">
              <IndicatorRow
                label={vi.stock.indicatorLabels.sma20}
                value={formatIndicator(analysis.indicators.sma20)}
              />
              <IndicatorRow
                label={vi.stock.indicatorLabels.sma50}
                value={formatIndicator(analysis.indicators.sma50)}
              />
              <IndicatorRow
                label={vi.stock.indicatorLabels.rsi14}
                value={formatIndicator(analysis.indicators.rsi14)}
              />
              <IndicatorRow
                label={vi.stock.indicatorLabels.volumeAverage20}
                value={
                  analysis.indicators.volumeAverage20
                    ? formatVolume(analysis.indicators.volumeAverage20)
                    : vi.stock.notAvailable
                }
              />
              <IndicatorRow
                label={vi.stock.dataStatus}
                value={
                  priceResult.source === "supabase"
                    ? vi.stock.supabase
                    : priceResult.source === "local-json"
                      ? vi.stock.localJson
                      : vi.stock.generatedFallback
                }
              />
            </dl>
          </section>

          <div className="grid gap-4">
            {technical.signals.slice(0, 3).map((signal) => (
              <TechnicalSignalBadge key={signal.code} signal={signal} />
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}

function ScoreBreakdownSection({ breakdown }: { breakdown: ScoreBreakdown }) {
  const items = [
    {
      key: "trend",
      score: breakdown.trend,
      max: 30,
      label: vi.stock.scoreBreakdownItems.trend.label,
      description: vi.stock.scoreBreakdownItems.trend.description,
    },
    {
      key: "momentum",
      score: breakdown.momentum,
      max: 25,
      label: vi.stock.scoreBreakdownItems.momentum.label,
      description: vi.stock.scoreBreakdownItems.momentum.description,
    },
    {
      key: "volume",
      score: breakdown.volume,
      max: 20,
      label: vi.stock.scoreBreakdownItems.volume.label,
      description: vi.stock.scoreBreakdownItems.volume.description,
    },
    {
      key: "volatilityBreakout",
      score: breakdown.volatilityBreakout,
      max: 15,
      label: vi.stock.scoreBreakdownItems.volatilityBreakout.label,
      description: vi.stock.scoreBreakdownItems.volatilityBreakout.description,
    },
    {
      key: "risk",
      score: breakdown.risk,
      max: 10,
      label: vi.stock.scoreBreakdownItems.risk.label,
      description: vi.stock.scoreBreakdownItems.risk.description,
    },
  ] as const;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{vi.stock.scoreBreakdown}</h2>
      <div className="mt-4 space-y-4">
        {items.map((item) => (
          <div key={item.key}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                <p className="mt-1 text-sm leading-5 text-slate-500">{item.description}</p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-950">
                {item.score}/{item.max}
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-slate-950"
                style={{ width: `${Math.max(0, Math.min(100, (item.score / item.max) * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function groupTechnicalSignals(signals: Signal[]): Array<{ category: SignalCategory; signals: Signal[] }> {
  const categories: SignalCategory[] = ["trend", "momentum", "volume", "volatility", "risk"];
  const sortedSignals = sortSignalsByPriority(signals);

  return categories.map((category) => ({
    category,
    signals: sortedSignals
      .filter((signal) => signal.category === category || (category === "volatility" && signal.category === "breakout"))
      .slice(0, 3),
  }));
}

function TechnicalSignalBadge({ signal }: { signal: Signal }) {
  const toneClass =
    signal.sentiment === "bullish"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : signal.sentiment === "bearish"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-slate-200 bg-white text-slate-700";

  return (
    <details className={`group rounded-lg border p-3 ${toneClass}`}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{signal.labelVi}</p>
          <p className="mt-1 text-sm leading-5 opacity-80">{signal.descriptionVi}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium">
            {signal.strength}/5
          </span>
          <span className="text-xs font-medium opacity-70 group-open:hidden">
            {vi.stock.signalDetailToggle}
          </span>
        </div>
      </summary>

      <div className="mt-3 space-y-3 border-t border-current/10 pt-3 text-sm leading-5">
        <div>
          <p className="font-semibold opacity-90">{vi.stock.signalExplanation}</p>
          <p className="mt-1 opacity-80">{signal.explanationVi}</p>
        </div>
        <div>
          <p className="font-semibold opacity-90">{vi.stock.signalImplication}</p>
          <p className="mt-1 opacity-80">{signal.implicationVi}</p>
        </div>
      </div>
    </details>
  );
}

function InvalidDataState({ stock, message }: { stock: { symbol: string; name: string }; message: string }) {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
          <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-950">
            {vi.stock.backToWatchlist}
          </Link>
          <h1 className="mt-6 text-4xl font-semibold text-slate-950">{stock.symbol}</h1>
          <p className="mt-2 text-slate-600">{stock.name}</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm">
          <h2 className="text-lg font-semibold">{vi.stock.invalidDataTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900">{vi.stock.invalidDataDescription}</p>
          <p className="mt-4 rounded border border-amber-200 bg-white/70 p-3 text-sm text-amber-900">
            {message}
          </p>
        </div>
      </section>
    </main>
  );
}

async function getStockMetadataForPage(symbol: string): Promise<StockMetadata | null> {
  const supabaseStock = await getSymbolMetadata(symbol);

  if (supabaseStock) {
    return supabaseStock;
  }

  return STOCKS.find((item) => item.symbol === symbol) ?? null;
}

function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase();
}

function MetricCard({
  label,
  value,
  subValue,
  tone = "neutral",
}: {
  label: string;
  value: string;
  subValue?: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  const color =
    tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-rose-600" : "text-slate-950";

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-xl font-semibold tabular-nums ${color}`}>{value}</p>
      {subValue ? <p className={`mt-1 text-sm font-medium ${color}`}>{subValue}</p> : null}
    </article>
  );
}

function IndicatorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-slate-950">{value}</dd>
    </div>
  );
}

function formatIndicator(value: number | null): string {
  return value === null ? vi.stock.notAvailable : value.toFixed(2);
}

function formatVolume(value: number): string {
  if (value >= 1_000_000) {
    return `${round(value / 1_000_000, 2)}${vi.format.million}`;
  }

  return `${round(value / 1_000, 1)}${vi.format.thousand}`;
}

function formatDate(value: string): string {
  return value.split("-").reverse().join("/");
}

function scoreLabel(score: number): string {
  if (score >= 70) return vi.score.constructive;
  if (score >= 45) return vi.score.neutral;
  return vi.score.weak;
}
