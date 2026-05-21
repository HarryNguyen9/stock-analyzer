"use client";

import { useRouter } from "next/navigation";

export function BackButton({ label }: { label: string }) {
  const router = useRouter();

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={label}
      className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-cyan-300/10 bg-white/5 px-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/30 hover:bg-cyan-300/10"
    >
      <span aria-hidden="true" className="text-lg leading-none">
        ←
      </span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
