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
      <div className="sticky top-[58px] z-40 bg-slate-50/95 px-2 pb-2 backdrop-blur-xl dark:bg-[#07111f]/95 sm:top-[64px] sm:px-4">
        <div className="mx-auto w-full max-w-7xl overflow-hidden rounded-b-2xl border-x border-b border-sky-200 bg-white/90 shadow-[0_12px_34px_rgba(15,23,42,0.08)] dark:border-cyan-400/10 dark:bg-[#061323]/95 dark:shadow-[0_12px_34px_rgba(0,0,0,0.22)]">
          <div className="grid grid-cols-2">
            <SecondaryTabButton active={activeTab === "discover"} onClick={() => selectTab("discover")}>
              Khám phá
            </SecondaryTabButton>
            <SecondaryTabButton active={activeTab === "search"} onClick={() => selectTab("search")}>
              Tìm cổ phiếu
            </SecondaryTabButton>
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

function SecondaryTabButton({
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
      className={`relative min-h-11 px-4 text-sm font-semibold transition ${
        active ? "text-cyan-700 dark:text-cyan-100" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
      }`}
      aria-pressed={active}
    >
      <span className="relative z-10">{children}</span>
      {active ? (
        <span className="absolute bottom-0 left-1/2 h-0.5 w-2/3 -translate-x-1/2 rounded-full bg-cyan-500 shadow-[0_0_14px_rgba(14,165,233,0.45)] dark:bg-cyan-300 dark:shadow-[0_0_14px_rgba(34,211,238,0.9)]" />
      ) : null}
    </button>
  );
}
