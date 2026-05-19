"use client";

import Link from "next/link";
import { useState } from "react";
import { formatTechnicalScore } from "@/lib/ai/score-format";
import type { SectorSummary } from "@/lib/pipeline/snapshot";

export function SectorHeatmap({ sectors }: { sectors: SectorSummary[] }) {
  const [expandedSector, setExpandedSector] = useState<string | null>(sectors[0]?.sector ?? null);

  if (sectors.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Sức mạnh theo ngành</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Tổng hợp biến động, điểm kỹ thuật và số mã tăng/giảm theo từng ngành.
          </p>
        </div>
      </div>

      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-3 xl:grid-cols-4">
        {sectors.map((sector) => (
          <button
            key={sector.sector}
            type="button"
            onClick={() => setExpandedSector((current) => (current === sector.sector ? null : sector.sector))}
            className={`min-w-72 snap-start rounded-lg border p-4 text-left shadow-sm transition sm:min-w-0 ${
              sector.averageChangePercent >= 0
                ? "border-emerald-200 bg-emerald-50/70 hover:border-emerald-300 dark:border-emerald-950 dark:bg-emerald-950/30"
                : "border-rose-200 bg-rose-50/70 hover:border-rose-300 dark:border-rose-950 dark:bg-rose-950/25"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="line-clamp-2 text-base font-semibold text-slate-950 dark:text-white">
                  {sector.sector}
                </h3>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {sector.symbolCount} mã
                </p>
              </div>
              <p className={`shrink-0 text-lg font-semibold ${sector.averageChangePercent >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                {sector.averageChangePercent >= 0 ? "+" : ""}
                {sector.averageChangePercent.toFixed(2)}%
              </p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <Metric label="Điểm" value={Math.round(sector.averageTechnicalScore).toString()} />
              <Metric label="Tăng" value={sector.advancingCount.toString()} />
              <Metric label="Giảm" value={sector.decliningCount.toString()} />
            </div>
          </button>
        ))}
      </div>

      {expandedSector ? (
        <SectorTopSymbols sector={sectors.find((sector) => sector.sector === expandedSector) ?? null} />
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/70 p-2 dark:bg-slate-950/50">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function SectorTopSymbols({ sector }: { sector: SectorSummary | null }) {
  if (!sector || sector.topSymbols.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{sector.sector}</h3>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Top mã</span>
      </div>
      <div className="space-y-2">
        {sector.topSymbols.map((stock) => (
          <Link
            key={`${sector.sector}-${stock.symbol}`}
            href={`/stock/${stock.symbol}`}
            className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 transition hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-slate-950 dark:text-white">{stock.symbol}</p>
                <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  {stock.exchange}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">{stock.name}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-sm font-semibold ${stock.changePercent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {stock.changePercent >= 0 ? "+" : ""}
                {stock.changePercent.toFixed(2)}%
              </p>
              <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                {formatTechnicalScore(stock.technicalScore)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
