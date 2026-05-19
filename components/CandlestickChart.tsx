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
  type LineData,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import { calculateSMA } from "@/lib/indicators";
import { vi } from "@/lib/i18n/vi";
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

const rangeOptions: TimeRange[] = ["3M", "6M", "1Y", "All"];

export function CandlestickChart({
  data,
  supportResistance,
  patterns = [],
  breakHigh20 = false,
  breakLow20 = false,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [range, setRange] = useState<TimeRange>(data.length < 180 ? "All" : "1Y");
  const [toggles, setToggles] = useState<ChartToggles>({
    sma20: true,
    sma50: true,
    volume: true,
    bollinger: false,
    supportResistance: true,
    patterns: true,
  });
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

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    container.innerHTML = "";

    const getThemeOptions = () => {
      const isDark = document.documentElement.classList.contains("dark");

      return {
        background: isDark ? "#0f172a" : "#ffffff",
        text: isDark ? "#cbd5e1" : "#475569",
        grid: isDark ? "#1e293b" : "#eef2f7",
        border: isDark ? "#334155" : "#e2e8f0",
      };
    };
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

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#059669",
      downColor: "#dc2626",
      borderVisible: false,
      wickUpColor: "#059669",
      wickDownColor: "#dc2626",
    });
    candleSeries.setData(chartData);

    if (toggles.volume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceLineVisible: false,
        lastValueVisible: false,
        priceScaleId: "",
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.78,
          bottom: 0,
        },
      });
      volumeSeries.setData(volumeData);
    }

    if (toggles.sma20) {
      const sma20Series = chart.addSeries(LineSeries, {
        color: "#2563eb",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      sma20Series.setData(sma20);
    }

    if (toggles.sma50) {
      const sma50Series = chart.addSeries(LineSeries, {
        color: "#f59e0b",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      sma50Series.setData(sma50);
    }

    if (toggles.bollinger) {
      for (const line of bollinger) {
        const series = chart.addSeries(LineSeries, {
          color: line.color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        series.setData(line.data);
      }
    }

    if (toggles.supportResistance && supportResistance) {
      if (supportResistance.nearestSupport !== null) {
        candleSeries.createPriceLine({
          price: supportResistance.nearestSupport,
          color: "#10b981",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "Support",
        });
      }

      if (supportResistance.nearestResistance !== null) {
        candleSeries.createPriceLine({
          price: supportResistance.nearestResistance,
          color: "#f97316",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "Resistance",
        });
      }
    }

    if (toggles.patterns && markers.length > 0) {
      createSeriesMarkers(candleSeries, markers);
    }

    const tooltip = document.createElement("div");
    tooltip.className =
      "pointer-events-none absolute left-3 top-3 z-10 hidden max-w-[calc(100%-1.5rem)] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95";
    container.appendChild(tooltip);

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        tooltip.classList.add("hidden");
        return;
      }

      const candle = candlesByDate.get(String(param.time));

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

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(([entry]) => {
      chart.applyOptions({
        width: Math.floor(entry.contentRect.width),
        height: entry.contentRect.width < 640 ? 360 : 520,
      });
      chart.timeScale().fitContent();
    });

    resizeObserver.observe(container);
    const themeObserver = new MutationObserver(() => {
      const nextTheme = getThemeOptions();
      chart.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: nextTheme.background },
          textColor: nextTheme.text,
        },
        grid: {
          vertLines: { color: nextTheme.grid },
          horzLines: { color: nextTheme.grid },
        },
        rightPriceScale: {
          borderColor: nextTheme.border,
          scaleMargins: {
            top: 0.06,
            bottom: toggles.volume ? 0.28 : 0.08,
          },
        },
        timeScale: {
          borderColor: nextTheme.border,
        },
      });
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      resizeObserver.disconnect();
      themeObserver.disconnect();
      chart.remove();
    };
  }, [
    bollinger,
    candlesByDate,
    chartData,
    markers,
    sma20,
    sma50,
    supportResistance,
    toggles,
    volumeData,
  ]);

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
          {toggles.sma20 ? (
            <span className="flex items-center gap-2">
              <span className="h-2 w-4 rounded-sm bg-blue-600" aria-hidden />
              {vi.chart.sma20}
            </span>
          ) : null}
          {toggles.sma50 ? (
            <span className="flex items-center gap-2">
              <span className="h-2 w-4 rounded-sm bg-amber-500" aria-hidden />
              {vi.chart.sma50}
            </span>
          ) : null}
          {toggles.volume ? (
            <span className="flex items-center gap-2">
              <span className="h-2 w-4 rounded-sm bg-emerald-600/40" aria-hidden />
              Volume
            </span>
          ) : null}
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

function toggle(key: keyof ChartToggles, setToggles: Dispatch<SetStateAction<ChartToggles>>) {
  setToggles((current) => ({
    ...current,
    [key]: !current[key],
  }));
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

function toBollingerData(data: OHLCV[]): Array<{ color: string; data: LineData<Time>[] }> {
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
