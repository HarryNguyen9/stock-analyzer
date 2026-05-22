export function getVietnamTradingDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isVietnamWeekday(now = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
  }).format(now);

  return weekday !== "Sat" && weekday !== "Sun";
}

export function isVietnamWeekend(now = new Date()): boolean {
  return !isVietnamWeekday(now);
}

export function getVietnamMinutesOfDay(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);

  return hour * 60 + minute;
}

export function isVietnamMarketIntradayWindow(now = new Date()): boolean {
  if (!isVietnamWeekday(now)) {
    return false;
  }

  const minutes = getVietnamMinutesOfDay(now);
  return minutes >= 9 * 60 && minutes < 15 * 60;
}

export function isVietnamAfterMarketClose(now = new Date()): boolean {
  if (!isVietnamWeekday(now)) {
    return false;
  }

  return getVietnamMinutesOfDay(now) >= 15 * 60;
}

export function getDailyCandleStorageState(date: string, now = new Date()): {
  isIntraday: boolean;
  finalized: boolean;
  source: "vnstock_daily" | "vnstock_daily_intraday";
  shouldStore: boolean;
} {
  const isToday = date === getVietnamTradingDate(now);
  const isIntradayWindow = isVietnamMarketIntradayWindow(now);
  const isAfterClose = isVietnamAfterMarketClose(now);
  const shouldKeepIntraday = isToday && isIntradayWindow;
  const shouldStore = !isToday || isIntradayWindow || isAfterClose;

  return {
    isIntraday: shouldKeepIntraday,
    finalized: !shouldKeepIntraday,
    source: shouldKeepIntraday ? "vnstock_daily_intraday" : "vnstock_daily",
    shouldStore,
  };
}
