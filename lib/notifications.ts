import type { Signal, SignalSentiment } from "@/lib/technical-analysis/types";
import { sortSignalsByPriority } from "@/lib/signals";
import type { StockSummary } from "@/types/stock";

export type NotificationType = "bullish" | "bearish" | "warning" | "info";

export type StockNotification = {
  id: string;
  symbol: string;
  title: string;
  message: string;
  signalLabel: string;
  type: NotificationType;
  priority: number;
  createdAt: string;
  href?: string;
  groupCount?: number;
};

type NotificationCandidate = {
  signal: Signal | null;
  title: string;
  message: string;
  signalLabel: string;
  type: NotificationType;
  priority: number;
};

const MIN_SIGNAL_PRIORITY = 80;
const MIN_SIGNAL_STRENGTH = 4;
const MAX_NOTIFICATIONS = 10;
const MAX_PER_SYMBOL = 2;

export function generateStockNotifications(stocks: StockSummary[]): StockNotification[] {
  const dedupe = new Set<string>();
  const notificationsBySymbol = new Map<string, StockNotification[]>();
  const highScoreNotifications: StockNotification[] = [];
  const breakoutNotifications: StockNotification[] = [];
  const riskNotifications: StockNotification[] = [];

  for (const stock of stocks) {
    if (stock.dataStatus !== "ready") {
      continue;
    }

    const createdAt = toCreatedAt(stock.latestDate);
    const dateKey = createdAt.slice(0, 10);
    const candidates = getNotificationCandidates(stock);

    for (const candidate of candidates) {
      const signalCode = candidate.signal?.code ?? "HIGH_TECHNICAL_SCORE";
      const dedupeKey = `${stock.symbol}:${signalCode}:${dateKey}`;

      if (dedupe.has(dedupeKey)) {
        continue;
      }

      dedupe.add(dedupeKey);
      const notification = {
        id: dedupeKey,
        symbol: stock.symbol,
        title: candidate.title,
        message: candidate.message,
        signalLabel: candidate.signalLabel,
        type: candidate.type,
        priority: candidate.priority,
        createdAt,
        href: `/stock/${stock.symbol}`,
      };
      const symbolNotifications = notificationsBySymbol.get(stock.symbol) ?? [];
      symbolNotifications.push(notification);
      notificationsBySymbol.set(stock.symbol, symbolNotifications);

      if (signalCode === "HIGH_TECHNICAL_SCORE") {
        highScoreNotifications.push(notification);
      }

      if (candidate.signal?.category === "breakout") {
        breakoutNotifications.push(notification);
      }

      if (candidate.type === "warning" || candidate.type === "bearish") {
        riskNotifications.push(notification);
      }
    }
  }

  const compactNotifications = [...notificationsBySymbol.values()]
    .flatMap((items) => items.sort(sortNotifications).slice(0, MAX_PER_SYMBOL))
    .sort(sortNotifications);
  const grouped = [
    createGroupNotification("breakout", breakoutNotifications),
    createGroupNotification("high-score", highScoreNotifications),
    createGroupNotification("risk", riskNotifications),
  ].filter((item): item is StockNotification => item !== null);

  return [...grouped, ...compactNotifications].sort(sortNotifications).slice(0, MAX_NOTIFICATIONS);
}

function getNotificationCandidates(stock: StockSummary): NotificationCandidate[] {
  const candidates: NotificationCandidate[] = [];
  const notableSignals = sortSignalsByPriority(stock.scannerSignals ?? []).filter(isNotableSignal);

  if (stock.score >= 80) {
    candidates.push({
      signal: null,
      title: `${stock.symbol} có điểm kỹ thuật cao`,
      message: `Điểm kỹ thuật ${stock.score}/100, trạng thái ${stock.status.toLowerCase()}.`,
      signalLabel: "Điểm kỹ thuật cao",
      type: "bullish",
      priority: 90,
    });
  }

  if (typeof stock.previousScore === "number" && stock.score - stock.previousScore >= 12) {
    candidates.push({
      signal: null,
      title: `${stock.symbol} cải thiện mạnh`,
      message: `Điểm kỹ thuật tăng từ ${stock.previousScore} lên ${stock.score}.`,
      signalLabel: "Score tăng mạnh",
      type: "bullish",
      priority: 88,
    });
  }

  for (const signal of notableSignals) {
    candidates.push({
      signal,
      title: `${stock.symbol}: ${signal.labelVi}`,
      message: signal.descriptionVi,
      signalLabel: signal.labelVi,
      type: toNotificationType(signal.sentiment),
      priority: signal.priority,
    });
  }

  return candidates;
}

function isNotableSignal(signal: Signal): boolean {
  if (signal.strength < MIN_SIGNAL_STRENGTH || signal.priority < MIN_SIGNAL_PRIORITY) {
    return false;
  }

  if (signal.code === "RSI_NEUTRAL_HEALTHY" || signal.code === "TREND_UP_MA20_MA50") {
    return false;
  }

  if (signal.category === "breakout") {
    return signal.sentiment !== "neutral" && signal.priority >= 90;
  }

  if (signal.category === "volume") {
    return signal.sentiment === "bullish" && signal.priority >= 86;
  }

  if (signal.category === "risk") {
    return signal.sentiment === "bearish" && signal.priority >= 90;
  }

  return signal.code === "GOLDEN_CROSS" || signal.code === "DEATH_CROSS";
}

function createGroupNotification(
  kind: "breakout" | "high-score" | "risk",
  notifications: StockNotification[],
): StockNotification | null {
  const uniqueSymbols = new Set(notifications.map((item) => item.symbol));

  if (uniqueSymbols.size < 3) {
    return null;
  }

  const latestCreatedAt = notifications
    .map((item) => item.createdAt)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  const config = {
    breakout: {
      title: `${uniqueSymbols.size} mã đang có tín hiệu breakout`,
      message: "Nhiều mã đang vượt vùng kỹ thuật quan trọng, ưu tiên kiểm tra thanh khoản xác nhận.",
      signalLabel: "Breakout",
      type: "bullish" as const,
      priority: 99,
    },
    "high-score": {
      title: `${uniqueSymbols.size} mã có điểm kỹ thuật cao`,
      message: "Nhóm cổ phiếu này đang có score từ 80 trở lên.",
      signalLabel: "Score cao",
      type: "bullish" as const,
      priority: 96,
    },
    risk: {
      title: `${uniqueSymbols.size} mã có cảnh báo rủi ro`,
      message: "Một số mã đang xuất hiện tín hiệu suy yếu mạnh, nên rà lại vị thế.",
      signalLabel: "Rủi ro",
      type: "warning" as const,
      priority: 98,
    },
  }[kind];

  return {
    id: `group:${kind}:${latestCreatedAt.slice(0, 10)}`,
    symbol: "MARKET",
    title: config.title,
    message: config.message,
    signalLabel: config.signalLabel,
    type: config.type,
    priority: config.priority,
    createdAt: latestCreatedAt,
    groupCount: uniqueSymbols.size,
  };
}

function sortNotifications(a: StockNotification, b: StockNotification): number {
  return (
    b.priority - a.priority ||
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
    typeRank(b.type) - typeRank(a.type)
  );
}

function typeRank(type: NotificationType): number {
  if (type === "bearish" || type === "warning") return 3;
  if (type === "bullish") return 2;
  return 1;
}

function toNotificationType(sentiment: SignalSentiment): NotificationType {
  if (sentiment === "bullish") return "bullish";
  if (sentiment === "bearish") return "warning";
  return "info";
}

function toCreatedAt(latestDate: string): string {
  const parsed = new Date(`${latestDate}T15:00:00+07:00`);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
}
