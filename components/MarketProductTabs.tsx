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
      <div className="sticky top-0 z-50 border-b border-cyan-400/10 bg-[#07111f]/95 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-cyan-400/15 bg-[#0b1b31]/80 p-1.5 shadow-[0_18px_60px_rgba(2,8,23,0.28)] ring-1 ring-white/5">
            <div className="grid grid-cols-2 gap-2">
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

      <div className="bg-slate-50 dark:bg-[#07111f]" hidden={activeProduct !== "stocks"}>{stocks}</div>
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
      className={`group relative min-h-14 overflow-hidden rounded-xl border px-3 text-base font-semibold transition sm:min-h-[58px] ${
        active
          ? "border-cyan-300/50 bg-gradient-to-r from-cyan-500/35 to-emerald-400/25 text-white shadow-[0_0_34px_rgba(34,211,238,0.20)]"
          : "border-transparent text-slate-400 hover:bg-white/5 hover:text-white"
      }`}
      aria-pressed={active}
    >
      {active ? <span className="absolute inset-0 bg-white/10 opacity-70" /> : null}
      <span className="relative flex items-center justify-center gap-2">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
            active
              ? "bg-cyan-300/15 text-cyan-100"
              : "bg-white/5 text-slate-400 group-hover:text-white"
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
    <div className="sticky top-[85px] z-40 border-b border-cyan-400/10 bg-[#07111f]/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl gap-3 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="inline-flex min-h-9 items-center rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 text-sm font-semibold text-cyan-200">
          So sánh
        </span>
        <span className="inline-flex min-h-9 items-center rounded-full px-4 text-sm font-semibold text-slate-400">
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
