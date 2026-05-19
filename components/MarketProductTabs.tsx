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
      <div className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1.5 shadow-sm shadow-slate-200/60 backdrop-blur dark:border-cyan-400/10 dark:bg-[#07111f]/90 dark:shadow-black/20">
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

      <div hidden={activeProduct !== "stocks"}>{stocks}</div>
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
      className={`group relative min-h-12 overflow-hidden rounded-xl px-3 text-sm font-semibold transition sm:min-h-[52px] ${
        active
          ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-cyan-500/20 dark:from-emerald-400 dark:to-cyan-400 dark:text-slate-950"
          : "text-slate-500 hover:bg-white/70 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
      }`}
      aria-pressed={active}
    >
      {active ? <span className="absolute inset-0 bg-white/10 opacity-70" /> : null}
      <span className="relative flex items-center justify-center gap-2">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
            active
              ? "bg-white/20 text-white dark:bg-slate-950/10 dark:text-slate-950"
              : "bg-slate-200/70 text-slate-500 group-hover:text-slate-800 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:text-white"
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
    <div className="sticky top-[78px] z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">
        <span className="inline-flex min-h-9 items-center rounded-full bg-cyan-50 px-4 text-sm font-semibold text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:ring-cyan-900">
          So sánh
        </span>
        <span className="inline-flex min-h-9 items-center rounded-full px-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Tìm mã cơ sở
        </span>
      </div>
    </div>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 16v-5" />
      <path d="M12 16V8" />
      <path d="M16 16v-3" />
    </svg>
  );
}

function CertificateIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 3h8l4 4v14H7z" />
      <path d="M15 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
  );
}
