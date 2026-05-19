import type { MarketAlert } from "@/lib/alerts/generate-alerts";
import type { MarketBreadthSnapshot } from "@/lib/market/breadth";
import { readSnapshotHistoryPair } from "@/lib/market/snapshot-history";
import type { ScannerGroup } from "@/lib/scanner/groups";
import type { SectorSummary } from "@/lib/sector/heatmap";
import type { Json } from "@/lib/supabase/types";

export type MarketMood = "bullish" | "neutral" | "bearish" | "mixed";
export type MarketComparisonStatus = "improved" | "weakened" | "unchanged";

export type MarketNarrative = {
  marketMood: MarketMood;
  headlineVi: string;
  summaryVi: string;
  keyDrivers: string[];
  riskNotes: string[];
  leadingSectors: string[];
  weakSectors: string[];
  comparison: {
    status: MarketComparisonStatus;
    comparisonNotesVi: string[];
  };
};

export async function buildMarketNarrative(input: {
  breadth: MarketBreadthSnapshot | null;
  sectors: SectorSummary[];
  scannerGroups: ScannerGroup[] | null;
  alerts: MarketAlert[];
}): Promise<MarketNarrative> {
  const [breadthHistory, sectorHistory, scannerHistory, alertHistory] = await Promise.all([
    readSnapshotHistoryPair("market_breadth"),
    readSnapshotHistoryPair("sector_heatmap"),
    readSnapshotHistoryPair("home_scanner"),
    readSnapshotHistoryPair("market_alerts"),
  ]);

  return createMarketNarrative({
    ...input,
    previousBreadth: parseBreadth(breadthHistory.previous),
    previousSectors: parseSectors(sectorHistory.previous),
    previousScannerMetrics: parseScannerMetrics(scannerHistory.previous),
    previousAlertCount: parseAlertCount(alertHistory.previous),
  });
}

export function createMarketNarrative(input: {
  breadth: MarketBreadthSnapshot | null;
  sectors: SectorSummary[];
  scannerGroups: ScannerGroup[] | null;
  alerts: MarketAlert[];
  previousBreadth?: MarketBreadthSnapshot | null;
  previousSectors?: Array<Pick<SectorSummary, "sector" | "averageChangePercent" | "averageTechnicalScore">>;
  previousScannerMetrics?: { breakoutCount: number; averageScore: number } | null;
  previousAlertCount?: number | null;
}): MarketNarrative {
  const breadth = input.breadth;
  const sectors = input.sectors;
  const leadingSectors = sectors
    .filter((sector) => sector.averageChangePercent > 0)
    .slice(0, 3)
    .map((sector) => sector.sector);
  const weakSectors = [...sectors]
    .sort((a, b) => a.averageChangePercent - b.averageChangePercent)
    .filter((sector) => sector.averageChangePercent < 0)
    .slice(0, 3)
    .map((sector) => sector.sector);
  const breakoutCount = getScannerGroupCount(input.scannerGroups, "breakout");
  const riskCount = getScannerGroupCount(input.scannerGroups, "riskWarning");
  const bullishAlerts = input.alerts.filter((alert) => alert.severity === "bullish").length;
  const bearishAlerts = input.alerts.filter((alert) => alert.severity === "bearish" || alert.severity === "warning").length;
  const mood = getMarketMood({ breadth, breakoutCount, riskCount, bullishAlerts, bearishAlerts });
  const comparison = compareMarketState({
    breadth,
    previousBreadth: input.previousBreadth ?? null,
    sectors,
    previousSectors: input.previousSectors ?? [],
    breakoutCount,
    previousScannerMetrics: input.previousScannerMetrics ?? null,
    alertCount: input.alerts.length,
    previousAlertCount: input.previousAlertCount ?? null,
  });
  const keyDrivers = buildKeyDrivers({ breadth, leadingSectors, breakoutCount, bullishAlerts, comparisonNotes: comparison.comparisonNotesVi });
  const riskNotes = buildRiskNotes({ breadth, weakSectors, riskCount, bearishAlerts });

  return {
    marketMood: mood,
    headlineVi: buildHeadline(mood, leadingSectors, weakSectors, breadth),
    summaryVi: buildSummary(mood, breadth, breakoutCount, riskCount, leadingSectors),
    keyDrivers,
    riskNotes,
    leadingSectors,
    weakSectors,
    comparison,
  };
}

function getMarketMood(input: {
  breadth: MarketBreadthSnapshot | null;
  breakoutCount: number;
  riskCount: number;
  bullishAlerts: number;
  bearishAlerts: number;
}): MarketMood {
  const breadth = input.breadth;

  if (!breadth || breadth.totalSymbols === 0) return "neutral";

  const broadStrength = breadth.advancers > breadth.decliners * 1.25 && breadth.percentAboveSMA20 >= 50;
  const broadWeakness = breadth.decliners > breadth.advancers * 1.25 || breadth.percentAboveSMA20 < 35;

  if (broadStrength && input.breakoutCount >= input.riskCount && input.bullishAlerts >= input.bearishAlerts) {
    return "bullish";
  }

  if (broadWeakness && input.riskCount >= input.breakoutCount) {
    return "bearish";
  }

  if ((broadStrength && input.riskCount > input.breakoutCount) || (broadWeakness && input.breakoutCount > 0)) {
    return "mixed";
  }

  return "neutral";
}

function buildHeadline(
  mood: MarketMood,
  leadingSectors: string[],
  weakSectors: string[],
  breadth: MarketBreadthSnapshot | null,
): string {
  const leaders = formatSectorList(leadingSectors);

  if (mood === "bullish") {
    return leaders
      ? `Thị trường nghiêng tích cực, dòng tiền tập trung ở ${leaders}`
      : "Thị trường nghiêng tích cực, độ rộng đang cải thiện";
  }

  if (mood === "bearish") {
    return "Độ rộng suy yếu, ưu tiên quan sát rủi ro lan rộng";
  }

  if (mood === "mixed") {
    return leaders
      ? `Tín hiệu phân hóa, nhóm mạnh tập trung ở ${leaders}`
      : "Tín hiệu phân hóa, thị trường chưa đồng thuận";
  }

  if (weakSectors.length > leadingSectors.length && breadth && breadth.decliners > breadth.advancers) {
    return "Thị trường thận trọng, số mã giảm đang chiếm ưu thế";
  }

  return "Thị trường cân bằng, chờ tín hiệu xác nhận rõ hơn";
}

function buildSummary(
  mood: MarketMood,
  breadth: MarketBreadthSnapshot | null,
  breakoutCount: number,
  riskCount: number,
  leadingSectors: string[],
): string {
  if (!breadth) {
    return "Chưa có đủ snapshot để dựng câu chuyện thị trường. Dữ liệu sẽ rõ hơn sau lần đồng bộ tiếp theo.";
  }

  const breadthText = `${breadth.advancers} mã tăng, ${breadth.decliners} mã giảm, ${breadth.percentAboveSMA20.toFixed(0)}% mã nằm trên MA20`;
  const sectorText = leadingSectors.length > 0 ? `Nhóm dẫn dắt hiện tại: ${formatSectorList(leadingSectors)}.` : "";
  const scannerText = `${breakoutCount} nhóm breakout đáng chú ý và ${riskCount} nhóm cảnh báo rủi ro.`;

  if (mood === "bullish") {
    return `${breadthText}. ${sectorText} ${scannerText}`.trim();
  }

  if (mood === "bearish") {
    return `${breadthText}. Rủi ro đang nổi bật hơn tín hiệu mở rộng, nên theo dõi độ rộng và phản ứng ở nhóm vốn hóa lớn.`;
  }

  return `${breadthText}. ${sectorText} Thị trường đang phân hóa, cần thêm xác nhận từ thanh khoản và breadth.`;
}

function buildKeyDrivers(input: {
  breadth: MarketBreadthSnapshot | null;
  leadingSectors: string[];
  breakoutCount: number;
  bullishAlerts: number;
  comparisonNotes: string[];
}): string[] {
  const drivers: string[] = [];

  if (input.breadth) {
    drivers.push(`A/D: ${input.breadth.advancers}/${input.breadth.decliners}, MA20 breadth ${input.breadth.percentAboveSMA20.toFixed(0)}%.`);
  }

  if (input.leadingSectors.length > 0) {
    drivers.push(`Ngành dẫn dắt: ${formatSectorList(input.leadingSectors)}.`);
  }

  if (input.breakoutCount > 0) {
    drivers.push(`${input.breakoutCount} tín hiệu breakout chất lượng cao trong scanner.`);
  }

  if (input.bullishAlerts > 0) {
    drivers.push(`${input.bullishAlerts} alert tích cực đang nổi bật.`);
  }

  return [...drivers, ...input.comparisonNotes].slice(0, 4);
}

function buildRiskNotes(input: {
  breadth: MarketBreadthSnapshot | null;
  weakSectors: string[];
  riskCount: number;
  bearishAlerts: number;
}): string[] {
  const notes: string[] = [];

  if (input.breadth && input.breadth.decliners > input.breadth.advancers) {
    notes.push("Số mã giảm đang nhiều hơn số mã tăng.");
  }

  if (input.weakSectors.length > 0) {
    notes.push(`Nhóm yếu: ${formatSectorList(input.weakSectors)}.`);
  }

  if (input.riskCount > 0) {
    notes.push(`${input.riskCount} nhóm cảnh báo rủi ro trong scanner.`);
  }

  if (input.bearishAlerts > 0) {
    notes.push(`${input.bearishAlerts} alert rủi ro/cảnh báo cần theo dõi.`);
  }

  return notes.slice(0, 3);
}

function compareMarketState(input: {
  breadth: MarketBreadthSnapshot | null;
  previousBreadth: MarketBreadthSnapshot | null;
  sectors: SectorSummary[];
  previousSectors: Array<Pick<SectorSummary, "sector" | "averageChangePercent" | "averageTechnicalScore">>;
  breakoutCount: number;
  previousScannerMetrics: { breakoutCount: number; averageScore: number } | null;
  alertCount: number;
  previousAlertCount: number | null;
}): MarketNarrative["comparison"] {
  const notes: string[] = [];
  let score = 0;

  if (input.breadth && input.previousBreadth) {
    const breadthDelta = input.breadth.percentAboveSMA20 - input.previousBreadth.percentAboveSMA20;
    const adDelta = input.breadth.advancers - input.previousBreadth.advancers;

    if (Math.abs(breadthDelta) >= 2) {
      score += breadthDelta > 0 ? 1 : -1;
      notes.push(breadthDelta > 0 ? "Breadth cải thiện so với snapshot trước." : "Breadth suy yếu so với snapshot trước.");
    }

    if (Math.abs(adDelta) >= 10) {
      score += adDelta > 0 ? 1 : -1;
      notes.push(adDelta > 0 ? "Số mã tăng mở rộng hơn phiên trước." : "Số mã tăng thu hẹp so với phiên trước.");
    }
  }

  if (input.previousScannerMetrics) {
    const breakoutDelta = input.breakoutCount - input.previousScannerMetrics.breakoutCount;

    if (breakoutDelta !== 0) {
      score += breakoutDelta > 0 ? 1 : -1;
      notes.push(breakoutDelta > 0 ? "Breakout tăng so với snapshot trước." : "Breakout giảm so với snapshot trước.");
    }
  }

  const sectorNote = compareSectorLeadership(input.sectors, input.previousSectors);

  if (sectorNote) {
    notes.push(sectorNote);
  }

  if (input.previousAlertCount !== null) {
    const alertDelta = input.alertCount - input.previousAlertCount;

    if (Math.abs(alertDelta) >= 2) {
      notes.push(alertDelta > 0 ? "Số alert đáng chú ý tăng." : "Số alert đáng chú ý giảm.");
    }
  }

  return {
    status: score > 0 ? "improved" : score < 0 ? "weakened" : "unchanged",
    comparisonNotesVi: notes.slice(0, 3),
  };
}

function compareSectorLeadership(
  sectors: SectorSummary[],
  previousSectors: Array<Pick<SectorSummary, "sector" | "averageChangePercent" | "averageTechnicalScore">>,
): string | null {
  const currentLeader = sectors[0]?.sector;
  const previousLeader = previousSectors[0]?.sector;

  if (currentLeader && previousLeader && currentLeader !== previousLeader) {
    return `Nhóm dẫn dắt chuyển từ ${previousLeader} sang ${currentLeader}.`;
  }

  return null;
}

function getScannerGroupCount(groups: ScannerGroup[] | null, id: string): number {
  return groups?.find((group) => group.id === id)?.items.length ?? 0;
}

function formatSectorList(sectors: string[]): string {
  return sectors.slice(0, 2).join(" và ");
}

function parseBreadth(value: Json | null): MarketBreadthSnapshot | null {
  if (!isRecord(value)) return null;

  const required = [
    "totalSymbols",
    "advancers",
    "decliners",
    "unchanged",
    "percentAboveSMA20",
    "percentAboveSMA50",
    "averageChangePercent",
    "medianChangePercent",
    "newHigh20",
    "newLow20",
  ];

  if (!required.every((key) => typeof value[key] === "number")) {
    return null;
  }

  return {
    totalSymbols: Number(value.totalSymbols),
    advancers: Number(value.advancers),
    decliners: Number(value.decliners),
    unchanged: Number(value.unchanged),
    advanceDeclineRatio: typeof value.advanceDeclineRatio === "number" ? value.advanceDeclineRatio : null,
    percentAboveSMA20: Number(value.percentAboveSMA20),
    percentAboveSMA50: Number(value.percentAboveSMA50),
    averageChangePercent: Number(value.averageChangePercent),
    medianChangePercent: Number(value.medianChangePercent),
    newHigh20: Number(value.newHigh20),
    newLow20: Number(value.newLow20),
  };
}

function parseSectors(value: Json | null): Array<Pick<SectorSummary, "sector" | "averageChangePercent" | "averageTechnicalScore">> {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .filter(
      (item) =>
        typeof item.sector === "string" &&
        typeof item.averageChangePercent === "number" &&
        typeof item.averageTechnicalScore === "number",
    )
    .map((item) => ({
      sector: item.sector as string,
      averageChangePercent: item.averageChangePercent as number,
      averageTechnicalScore: item.averageTechnicalScore as number,
    }));
}

function parseScannerMetrics(value: Json | null): { breakoutCount: number; averageScore: number } | null {
  if (!Array.isArray(value)) return null;

  let breakoutCount = 0;
  let scoreTotal = 0;
  let scoreCount = 0;

  for (const group of value) {
    if (!isRecord(group) || !Array.isArray(group.items)) continue;
    if (group.id === "breakout") breakoutCount = group.items.length;

    for (const item of group.items) {
      if (isRecord(item) && isRecord(item.stock) && typeof item.stock.score === "number") {
        scoreTotal += item.stock.score;
        scoreCount += 1;
      }
    }
  }

  return {
    breakoutCount,
    averageScore: scoreCount > 0 ? scoreTotal / scoreCount : 0,
  };
}

function parseAlertCount(value: Json | null): number | null {
  return Array.isArray(value) ? value.length : null;
}

function isRecord(value: unknown): value is Record<string, Json> {
  return typeof value === "object" && value !== null;
}
