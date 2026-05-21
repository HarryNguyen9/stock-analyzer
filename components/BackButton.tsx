"use client";

import { useRouter } from "next/navigation";

export function BackButton({ label }: { label: string }) {
  const router = useRouter();

  function handleBack() {
    router.push("/?tab=search");
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={label}
      className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-cyan-300 hover:bg-sky-50 dark:border-cyan-300/10 dark:bg-white/5 dark:text-cyan-100 dark:hover:border-cyan-300/30 dark:hover:bg-cyan-300/10"
    >
      <span aria-hidden="true" className="text-lg leading-none">
        ←
      </span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
