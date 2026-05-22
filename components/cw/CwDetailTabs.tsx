"use client";

import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from "react";

type CwDetailTabId = "overview" | "contract" | "pricing" | "risk";

type CwDetailTabsProps = {
  overview: ReactNode;
  contract: ReactNode;
  pricing: ReactNode;
  risk: ReactNode;
};

const tabs: Array<{ id: CwDetailTabId; label: string; icon: ReactNode }> = [
  { id: "overview", label: "Tổng quan", icon: <OverviewIcon /> },
  { id: "contract", label: "Hợp đồng", icon: <ContractIcon /> },
  { id: "pricing", label: "Định giá", icon: <PricingIcon /> },
  { id: "risk", label: "Rủi ro", icon: <RiskIcon /> },
];

export function CwDetailTabs({ overview, contract, pricing, risk }: CwDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<CwDetailTabId>("overview");
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const tabButtonRefs = useRef<Record<CwDetailTabId, HTMLButtonElement | null>>({
    overview: null,
    contract: null,
    pricing: null,
    risk: null,
  });
  const contentByTab: Record<CwDetailTabId, ReactNode> = {
    overview,
    contract,
    pricing,
    risk,
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
    if (nextTab) setActiveTab(nextTab.id);
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (Math.abs(deltaX) <= 50 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.5) return;

    if (deltaX < 0) {
      goToTab(Math.min(activeIndex + 1, tabs.length - 1));
      return;
    }

    goToTab(Math.max(activeIndex - 1, 0));
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-3 pb-5 sm:px-6 lg:px-8">
      <div className="-mx-3 border-b border-cyan-300/10 bg-[#071126] px-3 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div
          role="tablist"
          aria-label="Covered warrant detail sections"
          className="flex max-w-full items-center gap-1 overflow-x-auto rounded-[1.6rem] border border-cyan-400/25 bg-[#030816]/92 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_26px_rgba(8,145,178,0.10)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                id={`cw-detail-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-controls={`cw-detail-panel-${tab.id}`}
                aria-selected={isActive}
                ref={(node) => {
                  tabButtonRefs.current[tab.id] = node;
                }}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[1.2rem] px-5 text-center text-sm font-semibold leading-none transition sm:flex-1 ${
                  isActive
                    ? "bg-gradient-to-r from-cyan-400 to-emerald-300 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.28)]"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-cyan-100"
                }`}
              >
                <span className={isActive ? "text-slate-950" : "text-slate-500"}>{tab.icon}</span>
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
              id={`cw-detail-panel-${tab.id}`}
              role="tabpanel"
              aria-labelledby={`cw-detail-tab-${tab.id}`}
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
    </svg>
  );
}

function ContractIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v5h5M8 13h8M8 17h6" strokeLinecap="round" />
    </svg>
  );
}

function PricingIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 12h16M12 4v16" strokeLinecap="round" />
      <circle cx="12" cy="12" r="7" />
    </svg>
  );
}

function RiskIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3 3 20h18L12 3Z" strokeLinejoin="round" />
      <path d="M12 9v5M12 17h.01" strokeLinecap="round" />
    </svg>
  );
}
