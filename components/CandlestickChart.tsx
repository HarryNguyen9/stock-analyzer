"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  LineSeries,
  createChart,
  type CandlestickData,
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
  const sma20 = useMemo(() => toLineData(data, 20), [data]);
  const sma50 = useMemo(() => toLineData(data, 50), [data]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

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
  }, [chartData, sma20, sma50]);

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
      </div>
      <div ref={containerRef} className="h-80 w-full sm:h-[420px]" />
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
