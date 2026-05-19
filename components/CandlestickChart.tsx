"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  createChart,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time,
} from "lightweight-charts";
import { calculateSMA } from "@/lib/indicators";
import { vi } from "@/lib/i18n/vi";
import type { OHLCV } from "@/types/stock";

export function CandlestickChart({ data }: { data: OHLCV[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartData = useMemo<CandlestickData<Time>[]>(
    () =>
      data.map((candle) => ({
        time: candle.date,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    [data],
  );
  const volumeData = useMemo<HistogramData<Time>[]>(
    () =>
      data.map((candle) => ({
        time: candle.date,
        value: candle.volume,
        color: candle.close >= candle.open ? "rgba(5, 150, 105, 0.35)" : "rgba(220, 38, 38, 0.35)",
      })),
    [data],
  );
  const candlesByDate = useMemo(
    () => new Map(data.map((candle) => [candle.date, candle])),
    [data],
  );
  const sma20 = useMemo(() => toLineData(data, 20), [data]);
  const sma50 = useMemo(() => toLineData(data, 50), [data]);

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
      height: 420,
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
          bottom: 0.28,
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

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: "volume",
      },
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

    const sma20Series = chart.addSeries(LineSeries, {
      color: "#2563eb",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    sma20Series.setData(sma20);

    const sma50Series = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    sma50Series.setData(sma50);

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
        height: entry.contentRect.width < 640 ? 320 : 420,
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
            bottom: 0.28,
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
  }, [candlesByDate, chartData, sma20, sma50, volumeData]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-4 px-1 text-xs font-medium text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-2">
          <span className="h-2 w-4 rounded-sm bg-blue-600" aria-hidden />
          {vi.chart.sma20}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-4 rounded-sm bg-amber-500" aria-hidden />
          {vi.chart.sma50}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-4 rounded-sm bg-emerald-600/40" aria-hidden />
          Volume
        </span>
      </div>
      <div ref={containerRef} className="relative h-80 w-full sm:h-[420px]" />
    </section>
  );
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
