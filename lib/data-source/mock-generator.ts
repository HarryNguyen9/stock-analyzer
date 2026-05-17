import type { OHLCV, StockSymbol } from "@/types/stock";

const BASE_PRICE_BY_SYMBOL: Record<StockSymbol, number> = {
  FPT: 118,
  HPG: 29,
  MWG: 62,
  VCB: 91,
  TCB: 34,
  MBB: 26,
  ACB: 25,
  SSI: 36,
  VND: 18,
  VNM: 68,
  GAS: 78,
  MSN: 74,
  VIC: 44,
  VHM: 39,
  VRE: 21,
  PVS: 38,
  SHS: 19,
  HUT: 17,
  BSR: 23,
  ACV: 86,
};

export function generateMockOHLCV(symbol: string, candles = 200): OHLCV[] {
  const random = seededRandom(symbol);
  const dates = getTradingDates(candles);
  const basePrice = getBasePrice(symbol);
  const trendBias = random() * 0.18 - 0.06;
  const volatility = 0.012 + random() * 0.025;
  let close = basePrice * (0.88 + random() * 0.24);

  return dates.map((date, index) => {
    const cycle = Math.sin(index / (13 + random() * 9)) * volatility * 0.7;
    const drift = trendBias / candles + cycle;
    const shock = (random() - 0.5) * volatility * 2.2;
    const open = close * (1 + (random() - 0.5) * volatility);

    close = Math.max(1, open * (1 + drift + shock));
    const high = Math.max(open, close) * (1 + random() * volatility);
    const low = Math.min(open, close) * (1 - random() * volatility);
    const volumeBase = 850_000 + random() * 4_500_000;
    const volumePulse = 1 + Math.abs(shock) * 26 + Math.max(cycle, 0) * 10;

    return {
      date,
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume: Math.round(volumeBase * volumePulse),
    };
  });
}

function getBasePrice(symbol: string): number {
  return isKnownStockSymbol(symbol) ? BASE_PRICE_BY_SYMBOL[symbol] : 30 + seededRandom(symbol)() * 70;
}

function isKnownStockSymbol(symbol: string): symbol is StockSymbol {
  return symbol in BASE_PRICE_BY_SYMBOL;
}

function getTradingDates(count: number): string[] {
  const dates: string[] = [];
  const date = new Date(Date.UTC(2026, 4, 15));

  while (dates.length < count) {
    const day = date.getUTCDay();

    if (day !== 0 && day !== 6) {
      dates.push(date.toISOString().slice(0, 10));
    }

    date.setUTCDate(date.getUTCDate() - 1);
  }

  return dates.reverse();
}

function seededRandom(seedText: string): () => number {
  let seed = [...seedText].reduce((total, char) => total + char.charCodeAt(0), 0) * 2654435761;

  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
