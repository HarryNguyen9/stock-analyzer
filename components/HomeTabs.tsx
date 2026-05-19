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
      <div className="sticky top-[78px] z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto w-full max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex gap-2 overflow-x-auto">
            <TabButton active={activeTab === "discover"} onClick={() => selectTab("discover")}>
              Khám phá
            </TabButton>
            <TabButton active={activeTab === "search"} onClick={() => selectTab("search")}>
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
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative min-h-9 shrink-0 rounded-full px-4 text-sm font-semibold transition ${
        active
          ? "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:ring-cyan-900"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
      }`}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
