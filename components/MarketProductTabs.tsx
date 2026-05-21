"use client";

import type { ReactNode } from "react";
import { useState } from "react";

type ProductTab = "stocks" | "covered-warrants";

export function MarketProductTabs({
  initialProduct = "stocks",
  stocks,
  coveredWarrants,
}: {
  initialProduct?: ProductTab;
  stocks: ReactNode;
  coveredWarrants: ReactNode;
}) {
  const [activeProduct, setActiveProduct] = useState<ProductTab>(initialProduct);

  function selectProduct(product: ProductTab) {
    setActiveProduct(product);

    const url = new URL(window.location.href);
    url.searchParams.set("product", product);
    window.history.replaceState(null, "", url);
  }

  return (
    <>
      <div className="sticky top-0 z-50 bg-slate-50/95 px-2 pt-2 backdrop-blur-xl dark:bg-[#07111f]/95 sm:px-4">
        <div className="mx-auto w-full max-w-7xl">
          <div className="rounded-2xl border border-sky-200 bg-white/90 p-1.5 shadow-[0_16px_52px_rgba(15,23,42,0.10)] ring-1 ring-slate-900/[0.03] dark:border-cyan-400/10 dark:bg-[#061323]/95 dark:shadow-[0_16px_52px_rgba(0,0,0,0.30)] dark:ring-white/[0.03]">
            <div className="grid grid-cols-2 gap-1.5">
              <ProductButton
                active={activeProduct === "stocks"}
                onClick={() => selectProduct("stocks")}
                icon={<ChartIcon />}
              >
                Cổ phiếu
              </ProductButton>
              <ProductButton
                active={activeProduct === "covered-warrants"}
                onClick={() => selectProduct("covered-warrants")}
                icon={<CertificateIcon />}
              >
                Chứng quyền
              </ProductButton>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-[#07111f]" hidden={activeProduct !== "stocks"}>
        {stocks}
      </div>
      <div hidden={activeProduct !== "covered-warrants"}>
        <CoveredWarrantSubNav />
        {coveredWarrants}
      </div>
    </>
  );
}

function ProductButton({
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
      className={`group relative min-h-10 overflow-hidden rounded-xl border px-3 text-xs font-semibold transition sm:min-h-11 sm:text-sm ${
        active
          ? "border-sky-300 bg-gradient-to-r from-cyan-100 to-sky-50 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_0_22px_rgba(14,165,233,0.16)] dark:border-cyan-300/20 dark:from-cyan-500/28 dark:to-sky-500/12 dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_22px_rgba(34,211,238,0.12)]"
          : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-white hover:text-slate-800 dark:border-cyan-400/5 dark:bg-[#07182b]/70 dark:text-slate-500 dark:hover:bg-white/[0.04] dark:hover:text-slate-300"
      }`}
      aria-pressed={active}
    >
      {active ? <span className="absolute inset-0 bg-[radial-gradient(circle_at_28%_10%,rgba(34,211,238,0.20),transparent_45%)]" /> : null}
      <span className="relative flex items-center justify-center gap-1.5 sm:gap-2">
        <span
          className={`flex h-5 w-5 items-center justify-center transition sm:h-6 sm:w-6 ${
            active ? "text-cyan-600 dark:text-cyan-300" : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
          }`}
        >
          {icon}
        </span>
        {children}
      </span>
    </button>
  );
}

function CoveredWarrantSubNav() {
  return (
    <div className="sticky top-[58px] z-40 bg-slate-50/95 px-2 pb-2 backdrop-blur-xl dark:bg-[#07111f]/95 sm:top-[64px] sm:px-4">
      <div className="mx-auto w-full max-w-7xl overflow-hidden rounded-b-2xl border-x border-b border-sky-200 bg-white/90 dark:border-cyan-400/10 dark:bg-[#061323]/95">
        <div className="grid grid-cols-2">
          <span className="relative inline-flex min-h-11 items-center justify-center px-4 text-sm font-semibold text-cyan-100">
            So sánh
            <span className="absolute bottom-0 h-0.5 w-1/2 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.9)]" />
          </span>
          <span className="inline-flex min-h-11 items-center justify-center px-4 text-sm font-semibold text-slate-500">
            Tìm mã cơ sở
          </span>
        </div>
      </div>
    </div>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M5 19V9" strokeLinecap="round" />
      <path d="M12 19V5" strokeLinecap="round" />
      <path d="M19 19v-8" strokeLinecap="round" />
    </svg>
  );
}

function CertificateIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5" />
      <path d="M9.5 13h5" />
      <path d="M9.5 16.5h3" />
      <circle cx="16.5" cy="17" r="2.2" />
      <path d="m15.3 19.1-.6 1.5 1.8-.7 1.8.7-.6-1.5" />
    </svg>
  );
}
