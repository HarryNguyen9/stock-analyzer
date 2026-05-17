import { vi } from "@/lib/i18n/vi";

type ScoreGaugeProps = {
  score: number;
  size?: "compact" | "large";
};

export function ScoreGauge({ score, size = "large" }: ScoreGaugeProps) {
  const color =
    score >= 70
      ? "text-emerald-600 dark:text-emerald-400"
      : score >= 45
        ? "text-amber-600 dark:text-amber-400"
        : "text-rose-600 dark:text-rose-400";
  const dimensions = size === "large" ? "h-28 w-28 text-3xl" : "h-16 w-16 text-lg";

  return (
    <div
      className={`grid ${dimensions} place-items-center rounded-full border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900`}
      style={{
        background: `conic-gradient(#059669 ${score * 3.6}deg, var(--score-track) 0deg)`,
      }}
      aria-label={vi.score.ariaLabel(score)}
    >
      <div className="grid h-[78%] w-[78%] place-items-center rounded-full bg-white dark:bg-slate-950">
        <span className={`font-semibold tabular-nums ${color}`}>{score}</span>
      </div>
    </div>
  );
}
