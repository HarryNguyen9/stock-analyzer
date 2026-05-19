"use client";

import { useState, type ReactNode } from "react";

type StockDetailTabId = "overview" | "price-action" | "indicators" | "patterns" | "ai";

type StockDetailTabsProps = {
  overview: ReactNode;
  priceAction: ReactNode;
  indicators: ReactNode;
  patterns: ReactNode;
  aiAnalysis: ReactNode;
};

const tabs: Array<{ id: StockDetailTabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "price-action", label: "Price Action" },
  { id: "indicators", label: "Indicators" },
  { id: "patterns", label: "Patterns" },
  { id: "ai", label: "AI Analysis" },
];

export function StockDetailTabs({
  overview,
  priceAction,
  indicators,
  patterns,
  aiAnalysis,
}: StockDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<StockDetailTabId>("overview");
  const contentByTab: Record<StockDetailTabId, ReactNode> = {
    overview,
    "price-action": priceAction,
    indicators,
    patterns,
    ai: aiAnalysis,
  };

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="sticky top-14 z-40 -mx-4 border-b border-slate-200 bg-slate-50/95 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
                    : "text-slate-500 hover:bg-white hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 animate-[fadeIn_180ms_ease-out]">{contentByTab[activeTab]}</div>
    </section>
  );
}
