import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AiAnalysisModal } from "@/components/AiAnalysisModal";
import { BackButton } from "@/components/BackButton";
import { CandlestickChart } from "@/components/CandlestickChart";
import { ScoreGauge } from "@/components/ScoreGauge";
import { StockDetailTabs } from "@/components/StockDetailTabs";
import { SymbolRefreshPanel } from "@/components/SymbolRefreshPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getSymbolFreshness } from "@/lib/data-source/symbol-freshness";
import { createTechnicalSnapshot } from "@/lib/data-source/technical-snapshot";
import { getHistoricalPricesResult } from "@/lib/data-source/prices";
import { getSymbolDataState, getSymbolMetadata, readLatestTechnicalScore } from "@/lib/data-source/supabase-provider";
import { isSupabaseClientConfigured } from "@/lib/supabase/client";
import { STOCKS } from "@/data/symbols";
import { round } from "@/lib/indicators";
import { vi } from "@/lib/i18n/vi";
import { categoryLabelsVi } from "@/lib/signals";
import type { MethodSummary, PriceActionCore, PriceBehaviorAnalysis, Signal, SignalCategory, TechnicalThesis } from "@/lib/technical-analysis";
import { getSetupLabel, getTrendBiasLabel } from "@/lib/technical-analysis/thesis";
import { getConfidenceLabel, getWyckoffPhaseLabel } from "@/lib/technical-analysis/wyckoff-lite";
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
  const [priceResult, freshness, symbolState] = await Promise.all([
    getHistoricalPricesResult(symbol),
    getSymbolFreshness(symbol),
    getSymbolDataState(symbol),
  ]);

  if (priceResult.status === "error") {
    return <InvalidDataState stock={stock} message={priceResult.error} symbolState={symbolState} freshness={freshness} />;
  }

  const candles = priceResult.data;

  if (candles.length < 20) {
    return (
      <InvalidDataState
        stock={stock}
        message="Chưa có đủ dữ liệu để phân tích."
        symbolState={symbolState}
        freshness={freshness}
      />
    );
  }

  const supabaseScore = await readLatestTechnicalScore(symbol);
  const technicalSnapshot = createTechnicalSnapshot(candles, supabaseScore);
  const analysis = technicalSnapshot.analysis;
  const displayScore = technicalSnapshot.score;
  const displayStatus = technicalSnapshot.status;
  const signalGroups = groupTechnicalSignals(technicalSnapshot.signals);
  const latest = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  const change = latest.close - previous.close;
  const changePercent = round((change / previous.close) * 100);
  const isUp = change >= 0;

  return (
    <main className="min-h-screen pb-10">
      <div className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur-md transition-colors dark:border-slate-800/80 dark:bg-slate-950/85">          <div className="mx-auto flex min-h-14 w-full max-w-7xl items-center justify-between gap-3 px-3 sm:px-6 lg:px-8">
        <BackButton label={vi.stock.backToWatchlist} />
          <div className="min-w-0 flex-1 text-center">
            <div className="flex items-center justify-center gap-2">
              <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{stock.symbol}</p>
              <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {stock.exchange}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400 sm:hidden">{stock.name}</p>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl font-semibold tracking-normal text-slate-950 dark:text-white sm:text-6xl">
                  {stock.symbol}
                </h1>
                <span className="rounded border border-slate-200 px-2 py-1 text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  {stock.exchange}
                </span>
              </div>
              <p className="mt-3 text-lg text-slate-600 dark:text-slate-300">{stock.name}</p>
              <p className="mt-2 text-sm font-medium uppercase tracking-normal text-slate-400 dark:text-slate-500">
                {stock.sector}
              </p>
            </div>

            <div className="flex items-center gap-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <ScoreGauge score={displayScore} />
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{vi.stock.technicalScore}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                  {displayStatus}
                </p>
              </div>
            </div>
          </div>

          <SymbolRefreshPanel symbol={stock.symbol} freshness={freshness} />
        </div>
      </section>

      <StockDetailTabs
        overview={
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

          <TechnicalThesisSection thesis={analysis.thesis} />
          <QuickSignalsSection signalGroups={signalGroups} summary={analysis.summaryVi ?? vi.stock.notAvailable} />
        </div>
        }
        priceAction={
        <div className="space-y-5">
          <PriceActionSection analysis={analysis.priceAction} />

          <WyckoffLiteSection analysis={analysis.priceBehavior} />
        </div>
        }
        indicators={
        <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-5 lg:space-y-0">
          <AdvancedTechnicalSection summaries={analysis.methodSummaries} />

          <section className="hidden rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{vi.stock.technicalSignals}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  {analysis.summaryVi ?? vi.stock.notAvailable}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {signalGroups.map((group) => (
                <div key={group.category} className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                    {categoryLabelsVi[group.category]}
                  </h3>
                  <div className="mt-3 space-y-2">
                    {group.signals.length > 0 ? (
                      group.signals.map((signal) => (
                        <TechnicalSignalBadge key={signal.code} signal={signal} />
                      ))
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có tín hiệu nổi bật.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{vi.stock.indicators}</h2>
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
                label="EMA20"
                value={formatIndicator(analysis.indicators.ema20)}
              />
              <IndicatorRow
                label="EMA50"
                value={formatIndicator(analysis.indicators.ema50)}
              />
              <IndicatorRow
                label="EMA200"
                value={formatIndicator(analysis.indicators.ema200)}
              />
              <IndicatorRow
                label={vi.stock.indicatorLabels.rsi14}
                value={formatIndicator(analysis.indicators.rsi14)}
              />
              <IndicatorRow
                label="MACD hist"
                value={formatIndicator(analysis.indicators.macd.histogram)}
              />
              <IndicatorRow
                label="ATR14"
                value={formatIndicator(analysis.indicators.atr14)}
              />
              <IndicatorRow
                label="ADX14"
                value={formatIndicator(analysis.indicators.adx14)}
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
            {analysis.signals.slice(0, 3).map((signal) => (
              <TechnicalSignalBadge key={signal.code} signal={signal} />
            ))}
          </div>
        </aside>
        </div>
        }
        patterns={<CandlestickPatternsSection analysis={analysis.priceBehavior} />}
        aiAnalysis={
          <AiAnalysisSection
            stock={stock}
            latestPrice={latest.close.toFixed(2)}
            changePercent={`${isUp ? "+" : ""}${changePercent.toFixed(2)}%`}
            score={displayScore}
            scoreSource={technicalSnapshot.scoreSource}
            sentimentLabel={displayStatus}
          />
        }
      />
    </main>
  );
}

function groupTechnicalSignals(signals: Signal[]): Array<{ category: SignalCategory; signals: Signal[] }> {
  const categories: SignalCategory[] = ["trend", "momentum", "volume", "volatility", "risk"];

  return categories.map((category) => ({
    category,
    signals: signals
      .filter((signal) => signal.category === category || (category === "volatility" && signal.category === "breakout"))
      .slice(0, 3),
  }));
}

function QuickSignalsSection({
  signalGroups,
  summary,
}: {
  signalGroups: Array<{ category: SignalCategory; signals: Signal[] }>;
  summary: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{vi.stock.technicalSignals}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{summary}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {signalGroups.map((group) => (
          <div key={group.category} className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
              {categoryLabelsVi[group.category]}
            </h3>
            <div className="mt-3 space-y-2">
              {group.signals.length > 0 ? (
                group.signals.map((signal) => (
                  <TechnicalSignalBadge key={signal.code} signal={signal} />
                ))
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có tín hiệu nổi bật.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
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
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{vi.stock.scoreBreakdown}</h2>
      <div className="mt-4 space-y-4">
        {items.map((item) => (
          <div key={item.key}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-950 dark:text-white">{item.label}</p>
                <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{item.description}</p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-950 dark:text-white">
                {item.score}/{item.max}
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-slate-950 dark:bg-slate-100"
                style={{ width: `${Math.max(0, Math.min(100, (item.score / item.max) * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TechnicalThesisSection({ thesis }: { thesis: TechnicalThesis }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Luận điểm kỹ thuật</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Tóm tắt setup hiện tại theo dữ liệu kỹ thuật, không phải khuyến nghị mua/bán.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {getSetupLabel(thesis.setupType)}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getThesisBiasClass(thesis.trendBias)}`}>
            {getTrendBiasLabel(thesis.trendBias)}
          </span>
        </div>
      </div>

      <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:bg-slate-950 dark:text-slate-300">
        {thesis.shortSummaryVi}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <ThesisMetric label="Hỗ trợ chính" value={formatThesisLevel(thesis.keySupport)} />
        <ThesisMetric label="Kháng cự chính" value={formatThesisLevel(thesis.keyResistance)} />
        <ThesisMetric label="Mốc vô hiệu" value={formatThesisLevel(thesis.invalidationLevel)} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <ThesisList title="Điều kiện cải thiện" items={thesis.conditionsToImprove} />
        <ThesisList title="Rủi ro cần chú ý" items={thesis.keyRisks} />
      </div>
    </section>
  );
}

function ThesisMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function ThesisList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="text-sm leading-5 text-slate-600 dark:text-slate-400">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function getThesisBiasClass(trendBias: TechnicalThesis["trendBias"]): string {
  if (trendBias === "bullish") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  }

  if (trendBias === "bearish") {
    return "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
  }

  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
}

function formatThesisLevel(value: number | null): string {
  return value === null ? vi.stock.notAvailable : value.toFixed(2);
}

function PriceActionSection({ analysis }: { analysis: PriceActionCore }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Price Action</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Đọc cấu trúc giá, đa khung thời gian và chất lượng xu hướng từ dữ liệu nến hiện có.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <article className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Cấu trúc giá</h3>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getBehaviorSentimentClass(analysis.marketStructure.shortTermBias)}`}>
              {getBehaviorSentimentLabel(analysis.marketStructure.shortTermBias)}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {analysis.marketStructure.summaryVi}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MiniData label="Dạng" value={getStructureTypeLabel(analysis.marketStructure.structureType)} />
            <MiniData label="Phá vỡ" value={getBreakTypeLabel(analysis.marketStructure.lastBreakType)} />
            <MiniData label="Swing high" value={formatPriceActionLevel(analysis.marketStructure.keySwingHigh)} />
            <MiniData label="Swing low" value={formatPriceActionLevel(analysis.marketStructure.keySwingLow)} />
          </div>
        </article>

        <article className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Đa khung thời gian</h3>
            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              {getAlignmentLabel(analysis.multiTimeframe.alignment)}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {analysis.multiTimeframe.summaryVi}
          </p>
          <div className="mt-3 grid gap-2">
            <MiniData label="20 phiên" value={getTimeframeTrendLabel(analysis.multiTimeframe.shortTermTrend)} />
            <MiniData label="50 phiên" value={getTimeframeTrendLabel(analysis.multiTimeframe.midTermTrend)} />
            <MiniData label="200 phiên" value={getTimeframeTrendLabel(analysis.multiTimeframe.longTermTrend)} />
          </div>
        </article>

        <article className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Chất lượng xu hướng</h3>
            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              {analysis.trendQuality.score}/100
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {analysis.trendQuality.summaryVi}
          </p>
          <div className="mt-3 rounded-lg bg-white p-3 dark:bg-slate-900">
            <p className="text-sm font-semibold text-slate-950 dark:text-white">
              {getTrendQualityLabel(analysis.trendQuality.quality)}
            </p>
            <ul className="mt-2 space-y-1.5">
              {analysis.trendQuality.reasons.slice(0, 3).map((reason) => (
                <li key={reason} className="text-sm leading-5 text-slate-600 dark:text-slate-300">
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        </article>
      </div>
    </section>
  );
}

function MiniData({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-2 dark:bg-slate-900">
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function getStructureTypeLabel(value: PriceActionCore["marketStructure"]["structureType"]): string {
  if (value === "uptrend") return "Tăng";
  if (value === "downtrend") return "Giảm";
  if (value === "range") return "Đi ngang";
  if (value === "transition") return "Chuyển pha";
  return "Chưa rõ";
}

function getBreakTypeLabel(value: PriceActionCore["marketStructure"]["lastBreakType"]): string {
  if (value === "breakout") return "Breakout";
  if (value === "breakdown") return "Breakdown";
  return "Chưa có";
}

function getTimeframeTrendLabel(value: PriceActionCore["multiTimeframe"]["shortTermTrend"]): string {
  if (value === "bullish") return "Tích cực";
  if (value === "bearish") return "Yếu";
  if (value === "neutral") return "Trung lập";
  return "Thiếu dữ liệu";
}

function getAlignmentLabel(value: PriceActionCore["multiTimeframe"]["alignment"]): string {
  if (value === "aligned_bullish") return "Đồng thuận tăng";
  if (value === "aligned_bearish") return "Đồng thuận yếu";
  return "Pha trộn";
}

function getTrendQualityLabel(value: PriceActionCore["trendQuality"]["quality"]): string {
  if (value === "clean") return "Xu hướng sạch";
  if (value === "volatile") return "Biến động cao";
  if (value === "choppy") return "Còn nhiễu";
  return "Yếu";
}

function formatPriceActionLevel(value: number | null): string {
  return value === null ? vi.stock.notAvailable : value.toFixed(2);
}

function CandlestickPatternsSection({ analysis }: { analysis: PriceBehaviorAnalysis }) {
  const highlightedPatterns = analysis.candlestickPatterns.filter((pattern) => pattern.confidence !== "low");
  const watchPatterns = analysis.candlestickPatterns.filter((pattern) => pattern.confidence === "low");
  const reversalPatterns = highlightedPatterns.filter((pattern) => pattern.type === "reversal");
  const continuationPatterns = highlightedPatterns.filter((pattern) => pattern.type === "continuation");
  const indecisionPatterns = highlightedPatterns.filter((pattern) => pattern.type === "indecision");

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Patterns</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Mẫu nến Nhật trong 5-10 nến gần nhất, có xét bối cảnh xu hướng, volume và vùng giá.
        </p>
      </div>

      {highlightedPatterns.length > 0 ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <PatternGroup title="Đảo chiều" patterns={reversalPatterns} />
          <PatternGroup title="Tiếp diễn" patterns={continuationPatterns} />
          <PatternGroup title="Do dự" patterns={indecisionPatterns} />
        </div>
      ) : (
        <div className="mt-5">
          <p className="rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            Chưa có mẫu đảo chiều/xác nhận mạnh trong các phiên gần đây.
          </p>
        </div>
      )}

      {watchPatterns.length > 0 ? (
        <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Theo dõi thêm</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {watchPatterns.map((pattern) => (
              <PatternCard key={`${pattern.pattern}-${pattern.dojiType ?? "base"}-${pattern.detectedAt}`} pattern={pattern} compact />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PatternGroup({ title, patterns }: { title: string; patterns: PriceBehaviorAnalysis["candlestickPatterns"] }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h3>
      <div className="mt-3 space-y-3">
        {patterns.length > 0 ? (
          patterns.map((pattern) => (
            <PatternCard key={`${pattern.pattern}-${pattern.dojiType ?? "base"}-${pattern.detectedAt}`} pattern={pattern} />
          ))
        ) : (
          <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">Chưa có tín hiệu rõ.</p>
        )}
      </div>
    </div>
  );
}

function PatternCard({
  pattern,
  compact = false,
}: {
  pattern: PriceBehaviorAnalysis["candlestickPatterns"][number];
  compact?: boolean;
}) {
  return (
    <article className="rounded-lg bg-white p-3 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-950 dark:text-white">{pattern.labelVi}</h4>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {formatDate(pattern.detectedAt)} · {getConfidenceLabel(pattern.confidence)}
          </p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getBehaviorSentimentClass(pattern.sentiment)}`}>
          {getBehaviorSentimentLabel(pattern.sentiment)}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
        {pattern.summaryVi ?? pattern.descriptionVi}
      </p>
      {!compact && pattern.contextNotes && pattern.contextNotes.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {pattern.contextNotes.slice(0, 3).map((note) => (
            <li key={note} className="text-sm leading-5 text-slate-500 dark:text-slate-400">
              {note}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function WyckoffLiteSection({ analysis }: { analysis: PriceBehaviorAnalysis }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Wyckoff-lite</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Đọc hành vi giá theo pha thị trường, dùng wording thận trọng và không kết luận chắc chắn.
          </p>
        </div>
        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {getConfidenceLabel(analysis.wyckoffLite.confidence)}
        </span>
      </div>

      <div className="mt-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
        <p className="text-sm font-semibold text-slate-950 dark:text-white">
          Nghiêng về: {getWyckoffPhaseLabel(analysis.wyckoffLite.phaseGuess)}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {analysis.wyckoffLite.summaryVi}
        </p>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <BehaviorList title="Bằng chứng" items={analysis.wyckoffLite.evidence} />
        <BehaviorList title="Điểm vô hiệu / cần kiểm tra" items={analysis.wyckoffLite.invalidationNotes} />
      </div>
    </section>
  );
}

function AiAnalysisSection({
  stock,
  latestPrice,
  changePercent,
  score,
  scoreSource,
  sentimentLabel,
}: {
  stock: StockMetadata;
  latestPrice: string;
  changePercent: string;
  score: number;
  scoreSource: "supabase" | "runtime";
  sentimentLabel: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">AI Analysis</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Mở bảng AI để diễn giải thesis, price action, indicators và rủi ro theo dữ liệu hiện tại.
          </p>
        </div>
        <AiAnalysisModal
          symbol={stock.symbol}
          companyName={stock.name}
          latestPrice={latestPrice}
          changePercent={changePercent}
          score={score}
          scoreSource={scoreSource}
          sentimentLabel={sentimentLabel}
        />
      </div>
      <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
        Phân tích AI chỉ mang tính tham khảo kỹ thuật, không phải khuyến nghị mua/bán.
      </p>
    </section>
  );
}

function PriceBehaviorSection({ analysis }: { analysis: PriceBehaviorAnalysis }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Hành vi giá</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Góc nhìn thận trọng từ nến Nhật và Wyckoff-lite. Các tín hiệu này chỉ gợi ý bối cảnh, chưa đủ để kết luận chắc chắn.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <article className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Mẫu nến Nhật</h3>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              3-5 nến gần nhất
            </span>
          </div>

          <div className="mt-3 space-y-3">
            {analysis.candlestickPatterns.length > 0 ? (
              analysis.candlestickPatterns.map((pattern) => (
                <div key={`${pattern.pattern}-${pattern.detectedAt}`} className="rounded-lg bg-white p-3 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">{pattern.labelVi}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(pattern.detectedAt)} · {getConfidenceLabel(pattern.confidence)}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getBehaviorSentimentClass(pattern.sentiment)}`}>
                      {getBehaviorSentimentLabel(pattern.sentiment)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-300">{pattern.descriptionVi}</p>
                </div>
              ))
            ) : (
              <p className="rounded-lg bg-white p-3 text-sm leading-6 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                Chưa có mẫu nến nổi bật trong 3-5 nến gần nhất.
              </p>
            )}
          </div>
        </article>

        <article className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Wyckoff-lite</h3>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              {getConfidenceLabel(analysis.wyckoffLite.confidence)}
            </span>
          </div>

          <div className="mt-3 rounded-lg bg-white p-3 dark:bg-slate-900">
            <p className="text-sm font-semibold text-slate-950 dark:text-white">
              Nghiêng về: {getWyckoffPhaseLabel(analysis.wyckoffLite.phaseGuess)}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {analysis.wyckoffLite.summaryVi}
            </p>
          </div>

          <div className="mt-3 grid gap-3">
            <BehaviorList title="Bằng chứng" items={analysis.wyckoffLite.evidence} />
            <BehaviorList title="Điểm vô hiệu / cần kiểm tra" items={analysis.wyckoffLite.invalidationNotes} />
          </div>
        </article>
      </div>
    </section>
  );
}

function BehaviorList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg bg-white p-3 dark:bg-slate-900">
      <h4 className="text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">{title}</h4>
      <ul className="mt-2 space-y-2">
        {(items.length > 0 ? items : ["Chưa đủ dữ liệu xác nhận rõ."]).map((item) => (
          <li key={item} className="text-sm leading-5 text-slate-600 dark:text-slate-300">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function getBehaviorSentimentClass(sentiment: Signal["sentiment"]): string {
  if (sentiment === "bullish") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (sentiment === "bearish") return "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

function getBehaviorSentimentLabel(sentiment: Signal["sentiment"]): string {
  if (sentiment === "bullish") return "Tích cực";
  if (sentiment === "bearish") return "Rủi ro";
  return "Trung tính";
}

function AdvancedTechnicalSection({ summaries }: { summaries: MethodSummary[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Phân tích kỹ thuật nâng cao</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Tổng hợp nhiều phương pháp phổ biến: EMA, MACD, Bollinger Bands, ATR, ADX, OBV, hỗ trợ/kháng cự và mẫu nến.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {summaries.map((summary) => (
          <article
            key={summary.key}
            className={`rounded-lg border p-4 ${getAdvancedToneClass(summary.tone)}`}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold">{summary.titleVi}</h3>
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium dark:bg-slate-950/50">
                {getToneLabel(summary.tone)}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 opacity-85">{summary.conclusionVi}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2">
              {summary.items.slice(0, 4).map((item) => (
                <div key={`${summary.key}-${item.label}`} className="rounded-lg bg-white/65 p-2 dark:bg-slate-950/40">
                  <dt className="text-[11px] text-slate-500 dark:text-slate-400">{item.label}</dt>
                  <dd className="mt-0.5 text-sm font-semibold tabular-nums">{item.value}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function getAdvancedToneClass(tone: MethodSummary["tone"]): string {
  if (tone === "bullish") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100";
  }

  if (tone === "bearish") {
    return "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100";
  }

  return "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200";
}

function getToneLabel(tone: MethodSummary["tone"]): string {
  if (tone === "bullish") return "Tích cực";
  if (tone === "bearish") return "Rủi ro";
  return "Trung tính";
}

function TechnicalSignalBadge({ signal }: { signal: Signal }) {
  const toneClass =
    signal.sentiment === "bullish"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
      : signal.sentiment === "bearish"
        ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
        : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{signal.labelVi}</p>
        <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium dark:bg-slate-950/50">
          {signal.strength}/5
        </span>
      </div>
      <p className="mt-1 text-sm leading-5 opacity-80">{signal.descriptionVi}</p>
    </div>
  );
}

function InvalidDataState({
  stock,
  message,
  symbolState,
  freshness,
}: {
  stock: StockMetadata;
  message: string;
  symbolState: Awaited<ReturnType<typeof getSymbolDataState>>;
  freshness: Awaited<ReturnType<typeof getSymbolFreshness>>;
}) {
  const copy = getInvalidDataCopy(symbolState, message);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
          <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white">
            {vi.stock.backToWatchlist}
          </Link>
          <h1 className="mt-6 text-4xl font-semibold text-slate-950 dark:text-white">{stock.symbol}</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">{stock.name}</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        <div className={`rounded-lg border p-5 shadow-sm ${copy.toneClass}`}>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/70 text-xl dark:bg-slate-950/50" aria-hidden>
              {copy.icon}
            </span>
            <div>
              <h2 className="text-lg font-semibold">{copy.title}</h2>
              <p className="mt-2 text-sm leading-6 opacity-85">{copy.description}</p>
            </div>
          </div>
          <p className="mt-4 rounded border border-current/20 bg-white/70 p-3 text-sm dark:bg-slate-950/40">
            {message}
          </p>
        </div>
        <SymbolRefreshPanel symbol={stock.symbol} freshness={freshness} />
      </section>
    </main>
  );
}

function getInvalidDataCopy(
  symbolState: Awaited<ReturnType<typeof getSymbolDataState>>,
  message: string,
): {
  title: string;
  description: string;
  icon: string;
  toneClass: string;
} {
  if (symbolState?.syncStatus === "unsupported" || symbolState?.isActive === false) {
    return {
      title: "Mã này hiện chưa được nguồn dữ liệu hỗ trợ",
      description: symbolState?.unsupportedReason ?? "Bạn vẫn có thể xem lại nếu sau này hệ thống có dữ liệu lịch sử phù hợp.",
      icon: "!",
      toneClass: "border-slate-200 bg-white text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-white",
    };
  }

  if (symbolState?.syncStatus === "backfill_failed" || symbolState?.syncStatus === "failed") {
    return {
      title: "Không thể tải dữ liệu, vui lòng thử lại",
      description: "Nguồn dữ liệu có thể đang lỗi tạm thời. Bạn có thể bấm làm mới dữ liệu để thử cập nhật lại riêng mã này.",
      icon: "!",
      toneClass: "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100",
    };
  }

  if (message.toLowerCase().includes("chưa") || message.toLowerCase().includes("du")) {
    return {
      title: "Chưa có đủ dữ liệu để phân tích",
      description: "Hệ thống cần thêm dữ liệu giá lịch sử trước khi hiển thị chart, điểm kỹ thuật và AI phân tích.",
      icon: "i",
      toneClass: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100",
    };
  }

  return {
    title: "Dữ liệu đang được cập nhật",
    description: "Bạn vẫn có thể thử làm mới dữ liệu riêng mã này. Trang sẽ không render chart khi dữ liệu chưa hợp lệ.",
    icon: "i",
    toneClass: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100",
  };
}

async function getStockMetadataForPage(symbol: string): Promise<StockMetadata | null> {
  const supabaseStock = await getSymbolMetadata(symbol);

  if (supabaseStock) {
    return supabaseStock;
  }

  if (isSupabaseClientConfigured()) {
    console.warn(`${symbol}: Supabase symbols table is configured but metadata was not found; static metadata fallback skipped.`);
    return null;
  }

  return STOCKS.find((item) => item.symbol === symbol) ?? null;
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
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
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-rose-600 dark:text-rose-400"
        : "text-slate-950 dark:text-white";

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-xl font-semibold tabular-nums ${color}`}>{value}</p>
      {subValue ? <p className={`mt-1 text-sm font-medium ${color}`}>{subValue}</p> : null}
    </article>
  );
}

function IndicatorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0 dark:border-slate-800">
      <dt className="text-sm text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-slate-950 dark:text-white">{value}</dd>
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
