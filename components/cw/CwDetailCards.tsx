import type { ReactNode } from "react";
import type { CoveredWarrantWithMetrics } from "@/lib/cw/types";

type Tone = "neutral" | "positive" | "negative" | "warning" | "info";

export function CwOverviewTab({ warrant }: { warrant: CoveredWarrantWithMetrics }) {
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
            <CwMetricCard label="Giá cơ sở" value={formatPrice(warrant.underlyingPrice)} />
            <CwMetricCard label="Premium" value={formatPercent(warrant.metrics.premiumPercent)} tone={getPremiumTone(warrant.metrics.premiumPercent)} />
            <CwMetricCard label="Hòa vốn" value={formatPrice(warrant.metrics.breakEvenPrice)} />
            <CwMetricCard label="Đòn bẩy" value={formatRatio(warrant.metrics.gearing)} tone="info" />
            <CwMetricCard label="Còn lại" value={formatDays(warrant.metrics.daysToMaturity)} tone={getMaturityTone(warrant.metrics.daysToMaturity)} />
          </div>
        </div>
      </section>

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
}: {
  warrant: CoveredWarrantWithMetrics;
  related: CoveredWarrantWithMetrics[];
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
        </div>
      </CwSection>

      <CwSection title="So với các CW cùng mã cơ sở" subtitle={`Nhóm ${warrant.underlyingSymbol} hiện có ${related.length} mã active.`}>
        {related.length > 1 ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <KeyValue label="Xếp hạng thanh khoản" value={ranking.volumeRank} />
            <KeyValue label="Xếp hạng premium thấp" value={ranking.premiumRank} />
            <KeyValue label="Xếp hạng hòa vốn thấp" value={ranking.breakEvenRank} />
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

export function CwRiskTab({ warrant }: { warrant: CoveredWarrantWithMetrics }) {
  const risks = buildRiskCards(warrant);

  return (
    <CwSection title="Rủi ro cần chú ý" subtitle="Các cảnh báo này chỉ dựa trên dữ liệu chứng quyền hiện có, không phải khuyến nghị mua/bán.">
      <div className="grid gap-3">
        {risks.map((risk) => (
          <article key={risk.title} className={`rounded-2xl border p-4 ${getRiskCardClass(risk.tone)}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-white">{risk.title}</h3>
                <p className="mt-2 text-sm leading-6 opacity-85">{risk.description}</p>
              </div>
              <span className="shrink-0 rounded-full border border-current/20 px-2 py-1 text-[11px] font-bold">
                {risk.badge}
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

function buildRiskCards(warrant: CoveredWarrantWithMetrics): Array<{ title: string; description: string; badge: string; tone: Tone }> {
  const risks: Array<{ title: string; description: string; badge: string; tone: Tone }> = [];
  const premium = warrant.metrics.premiumPercent;
  const volume = warrant.volume ?? 0;
  const days = warrant.metrics.daysToMaturity;
  const spread = warrant.metrics.spreadPercent;
  const distance = getDistanceToBreakEvenPercent(warrant);

  if (premium === null) {
    risks.push({
      title: "Thiếu dữ liệu premium",
      description: "Nguồn hiện tại chưa đủ dữ liệu để đánh giá premium chính xác.",
      badge: "Dữ liệu",
      tone: "warning",
    });
  } else if (premium >= 30) {
    risks.push({
      title: "Premium cao",
      description: `Premium đang ở mức ${formatPercent(premium)}, cần thận trọng khi so với biến động mã cơ sở.`,
      badge: "Cao",
      tone: "negative",
    });
  }

  if (volume <= 0) {
    risks.push({
      title: "Chưa có thanh khoản",
      description: "Không thấy khối lượng giao dịch trong dữ liệu hiện tại.",
      badge: "Thanh khoản",
      tone: "negative",
    });
  } else if (volume < 10_000) {
    risks.push({
      title: "Thanh khoản thấp",
      description: `Khối lượng chỉ khoảng ${formatVolume(volume)}, có thể khó mua/bán ở giá mong muốn.`,
      badge: "Mỏng",
      tone: "warning",
    });
  }

  if (days > 0 && days <= 30) {
    risks.push({
      title: "Gần đáo hạn",
      description: `Còn ${days} ngày đến hạn, giá CW có thể nhạy với thời gian còn lại.`,
      badge: "Thời gian",
      tone: "warning",
    });
  }

  if (spread !== null && spread >= 10) {
    risks.push({
      title: "Spread rộng",
      description: `Spread ước tính ${formatPercent(spread)}, chi phí giao dịch có thể cao hơn bình thường.`,
      badge: "Spread",
      tone: "warning",
    });
  }

  if (distance !== null && distance > 20) {
    risks.push({
      title: "Xa điểm hòa vốn",
      description: `Giá cơ sở cần tăng/giảm thêm khoảng ${formatPercent(distance)} để tới vùng hòa vốn.`,
      badge: "Hòa vốn",
      tone: "warning",
    });
  }

  if (risks.length === 0) {
    risks.push({
      title: "Chưa có rủi ro nổi bật từ dữ liệu hiện tại",
      description: "Vẫn cần theo dõi thanh khoản, premium và biến động mã cơ sở trước khi ra quyết định.",
      badge: "Theo dõi",
      tone: "info",
    });
  }

  return risks;
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
