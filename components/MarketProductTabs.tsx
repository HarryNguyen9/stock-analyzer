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
        <div className="mx-auto w-full max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
            <ProductButton active={activeProduct === "stocks"} onClick={() => selectProduct("stocks")}>
              Cổ phiếu
            </ProductButton>
            <ProductButton active={activeProduct === "covered-warrants"} onClick={() => selectProduct("covered-warrants")}>
              Chứng quyền
            </ProductButton>
          </div>
        </div>
      </div>

      <div hidden={activeProduct !== "stocks"}>{stocks}</div>
      <div hidden={activeProduct !== "covered-warrants"}>{coveredWarrants}</div>
    </>
  );
}

function ProductButton({
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
      className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition ${
        active
          ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white"
          : "text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
      }`}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

