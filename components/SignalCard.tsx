import type { SignalCardData, SignalTone } from "@/types/stock";

const toneStyles: Record<SignalTone, string> = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-900",
  neutral: "border-slate-200 bg-white text-slate-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  negative: "border-rose-200 bg-rose-50 text-rose-900",
};

export function SignalCard({ signal }: { signal: SignalCardData }) {
  return (
    <article className={`rounded-lg border p-4 shadow-sm ${toneStyles[signal.tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-normal text-slate-500">
            {signal.title}
          </p>
          <h3 className="mt-1 text-lg font-semibold">{signal.label}</h3>
        </div>
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-current" aria-hidden />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{signal.detail}</p>
    </article>
  );
}
