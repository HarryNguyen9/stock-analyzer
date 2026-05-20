"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { LazyStockSearchList } from "@/components/LazyStockSearchList";

type HomeTab = "discover" | "search";

export function HomeTabs({
  initialTab = "discover",
  discover,
}: {
  initialTab?: HomeTab;
  discover: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<HomeTab>(initialTab);

  function selectTab(tab: HomeTab) {
    setActiveTab(tab);

    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url);
  }

  return (
    <>
      <div className="sticky top-[85px] z-40 border-b border-cyan-400/10 bg-[#07111f]/90 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-2 overflow-hidden rounded-2xl border border-cyan-400/10 bg-[#0b1b31]/70 p-1">
            <TabButton active={activeTab === "discover"} onClick={() => selectTab("discover")} icon={<CompassIcon />}>
              Khám phá
            </TabButton>
            <TabButton active={activeTab === "search"} onClick={() => selectTab("search")} icon={<SearchIcon />}>
              Tìm cổ phiếu
            </TabButton>
          </div>
        </div>
      </div>

      <div className="transition-opacity duration-200" hidden={activeTab !== "discover"}>
        {discover}
      </div>
      <div className="transition-opacity duration-200" hidden={activeTab !== "search"}>
        <LazyStockSearchList active={activeTab === "search"} />
      </div>
    </>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
        active
          ? "bg-cyan-400/10 text-cyan-200 shadow-[inset_0_-2px_0_rgba(34,211,238,0.9)] ring-1 ring-cyan-300/25"
          : "text-slate-400 hover:bg-white/5 hover:text-white"
      }`}
      aria-pressed={active}
    >
      <span className={active ? "text-cyan-200" : "text-slate-500"}>{icon}</span>
      {children}
    </button>
  );
}

function CompassIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
