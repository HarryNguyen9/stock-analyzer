"use client";

import { useState } from "react";
import { vi } from "@/lib/i18n/vi";

type AiAnalysis = {
  summary: string;
  bullishPoints: string[];
  riskPoints: string[];
  watchPoints: string[];
  disclaimer: string;
  sentiment: "positive" | "neutral" | "risk";
  source: "gemini" | "fallback";
};

type AiAnalysisModalProps = {
  symbol: string;
  companyName: string;
  latestPrice: string;
  changePercent: string;
  score: number;
  sentimentLabel: string;
};

type ApiResponse =
  | {
      ok: true;
      cached: boolean;
      cooldown?: boolean;
      analysis: AiAnalysis;
    }
  | {
      ok: false;
      message: string;
    };

export function AiAnalysisModal({
  symbol,
  companyName,
  latestPrice,
  changePercent,
  score,
  sentimentLabel,
}: AiAnalysisModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = vi.stock.ai;

  async function openModal() {
    setIsOpen(true);

    if (!analysis) {
      await loadAnalysis(false);
    }
  }

  async function loadAnalysis(forceRefresh: boolean) {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ symbol, forceRefresh }),
      });
      const payload = (await response.json()) as ApiResponse;

      if (!payload.ok) {
        throw new Error(payload.message);
      }

      setAnalysis(payload.analysis);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : copy.fallbackError);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-lg border border-slate-300 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:border-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
      >
        {copy.button}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label={copy.close}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <section
            className={`absolute inset-x-0 bottom-0 max-h-[88vh] overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl transition dark:border-slate-800 dark:bg-slate-950 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-h-[82vh] sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl ${getPanelAccent(
              analysis?.sentiment,
            )}`}
          >
            <div className="max-h-[88vh] overflow-y-auto p-5 sm:max-h-[82vh] sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
                    {copy.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {copy.subtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                >
                  {copy.close}
                </button>
              </div>

              <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-semibold text-slate-950 dark:text-white">{symbol}</p>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {sentimentLabel}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">{companyName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold tabular-nums text-slate-950 dark:text-white">{latestPrice}</p>
                    <p className={`text-sm font-semibold ${changePercent.startsWith("-") ? "text-rose-600" : "text-emerald-600"}`}>
                      {changePercent}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-lg bg-white px-3 py-2 dark:bg-slate-950">
                  <span className="text-sm text-slate-500 dark:text-slate-400">{copy.technicalScore}</span>
                  <span className="text-sm font-semibold text-slate-950 dark:text-white">{score}/100</span>
                </div>
              </div>

              {isLoading ? <LoadingState /> : null}
              {error ? (
                <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  {error}
                </div>
              ) : null}
              {!isLoading && analysis ? <AnalysisResult analysis={analysis} /> : null}

              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                {analysis?.disclaimer ??
                  copy.disclaimer}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => loadAnalysis(true)}
                  disabled={isLoading}
                  className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  {copy.retry}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  {copy.close}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function LoadingState() {
  const copy = vi.stock.ai;

  return (
    <div className="mt-5 space-y-3">
      <p className="animate-pulse text-sm font-medium text-slate-500 dark:text-slate-400">{copy.loading}</p>
      <div className="space-y-2">
        <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-900" />
      </div>
    </div>
  );
}

function AnalysisResult({ analysis }: { analysis: AiAnalysis }) {
  const copy = vi.stock.ai;

  return (
    <div className="mt-5 space-y-4">
      <ResultBlock title={copy.sections.summary} items={[analysis.summary]} />
      <ResultBlock title={copy.sections.bullish} items={analysis.bullishPoints} />
      <ResultBlock title={copy.sections.risk} items={analysis.riskPoints} />
      <ResultBlock title={copy.sections.watch} items={analysis.watchPoints} />
    </div>
  );
}

function ResultBlock({ title, items }: { title: string; items: string[] }) {
  const copy = vi.stock.ai;

  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h3>
      <div className="mt-2 space-y-2">
        {items.length > 0 ? (
          items.map((item) => (
            <p key={item} className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {item}
            </p>
          ))
        ) : (
          <p className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            {copy.emptyPoint}
          </p>
        )}
      </div>
    </section>
  );
}

function getPanelAccent(sentiment?: AiAnalysis["sentiment"]): string {
  if (sentiment === "positive") {
    return "ring-1 ring-emerald-100 dark:ring-emerald-900";
  }

  if (sentiment === "risk") {
    return "ring-1 ring-amber-100 dark:ring-amber-900";
  }

  return "";
}
