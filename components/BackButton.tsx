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
      className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      <span aria-hidden="true" className="text-base leading-none">
        ⬅️
      </span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
