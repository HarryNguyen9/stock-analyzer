"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineStyle,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type LineSeriesPartialOptions,
  type LineData,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import { calculateSMA } from "@/lib/indicators";
import { vi } from "@/lib/i18n/vi";
import { MAX_HISTORICAL_CANDLES } from "@/lib/data-source/constants";
import type { CandlestickPatternSignal, SupportResistance } from "@/lib/technical-analysis";
import type { OHLCV } from "@/types/stock";

type TimeRange = "3M" | "6M" | "1Y" | "All";

type ChartToggles = {
  sma20: boolean;
  sma50: boolean;
  volume: boolean;
  bollinger: boolean;
  supportResistance: boolean;
  patterns: boolean;
};

type CandlestickChartProps = {
  data: OHLCV[];
  supportResistance?: SupportResistance;
  patterns?: CandlestickPatternSignal[];
  breakHigh20?: boolean;
  breakLow20?: boolean;
};

type BollingerLine = { color: string; data: LineData<Time>[] };

const rangeOptions: TimeRange[] = ["3M", "6M", "1Y", "All"];
const chartSettingsKey = "stock-chart-settings";
const defaultToggles: ChartToggles = {
  sma20: true,
  sma50: true,
  volume: true,
  bollinger: true,
  supportResistance: false,
  patterns: false,
};

export function CandlestickChart({
  data,
  supportResistance,
  patterns = [],
  breakHigh20 = false,
  breakLow20 = false,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick", Time> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram", Time> | null>(null);
  const sma20SeriesRef = useRef<ISeriesApi<"Line", Time> | null>(null);
  const sma50SeriesRef = useRef<ISeriesApi<"Line", Time> | null>(null);
  const bollingerSeriesRef = useRef<Array<ISeriesApi<"Line", Time>>>([]);
  const markerPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const candlesByDateRef = useRef<Map<string, OHLCV>>(new Map());
  const latestDataRef = useRef<{
    chartData: CandlestickData<Time>[];
    volumeData: HistogramData<Time>[];
    sma20: LineData<Time>[];
    sma50: LineData<Time>[];
    bollinger: BollingerLine[];
    markers: SeriesMarker<Time>[];
    supportResistance?: SupportResistance;
  }>({
    chartData: [],
    volumeData: [],
    sma20: [],
    sma50: [],
    bollinger: [],
    markers: [],
  });
  const [range, setRange] = useState<TimeRange>("1Y");
  const [toggles, setToggles] = useState<ChartToggles>(() => readStoredToggles());
  const [visibleRangePreserved, setVisibleRangePreserved] = useState(false);
  const filteredData = useMemo(() => filterByRange(data, range), [data, range]);
  const chartData = useMemo<CandlestickData<Time>[]>(
    () =>
      filteredData.map((candle) => ({
        time: candle.date,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    [filteredData],
  );
  const volumeData = useMemo<HistogramData<Time>[]>(
    () =>
      filteredData.map((candle) => ({
        time: candle.date,
        value: candle.volume,
        color: candle.close >= candle.open ? "rgba(16, 185, 129, 0.34)" : "rgba(239, 68, 68, 0.34)",
      })),
    [filteredData],
  );
  const candlesByDate = useMemo(
    () => new Map(filteredData.map((candle) => [candle.date, candle])),
    [filteredData],
  );
  const sma20 = useMemo(() => toLineData(filteredData, 20), [filteredData]);
  const sma50 = useMemo(() => toLineData(filteredData, 50), [filteredData]);
  const bollinger = useMemo(() => toBollingerData(filteredData), [filteredData]);
  const markers = useMemo(
    () => createChartMarkers(filteredData, patterns, breakHigh20, breakLow20),
    [breakHigh20, breakLow20, filteredData, patterns],
  );

  latestDataRef.current = {
    chartData,
    volumeData,
    sma20,
    sma50,
    bollinger,
    markers,
    supportResistance,
  };
  candlesByDateRef.current = candlesByDate;

  useEffect(() => {
    try {
      window.localStorage.setItem(chartSettingsKey, JSON.stringify(toggles));
    } catch {
      // Local storage is optional; chart controls still work without it.
    }
  }, [toggles]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || chartRef.current) {
      return;
    }

    const theme = getThemeOptions();
    const chart = createChart(container, {
      height: container.clientWidth < 640 ? 360 : 520,
      width: container.clientWidth,
      layout: {
        background: { type: ColorType.Solid, color: theme.background },
        textColor: theme.text,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: theme.grid },
        horzLines: { color: theme.grid },
      },
      rightPriceScale: {
        borderColor: theme.border,
        scaleMargins: {
          top: 0.06,
          bottom: toggles.volume ? 0.28 : 0.08,
        },
      },
      timeScale: {
        borderColor: theme.border,
        timeVisible: true,
      },
      crosshair: {
        mode: 1,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: "#059669",
      downColor: "#dc2626",
      borderVisible: false,
      wickUpColor: "#059669",
      wickDownColor: "#dc2626",
    });

    const tooltip = document.createElement("div");
    tooltip.className =
      "pointer-events-none absolute left-3 top-3 z-10 hidden max-w-[calc(100%-1.5rem)] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95";
    container.appendChild(tooltip);

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        tooltip.classList.add("hidden");
        return;
      }

      const candle = candlesByDateRef.current.get(String(param.time));

      if (!candle) {
        tooltip.classList.add("hidden");
        return;
      }

      tooltip.innerHTML = `
        <div class="font-semibold text-slate-950 dark:text-white">${formatChartDate(candle.date)}</div>
        <div class="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-slate-600 dark:text-slate-300">
          <span>Open</span><span class="text-right font-medium tabular-nums">${formatPrice(candle.open)}</span>
          <span>High</span><span class="text-right font-medium tabular-nums">${formatPrice(candle.high)}</span>
          <span>Low</span><span class="text-right font-medium tabular-nums">${formatPrice(candle.low)}</span>
          <span>Close</span><span class="text-right font-medium tabular-nums">${formatPrice(candle.close)}</span>
          <span>Volume</span><span class="text-right font-medium tabular-nums">${formatVolume(candle.volume)}</span>
        </div>
      `;
      tooltip.classList.remove("hidden");

      const tooltipWidth = tooltip.offsetWidth;
      const tooltipHeight = tooltip.offsetHeight;
      const x = Math.min(param.point.x + 12, container.clientWidth - tooltipWidth - 12);
      const y = Math.min(param.point.y + 12, container.clientHeight - tooltipHeight - 12);

      tooltip.style.transform = `translate(${Math.max(12, x)}px, ${Math.max(12, y)}px)`;
    });

    const resizeObserver = new ResizeObserver(([entry]) => {
      chart.applyOptions({
        width: Math.floor(entry.contentRect.width),
        height: entry.contentRect.width < 640 ? 360 : 520,
      });
    });

    resizeObserver.observe(container);
    const themeObserver = new MutationObserver(() => {
      applyTheme(chart, toggles.volume);
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    syncChartSeries({ preserveRange: false, fitContent: true });

    return () => {
      resizeObserver.disconnect();
      themeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      sma20SeriesRef.current = null;
      sma50SeriesRef.current = null;
      bollingerSeriesRef.current = [];
      markerPluginRef.current = null;
      priceLinesRef.current = [];
    };
    // Chart instance is intentionally created once; series updates happen in dedicated effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    syncChartSeries({ preserveRange: false, fitContent: true });
    // Data/range changes should refit. Indicator toggles are handled separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData, volumeData, sma20, sma50, bollinger, markers, supportResistance, range]);

  useEffect(() => {
    const preserved = syncChartSeries({ preserveRange: true, fitContent: false });
    setVisibleRangePreserved(preserved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggles]);

  function syncChartSeries({
    preserveRange,
    fitContent,
  }: {
    preserveRange: boolean;
    fitContent: boolean;
  }): boolean {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;

    if (!chart || !candleSeries) {
      return false;
    }

    const savedRange = preserveRange ? chart.timeScale().getVisibleLogicalRange() : null;
    const dataRef = latestDataRef.current;

    applyTheme(chart, toggles.volume);
    candleSeries.setData(dataRef.chartData);
    syncLineSeries("sma20", dataRef.sma20, {
      color: "#2563eb",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    syncLineSeries("sma50", dataRef.sma50, {
      color: "#f59e0b",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    syncVolumeSeries(dataRef.volumeData);
    syncBollingerSeries(dataRef.bollinger);
    syncSupportResistance(candleSeries, dataRef.supportResistance);
    syncMarkers(candleSeries, dataRef.markers);

    if (fitContent) {
      chart.timeScale().fitContent();
      return false;
    }

    if (savedRange) {
      chart.timeScale().setVisibleLogicalRange(savedRange);
      return true;
    }

    return false;
  }

  function syncLineSeries(
    key: "sma20" | "sma50",
    data: LineData<Time>[],
    options: LineSeriesPartialOptions,
  ) {
    const chart = chartRef.current;

    if (!chart) return;

    const enabled = toggles[key];
    const ref = key === "sma20" ? sma20SeriesRef : sma50SeriesRef;

    if (!enabled) {
      removeSeries(ref);
      return;
    }

    if (!ref.current) {
      ref.current = chart.addSeries(LineSeries, options);
    }

    ref.current.setData(data);
  }

  function syncVolumeSeries(data: HistogramData<Time>[]) {
    const chart = chartRef.current;

    if (!chart) return;

    if (!toggles.volume) {
      removeSeries(volumeSeriesRef);
      return;
    }

    if (!volumeSeriesRef.current) {
      volumeSeriesRef.current = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceLineVisible: false,
        lastValueVisible: false,
        priceScaleId: "",
      });
      volumeSeriesRef.current.priceScale().applyOptions({
        scaleMargins: {
          top: 0.78,
          bottom: 0,
        },
      });
    }

    volumeSeriesRef.current.setData(data);
  }

  function syncBollingerSeries(lines: BollingerLine[]) {
    const chart = chartRef.current;

    if (!chart) return;

    if (!toggles.bollinger) {
      for (const series of bollingerSeriesRef.current) {
        chart.removeSeries(series);
      }
      bollingerSeriesRef.current = [];
      return;
    }

    while (bollingerSeriesRef.current.length < lines.length) {
      bollingerSeriesRef.current.push(
        chart.addSeries(LineSeries, {
          color: "rgba(99, 102, 241, 0.8)",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        }),
      );
    }

    lines.forEach((line, index) => {
      const series = bollingerSeriesRef.current[index];
      series.applyOptions({ color: line.color });
      series.setData(line.data);
    });
  }

  function syncSupportResistance(
    candleSeries: ISeriesApi<"Candlestick", Time>,
    value?: SupportResistance,
  ) {
    for (const line of priceLinesRef.current) {
      candleSeries.removePriceLine(line);
    }
    priceLinesRef.current = [];

    if (!toggles.supportResistance || !value) return;

    if (value.nearestSupport !== null) {
      priceLinesRef.current.push(
        candleSeries.createPriceLine({
          price: value.nearestSupport,
          color: "#10b981",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "Support",
        }),
      );
    }

    if (value.nearestResistance !== null) {
      priceLinesRef.current.push(
        candleSeries.createPriceLine({
          price: value.nearestResistance,
          color: "#f97316",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "Resistance",
        }),
      );
    }
  }

  function syncMarkers(candleSeries: ISeriesApi<"Candlestick", Time>, value: SeriesMarker<Time>[]) {
    if (!toggles.patterns) {
      markerPluginRef.current?.setMarkers([]);
      return;
    }

    if (!markerPluginRef.current) {
      markerPluginRef.current = createSeriesMarkers(candleSeries, value);
      return;
    }

    markerPluginRef.current.setMarkers(value);
  }

  function removeSeries<T extends "Line" | "Histogram">(ref: {
    current: ISeriesApi<T, Time> | null;
  }) {
    const chart = chartRef.current;

    if (chart && ref.current) {
      chart.removeSeries(ref.current);
      ref.current = null;
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-4">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {rangeOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRange(option)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  range === option
                    ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ToggleButton active={toggles.sma20} label="SMA20" onClick={() => toggle("sma20", setToggles)} />
            <ToggleButton active={toggles.sma50} label="SMA50" onClick={() => toggle("sma50", setToggles)} />
            <ToggleButton active={toggles.volume} label="Volume" onClick={() => toggle("volume", setToggles)} />
            <ToggleButton active={toggles.bollinger} label="Bollinger" onClick={() => toggle("bollinger", setToggles)} />
            <ToggleButton active={toggles.supportResistance} label="S/R" onClick={() => toggle("supportResistance", setToggles)} />
            <ToggleButton active={toggles.patterns} label="Patterns" onClick={() => toggle("patterns", setToggles)} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 px-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          {toggles.sma20 ? <LegendSwatch color="bg-blue-600" label={vi.chart.sma20} /> : null}
          {toggles.sma50 ? <LegendSwatch color="bg-amber-500" label={vi.chart.sma50} /> : null}
          {toggles.volume ? <LegendSwatch color="bg-emerald-600/40" label="Volume" /> : null}
          <span className="ml-auto hidden text-[11px] text-slate-400 dark:text-slate-500 sm:inline">
            {data.length} nến · limit {MAX_HISTORICAL_CANDLES} · preserve {visibleRangePreserved ? "on" : "ready"}
          </span>
        </div>
      </div>
      <div ref={containerRef} className="relative mt-3 h-[360px] w-full sm:h-[520px]" />
    </section>
  );
}

function ToggleButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
      }`}
    >
      {label}
    </button>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`h-2 w-4 rounded-sm ${color}`} aria-hidden />
      {label}
    </span>
  );
}

function toggle(key: keyof ChartToggles, setToggles: Dispatch<SetStateAction<ChartToggles>>) {
  setToggles((current) => ({
    ...current,
    [key]: !current[key],
  }));
}

function readStoredToggles(): ChartToggles {
  if (typeof window === "undefined") {
    return defaultToggles;
  }

  try {
    const raw = window.localStorage.getItem(chartSettingsKey);
    const parsed = raw ? (JSON.parse(raw) as Partial<ChartToggles>) : null;

    return {
      ...defaultToggles,
      ...parsed,
    };
  } catch {
    return defaultToggles;
  }
}

function applyTheme(chart: IChartApi, volumeEnabled: boolean) {
  const theme = getThemeOptions();
  chart.applyOptions({
    layout: {
      background: { type: ColorType.Solid, color: theme.background },
      textColor: theme.text,
      attributionLogo: false,
    },
    grid: {
      vertLines: { color: theme.grid },
      horzLines: { color: theme.grid },
    },
    rightPriceScale: {
      borderColor: theme.border,
      scaleMargins: {
        top: 0.06,
        bottom: volumeEnabled ? 0.28 : 0.08,
      },
    },
    timeScale: {
      borderColor: theme.border,
    },
  });
}

function getThemeOptions() {
  const isDark = document.documentElement.classList.contains("dark");

  return {
    background: isDark ? "#0f172a" : "#ffffff",
    text: isDark ? "#cbd5e1" : "#475569",
    grid: isDark ? "#1e293b" : "#eef2f7",
    border: isDark ? "#334155" : "#e2e8f0",
  };
}

function filterByRange(data: OHLCV[], range: TimeRange): OHLCV[] {
  if (range === "All") return data;
  const days = range === "3M" ? 66 : range === "6M" ? 132 : 252;
  return data.slice(-days);
}

function toLineData(data: OHLCV[], period: number): LineData<Time>[] {
  const sma = calculateSMA(
    data.map((candle) => candle.close),
    period,
  );

  return data.flatMap((candle, index) => {
    const value = sma[index];
    return value === null ? [] : [{ time: candle.date, value }];
  });
}

function toBollingerData(data: OHLCV[]): BollingerLine[] {
  const period = 20;
  const closes = data.map((candle) => candle.close);
  const upper: LineData<Time>[] = [];
  const middle: LineData<Time>[] = [];
  const lower: LineData<Time>[] = [];

  for (let index = 0; index < data.length; index += 1) {
    if (index < period - 1) continue;
    const window = closes.slice(index - period + 1, index + 1);
    const average = window.reduce((total, value) => total + value, 0) / period;
    const variance = window.reduce((total, value) => total + (value - average) ** 2, 0) / period;
    const deviation = Math.sqrt(variance);
    const time = data[index].date;

    upper.push({ time, value: average + deviation * 2 });
    middle.push({ time, value: average });
    lower.push({ time, value: average - deviation * 2 });
  }

  return [
    { color: "rgba(99, 102, 241, 0.8)", data: upper },
    { color: "rgba(148, 163, 184, 0.7)", data: middle },
    { color: "rgba(99, 102, 241, 0.8)", data: lower },
  ];
}

function createChartMarkers(
  data: OHLCV[],
  patterns: CandlestickPatternSignal[],
  breakHigh20: boolean,
  breakLow20: boolean,
): SeriesMarker<Time>[] {
  const dates = new Set(data.map((candle) => candle.date));
  const patternMarkers = patterns
    .filter((pattern) => dates.has(pattern.detectedAt))
    .slice(0, 8)
    .map<SeriesMarker<Time>>((pattern) => ({
      time: pattern.detectedAt,
      position: pattern.sentiment === "bearish" ? "aboveBar" : "belowBar",
      color: pattern.sentiment === "bearish" ? "#ef4444" : pattern.sentiment === "bullish" ? "#10b981" : "#94a3b8",
      shape: pattern.sentiment === "bearish" ? "arrowDown" : pattern.sentiment === "bullish" ? "arrowUp" : "circle",
      text: pattern.labelVi,
    }));
  const latest = data[data.length - 1];
  const signalMarkers: SeriesMarker<Time>[] = [];

  if (latest && breakHigh20) {
    signalMarkers.push({
      time: latest.date,
      position: "aboveBar",
      color: "#10b981",
      shape: "arrowUp",
      text: "Breakout",
    });
  }

  if (latest && breakLow20) {
    signalMarkers.push({
      time: latest.date,
      position: "belowBar",
      color: "#ef4444",
      shape: "arrowDown",
      text: "Breakdown",
    });
  }

  return [...patternMarkers, ...signalMarkers].slice(-10);
}

function formatPrice(value: number): string {
  return value.toFixed(2);
}

function formatVolume(value: number): string {
  const absValue = Math.abs(value);

  if (absValue >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }

  if (absValue >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }

  if (absValue >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }

  return value.toLocaleString("vi-VN");
}

function formatChartDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
