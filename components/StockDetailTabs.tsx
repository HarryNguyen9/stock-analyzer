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

const tabs: Array<{ id: StockDetailTabId; label: string; icon: ReactNode }> = [
  { id: "overview", label: "Tổng quan", icon: <OverviewIcon /> },
  { id: "price-action", label: "Hành động giá", icon: <PriceActionIcon /> },
  { id: "indicators", label: "Chỉ báo", icon: <IndicatorsIcon /> },
  { id: "patterns", label: "Mẫu hình", icon: <PatternsIcon /> },
  { id: "ai", label: "Phân tích AI", icon: <AiIcon /> },
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
    <section className="mx-auto w-full max-w-7xl px-3 pb-4 sm:px-6 lg:px-8">
      <div className="-mx-3 border-b border-sky-200 bg-slate-50 px-3 py-3.5 shadow-[0_14px_40px_rgba(15,23,42,0.08)] dark:border-cyan-400/10 dark:bg-[#071126] dark:shadow-[0_14px_40px_rgba(0,0,0,0.22)] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div
          role="tablist"
          aria-label="Stock detail sections"
          className="flex max-w-full items-center gap-1 overflow-x-auto rounded-[1.6rem] border border-sky-200 bg-white/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.70)] [scrollbar-width:none] dark:border-cyan-400/25 dark:bg-[#030816]/92 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_26px_rgba(8,145,178,0.10)] [&::-webkit-scrollbar]:hidden"
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
                className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[1.2rem] px-5 text-center text-sm font-semibold leading-none transition sm:flex-1 ${
                  isActive
                    ? "bg-gradient-to-r from-cyan-400 to-emerald-300 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.28)]"
                    : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.04] dark:hover:text-cyan-100"
                }`}
              >
                <span className={isActive ? "text-slate-950" : "text-slate-400 dark:text-slate-500"}>{tab.icon}</span>
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

function OverviewIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 17h16" strokeLinecap="round" />
      <path d="m5 14 4-5 4 3 5-7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 19h10" strokeLinecap="round" />
    </svg>
  );
}

function PriceActionIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 5v14" strokeLinecap="round" />
      <path d="M17 5v14" strokeLinecap="round" />
      <path d="M5 9h4" strokeLinecap="round" />
      <path d="M15 15h4" strokeLinecap="round" />
      <path d="M9 7v4" strokeLinecap="round" />
      <path d="M15 13v4" strokeLinecap="round" />
    </svg>
  );
}

function IndicatorsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m4 17 5-5 4 3 7-8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="13" cy="15" r="1.5" />
      <circle cx="20" cy="7" r="1.5" />
    </svg>
  );
}

function PatternsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="7" cy="7" r="2" />
      <circle cx="17" cy="7" r="2" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}

function AiIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9L12 3Z" strokeLinejoin="round" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" strokeLinejoin="round" />
    </svg>
  );
}

function isChartInteraction(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("[data-chart-interactive='true']"));
}
