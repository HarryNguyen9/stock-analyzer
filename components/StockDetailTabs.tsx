"use client";

import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from "react";

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
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const tabButtonRefs = useRef<Record<StockDetailTabId, HTMLButtonElement | null>>({
    overview: null,
    "price-action": null,
    indicators: null,
    patterns: null,
    ai: null,
  });
  const contentByTab: Record<StockDetailTabId, ReactNode> = {
    overview,
    "price-action": priceAction,
    indicators,
    patterns,
    ai: aiAnalysis,
  };
  const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);

  useEffect(() => {
    tabButtonRefs.current[activeTab]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeTab]);

  function goToTab(index: number) {
    const nextTab = tabs[index];

    if (nextTab) {
      setActiveTab(nextTab.id);
    }
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (isChartInteraction(event.target)) {
      touchStartRef.current = null;
      return;
    }

    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = touchStartRef.current;
    touchStartRef.current = null;

    if (!start || isChartInteraction(event.target)) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (Math.abs(deltaX) <= 50 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.5) {
      return;
    }

    if (deltaX < 0) {
      goToTab(Math.min(activeIndex + 1, tabs.length - 1));
      return;
    }

    goToTab(Math.max(activeIndex - 1, 0));
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 lg:px-8">
      <div className="-mx-3 border-b border-sky-200 bg-slate-50 px-3 py-3.5 shadow-[0_14px_40px_rgba(15,23,42,0.08)] dark:border-cyan-400/10 dark:bg-[#071126] dark:shadow-[0_14px_40px_rgba(0,0,0,0.22)] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div
          role="tablist"
          aria-label="Stock detail sections"
          className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-sky-200 bg-white/90 p-1.5 [scrollbar-width:none] dark:border-cyan-300/10 dark:bg-[#030816]/90 [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                id={`stock-detail-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-controls={`stock-detail-panel-${tab.id}`}
                aria-selected={isActive}
                ref={(node) => {
                  tabButtonRefs.current[tab.id] = node;
                }}
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-10 w-[104px] shrink-0 rounded-xl px-3 text-center text-sm font-semibold leading-none transition sm:w-auto sm:flex-1 ${
                  isActive
                    ? "bg-gradient-to-r from-cyan-400 to-teal-300 text-slate-950 shadow-[0_0_22px_rgba(34,211,238,0.24)]"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-cyan-100"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <div
              key={tab.id}
              id={`stock-detail-panel-${tab.id}`}
              role="tabpanel"
              aria-labelledby={`stock-detail-tab-${tab.id}`}
              hidden={!isActive}
              className={isActive ? "animate-[fadeIn_180ms_ease-out]" : undefined}
            >
              {contentByTab[tab.id]}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function isChartInteraction(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("[data-chart-interactive='true']"));
}
