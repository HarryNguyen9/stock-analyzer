import type { CoveredWarrantRecord } from "@/lib/cw/types";

const issuerTemplates = [
  { code: "SSI", issuer: "SSI" },
  { code: "HSC", issuer: "HSC" },
  { code: "VND", issuer: "VNDIRECT" },
];

const underlyingTemplates = [
  { symbol: "FPT", price: 72.9, strikes: [68, 72, 78] },
  { symbol: "HPG", price: 26.55, strikes: [24, 26, 29] },
  { symbol: "STB", price: 49.2, strikes: [45, 49, 54] },
];

export const SAMPLE_COVERED_WARRANTS: CoveredWarrantRecord[] = underlyingTemplates.flatMap((underlying, underlyingIndex) =>
  issuerTemplates.map((issuer, issuerIndex) => {
    const strikePrice = underlying.strikes[issuerIndex] ?? underlying.price;
    const maturityDate = getFutureDate(90 + issuerIndex * 45 + underlyingIndex * 10);
    const intrinsic = Math.max(0, underlying.price - strikePrice) / 1.5;
    const timeValue = 0.42 + issuerIndex * 0.18 + underlyingIndex * 0.08;
    const lastPrice = roundPrice(Math.max(0.12, intrinsic + timeValue));

    return {
      symbol: `${underlying.symbol}${issuer.code}${issuerIndex + 1}`,
      underlyingSymbol: underlying.symbol,
      issuer: issuer.issuer,
      type: "call",
      strikePrice,
      exerciseRatio: 1.5,
      maturityDate,
      lastPrice,
      bid: roundPrice(Math.max(0.01, lastPrice - 0.03)),
      ask: roundPrice(lastPrice + 0.03),
      volume: 120_000 - issuerIndex * 24_000 + underlyingIndex * 8_000,
      openInterest: null,
      isActive: true,
      updatedAt: new Date().toISOString(),
      underlyingPrice: underlying.price,
    };
  }),
);

function getFutureDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}
