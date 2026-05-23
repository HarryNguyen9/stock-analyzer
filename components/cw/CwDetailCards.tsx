import type { ReactNode } from "react";
import type { CoveredWarrantAnalysis } from "@/lib/cw/cw-analysis";
import type { CoveredWarrantWithMetrics } from "@/lib/cw/types";

type Tone = "neutral" | "positive" | "negative" | "warning" | "info";

export function CwOverviewTab({ warrant, analysis }: { warrant: CoveredWarrantWithMetrics; analysis: CoveredWarrantAnalysis }) {
  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-cyan-300/15 bg-[#091a31]/95 p-4 shadow-[0_18px_56px_rgba(0,0,0,0.18)] ring-1 ring-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_92%_10%,rgba(34,211,238,0.16),transparent_28%),linear-gradient(135deg,rgba(14,165,233,0.08),transparent_46%)] opacity-80" />
        <div className="relative z-10 grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <CwMetricCard label="Giá CW" value={formatPrice(warrant.lastPrice)} tone="info" prominent />
            <CwMetricCard
              label="Biến động"
              value={formatSignedPercent(warrant.changePercent)}
              tone={(warrant.changePercent ?? 0) < 0 ? "negative" : "positive"}
              prominent
            />
          </div>
          <div className="grid grid-cols-2 gap-2 min-[390px]:grid-cols-3">
            <CwMetricCard label="Khối lượng" value={formatVolume(warrant.volume)} tone="info" />
            <CwMetricCard label="CW Score" value={`${analysis.cwScore}/100`} tone={analysis.riskLevel === "high" ? "warning" : "positive"} />
            <CwMetricCard label="Premium" value={formatPercent(warrant.metrics.premiumPercent)} tone={getPremiumTone(warrant.metrics.premiumPercent)} />
            <CwMetricCard label="Hòa vốn" value={formatPrice(warrant.metrics.breakEvenPrice)} />
            <CwMetricCard label="Cần tăng để hòa vốn" value={formatPercent(analysis.distanceToBreakEvenPercent)} tone={getDistanceTone(warrant)} />
            <CwMetricCard label="Còn lại" value={formatDays(warrant.metrics.daysToMaturity)} tone={getMaturityTone(warrant.metrics.daysToMaturity)} />
          </div>
        </div>
      </section>

      <CwSection title="Luận điểm CW" subtitle="Đánh giá tương đối trong nhóm cùng mã cơ sở, không phải khuyến nghị mua/bán.">
        <div className="rounded-2xl border border-cyan-300/15 bg-[#061326] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${getRiskBadgeClass(analysis.riskLevel)}`}>
              {analysis.scoreLabelVi}
            </span>
            <span className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-100">
              Độ hấp dẫn tương đối {analysis.cwScore}/100
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">{analysis.summaryVi}</p>
        </div>
      </CwSection>

      <CwSection title="Thông tin nhanh" subtitle="Các thông tin chính của chứng quyền đang chọn.">
        <div className="grid gap-3 sm:grid-cols-2">
          <KeyValue label="Mã cơ sở" value={warrant.underlyingSymbol} />
          <KeyValue label="Tổ chức phát hành" value={warrant.issuer} />
          <KeyValue label="Loại quyền" value={formatType(warrant.type)} />
          <KeyValue label="Nguồn dữ liệu" value={formatSource(warrant.source)} />
        </div>
      </CwSection>
    </div>
  );
}

export function CwContractTab({ warrant }: { warrant: CoveredWarrantWithMetrics }) {
  return (
    <CwSection title="Thông tin hợp đồng" subtitle="Những field chưa có từ nguồn hiện tại sẽ được ghi rõ thay vì giả lập.">
      <div className="grid gap-3 sm:grid-cols-2">
        <KeyValue label="Mã CW" value={warrant.symbol} />
        <KeyValue label="Loại quyền" value={formatType(warrant.type)} />
        <KeyValue label="Mã cơ sở" value={warrant.underlyingSymbol} />
        <KeyValue label="Tổ chức phát hành" value={warrant.issuer} />
        <KeyValue label="Giá thực hiện" value={formatPrice(warrant.strikePrice)} emptyText="Chưa hỗ trợ từ nguồn hiện tại" />
        <KeyValue label="Tỷ lệ chuyển đổi" value={formatNullableNumber(warrant.exerciseRatio)} emptyText="Chưa hỗ trợ từ nguồn hiện tại" />
        <KeyValue label="Ngày phát hành" value={formatDate(warrant.issueDate)} emptyText="Chưa hỗ trợ từ nguồn hiện tại" />
        <KeyValue label="Ngày đáo hạn" value={formatDate(warrant.maturityDate)} emptyText="Chưa hỗ trợ từ nguồn hiện tại" />
        <KeyValue label="Ngày giao dịch cuối" value={getRawText(warrant, ["lastTradingDateText"])} emptyText="Chưa có dữ liệu" />
        <KeyValue label="Số ngày còn lại" value={formatDays(warrant.metrics.daysToMaturity)} />
        <KeyValue label="Kiểu thực hiện" value={getRawText(warrant, ["exerciseStyle", "exercise_style"])} emptyText="Chưa hỗ trợ từ nguồn hiện tại" />
        <KeyValue label="Phương thức thanh toán" value={getRawText(warrant, ["settlementMethod", "settlement_method"])} emptyText="Chưa hỗ trợ từ nguồn hiện tại" />
        <KeyValue label="Số lượng phát hành" value={getRawText(warrant, ["issueQuantity", "listedQuantity", "listed_quantity"])} emptyText="Chưa hỗ trợ từ nguồn hiện tại" />
        <KeyValue label="Cập nhật" value={formatDateTime(warrant.updatedAt)} />
      </div>
    </CwSection>
  );
}

export function CwPricingTab({
  warrant,
  related,
  analysis,
}: {
  warrant: CoveredWarrantWithMetrics;
  related: CoveredWarrantWithMetrics[];
  analysis: CoveredWarrantAnalysis;
}) {
  const ranking = buildRanking(warrant, related);

  return (
    <div className="space-y-5">
      <CwSection title="Định giá / So sánh" subtitle="So sánh nhanh trong nhóm CW cùng mã cơ sở, dựa trên dữ liệu đang có.">
        <div className="grid gap-3 sm:grid-cols-2">
          <CwMetricCard label="Premium" value={formatPercent(warrant.metrics.premiumPercent)} tone={getPremiumTone(warrant.metrics.premiumPercent)} />
          <CwMetricCard label="Hòa vốn" value={formatPrice(warrant.metrics.breakEvenPrice)} />
          <CwMetricCard label="Đòn bẩy" value={formatRatio(warrant.metrics.gearing)} tone="info" />
          <CwMetricCard label="Spread" value={formatPercent(warrant.metrics.spreadPercent)} emptyText="Chưa có bid/ask" />
          <CwMetricCard label="Thanh khoản" value={formatVolume(warrant.volume)} tone="info" />
          <CwMetricCard label="Khoảng cách tới hòa vốn" value={formatDistanceToBreakEven(warrant)} tone={getDistanceTone(warrant)} />
          <CwMetricCard label="CW Score" value={`${analysis.cwScore}/100`} tone={analysis.riskLevel === "high" ? "warning" : "positive"} />
        </div>
      </CwSection>

       <CwSection title="So với các CW cùng mã cơ sở" subtitle={`Nhóm ${warrant.underlyingSymbol} hiện có ${related.length} mã đang giao dịch.`}>
        {related.length > 1 ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <KeyValue label="Premium rank" value={formatRank(analysis.premiumRankWithinUnderlying, related.length, ranking.premiumRank)} />
            <KeyValue label="Hòa vốn rank" value={formatRank(analysis.breakEvenRankWithinUnderlying, related.length, ranking.breakEvenRank)} />
            <KeyValue label="Thanh khoản rank" value={formatRank(analysis.liquidityRankWithinUnderlying, related.length, ranking.volumeRank)} />
            <KeyValue label="Đòn bẩy rank" value={formatRank(analysis.leverageRankWithinUnderlying, related.length)} />
            <KeyValue label="Spread rank" value={formatRank(analysis.spreadRankWithinUnderlying, related.length)} />
            <KeyValue label="Định giá" value={formatBucket(analysis.valuationBucket)} />
          </div>
        ) : (
          <p className="rounded-2xl border border-cyan-300/10 bg-[#061326] p-4 text-sm leading-6 text-slate-400">
            Chưa đủ dữ liệu cùng mã cơ sở để xếp hạng tương đối.
          </p>
        )}
      </CwSection>
    </div>
  );
}

export function CwRiskTab({ analysis }: { analysis: CoveredWarrantAnalysis }) {
  const risks = analysis.riskCards;

  return (
    <CwSection title="Rủi ro cần chú ý" subtitle="Các cảnh báo này chỉ dựa trên dữ liệu chứng quyền hiện có, không phải khuyến nghị mua/bán.">
      <div className="grid gap-3">
        {risks.map((risk) => (
          <article key={risk.title} className={`rounded-2xl border p-4 ${getRiskCardClass(getRiskTone(risk.level))}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-white">{risk.title}</h3>
                <p className="mt-2 text-sm leading-6 opacity-85">{risk.description}</p>
              </div>
              <span className="shrink-0 rounded-full border border-current/20 px-2 py-1 text-[11px] font-bold">
                {formatRiskLevel(risk.level)}
              </span>
            </div>
          </article>
        ))}
      </div>
    </CwSection>
  );
}

export function CwSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-cyan-300/10 bg-[#09152c]/95 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] ring-1 ring-white/5">
      <div>
        <h2 className="text-lg font-black text-white">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-400">{subtitle}</p> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function CwMetricCard({
  label,
  value,
  tone = "neutral",
  prominent = false,
  emptyText = "—",
}: {
  label: string;
  value: string | null;
  tone?: Tone;
  prominent?: boolean;
  emptyText?: string;
}) {
  const normalizedValue = value && value !== "—" ? value : emptyText;

  return (
    <article className={`relative overflow-hidden rounded-2xl border p-3 ${prominent ? "min-h-28" : "min-h-24"} ${getMetricToneClass(tone)}`}>
      <div className="absolute bottom-2 right-2 h-12 w-20 rounded-full bg-cyan-300/10 blur-2xl" />
      <div className="relative z-10">
        <p className="text-xs text-slate-400">{label}</p>
        <p className={`${prominent ? "text-3xl" : "text-xl"} mt-2 break-words font-black leading-none tracking-tight text-white`}>
          {normalizedValue}
        </p>
      </div>
    </article>
  );
}

function KeyValue({
  label,
  value,
  emptyText = "Chưa có dữ liệu",
}: {
  label: string;
  value: string | number | null | undefined;
  emptyText?: string;
}) {
  const displayValue = value === null || value === undefined || value === "" || value === "—" ? emptyText : String(value);

  return (
    <div className="rounded-2xl border border-cyan-300/10 bg-[#061326] p-4">
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className="mt-2 break-words text-base font-black text-white">{displayValue}</p>
    </div>
  );
}

function formatRank(rank: number | null, total: number, fallback?: string): string {
  if (rank) return `${rank}/${total}`;
  return fallback ?? "Chưa có dữ liệu";
}

function formatBucket(bucket: CoveredWarrantAnalysis["valuationBucket"]): string {
  if (bucket === "low") return "Tương đối dễ chịu";
  if (bucket === "medium") return "Trung tính";
  if (bucket === "high") return "Cần theo dõi";
  return "Chưa đủ dữ liệu";
}

function formatRiskLevel(level: "low" | "medium" | "high"): string {
  if (level === "high") return "Cao";
  if (level === "medium") return "Trung bình";
  return "Thấp";
}

function getRiskTone(level: "low" | "medium" | "high"): Tone {
  if (level === "high") return "negative";
  if (level === "medium") return "warning";
  return "info";
}

function getRiskBadgeClass(level: "low" | "medium" | "high"): string {
  if (level === "high") return "border border-rose-300/25 bg-rose-400/10 text-rose-100";
  if (level === "medium") return "border border-amber-300/25 bg-amber-400/10 text-amber-100";
  return "border border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
}

function buildRanking(warrant: CoveredWarrantWithMetrics, related: CoveredWarrantWithMetrics[]) {
  const total = related.length;
  const volumeRank = rankBy(related, warrant.symbol, (item) => item.volume ?? -1, "desc");
  const premiumRank = rankBy(
    related.filter((item) => item.metrics.premiumPercent !== null),
    warrant.symbol,
    (item) => item.metrics.premiumPercent ?? Number.POSITIVE_INFINITY,
    "asc",
  );
  const breakEvenRank = rankBy(
    related.filter((item) => item.metrics.breakEvenPrice !== null),
    warrant.symbol,
    (item) => item.metrics.breakEvenPrice ?? Number.POSITIVE_INFINITY,
    "asc",
  );

  return {
    volumeRank: volumeRank ? `${volumeRank}/${total}` : "Chưa có dữ liệu",
    premiumRank: premiumRank ? `${premiumRank}/${total}` : "Chưa có dữ liệu",
    breakEvenRank: breakEvenRank ? `${breakEvenRank}/${total}` : "Chưa có dữ liệu",
  };
}

function rankBy(
  items: CoveredWarrantWithMetrics[],
  symbol: string,
  selector: (item: CoveredWarrantWithMetrics) => number,
  direction: "asc" | "desc",
): number | null {
  const sorted = [...items].sort((a, b) => {
    const diff = selector(a) - selector(b);
    return direction === "asc" ? diff : -diff;
  });
  const index = sorted.findIndex((item) => item.symbol === symbol);
  return index >= 0 ? index + 1 : null;
}

function getRawText(warrant: CoveredWarrantWithMetrics, keys: string[]): string | null {
  const raw = warrant.raw;
  if (!raw) return null;

  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" || typeof value === "number") return String(value);
  }

  const detail = raw.detail;
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const detailRecord = detail as Record<string, unknown>;
    for (const key of keys) {
      const value = detailRecord[key];
      if (typeof value === "string" || typeof value === "number") return String(value);
    }
  }

  return null;
}

function getDistanceToBreakEvenPercent(warrant: CoveredWarrantWithMetrics): number | null {
  const breakEven = warrant.metrics.breakEvenPrice;
  const underlying = warrant.underlyingPrice;
  if (!breakEven || !underlying) return null;

  return Math.abs((breakEven - underlying) / underlying) * 100;
}

function formatDistanceToBreakEven(warrant: CoveredWarrantWithMetrics): string {
  return formatPercent(getDistanceToBreakEvenPercent(warrant));
}

function getMetricToneClass(tone: Tone): string {
  if (tone === "positive") return "border-emerald-300/20 bg-emerald-400/10 text-emerald-100";
  if (tone === "negative") return "border-rose-300/20 bg-rose-400/10 text-rose-100";
  if (tone === "warning") return "border-amber-300/20 bg-amber-400/10 text-amber-100";
  if (tone === "info") return "border-cyan-300/20 bg-cyan-400/10 text-cyan-100";
  return "border-cyan-300/10 bg-[#061326] text-slate-100";
}

function getRiskCardClass(tone: Tone): string {
  if (tone === "negative") return "border-rose-300/25 bg-rose-400/10 text-rose-100";
  if (tone === "warning") return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  return "border-cyan-300/20 bg-cyan-400/10 text-cyan-100";
}

function getPremiumTone(value: number | null): Tone {
  if (value === null) return "warning";
  if (value <= 5) return "positive";
  if (value >= 30) return "negative";
  if (value >= 20) return "warning";
  return "neutral";
}

function getMaturityTone(days: number): Tone {
  if (days > 0 && days <= 30) return "warning";
  return "neutral";
}

function getDistanceTone(warrant: CoveredWarrantWithMetrics): Tone {
  const value = getDistanceToBreakEvenPercent(warrant);
  if (value === null) return "warning";
  if (value <= 5) return "positive";
  if (value >= 20) return "warning";
  return "neutral";
}

export function formatPrice(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(2)}%`;
}

export function formatSignedPercent(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatVolume(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-US");
}

function formatRatio(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(2)}x`;
}

function formatNullableNumber(value: number | null): string {
  return value === null ? "—" : value.toString();
}

function formatDays(value: number): string {
  if (!value) return "—";
  return `${value} ngày`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatType(value: string | null): string {
  if (!value) return "Chưa có dữ liệu";
  return value.toUpperCase();
}

function formatSource(value: string | null): string {
  if (!value) return "Supabase";
  return value === "24hmoney" ? "24HMoney / Supabase" : value;
}
