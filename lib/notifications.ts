import type { Signal, SignalSentiment } from "@/lib/technical-analysis/types";
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
};

type NotificationCandidate = {
  signal: Signal | null;
  title: string;
  message: string;
  signalLabel: string;
  type: NotificationType;
  priority: number;
};

const MIN_SIGNAL_PRIORITY = 85;
const MIN_SIGNAL_STRENGTH = 4;

export function generateStockNotifications(stocks: StockSummary[]): StockNotification[] {
  const dedupe = new Set<string>();
  const notifications: StockNotification[] = [];

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
      notifications.push({
        id: dedupeKey,
        symbol: stock.symbol,
        title: candidate.title,
        message: candidate.message,
        signalLabel: candidate.signalLabel,
        type: candidate.type,
        priority: candidate.priority,
        createdAt,
      });
    }
  }

  return notifications.sort(sortNotifications);
}

function getNotificationCandidates(stock: StockSummary): NotificationCandidate[] {
  const candidates: NotificationCandidate[] = [];
  const notableSignals = (stock.scannerSignals ?? []).filter(isNotableSignal);

  if (stock.score >= 80) {
    candidates.push({
      signal: notableSignals[0] ?? null,
      title: `${stock.symbol} có điểm kỹ thuật cao`,
      message: `Điểm kỹ thuật ${stock.score}/100, trạng thái ${stock.status.toLowerCase()}.`,
      signalLabel: notableSignals[0]?.labelVi ?? "Điểm kỹ thuật cao",
      type: "bullish",
      priority: Math.max(90, notableSignals[0]?.priority ?? 0),
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
    return signal.sentiment !== "neutral";
  }

  if (signal.category === "volume") {
    return signal.sentiment === "bullish";
  }

  if (signal.category === "risk") {
    return signal.sentiment === "bearish";
  }

  return signal.code === "GOLDEN_CROSS" || signal.code === "DEATH_CROSS";
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
