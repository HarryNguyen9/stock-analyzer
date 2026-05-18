"use client";

import { useState } from "react";
import { vi } from "@/lib/i18n/vi";

type SyncState = "idle" | "loading" | "success" | "error";

type TriggerSyncResponse = {
  ok: boolean;
  message: string;
  triggeredAt?: string;
};

export function ManualSyncButton() {
  const [state, setState] = useState<SyncState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function triggerSync(adminSecret?: string) {
    setState("loading");
    setMessage(null);

    try {
      const response = await fetch("/api/admin/trigger-sync", {
        method: "POST",
        headers: {
          ...(adminSecret ? { "x-admin-sync-secret": adminSecret } : {}),
        },
      });

      if (response.status === 401 && !adminSecret) {
        const secret = window.prompt(vi.home.manualSync.secretPrompt);

        if (secret) {
          await triggerSync(secret);
          return;
        }
      }

      const payload = (await response.json()) as TriggerSyncResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || vi.home.manualSync.error);
      }

      setState("success");
      setMessage(payload.message || vi.home.manualSync.success);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : vi.home.manualSync.error);
    }
  }

  const isLoading = state === "loading";

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        onClick={() => triggerSync()}
        disabled={isLoading}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 0 1-15 6.7" />
          <path d="M3 12a9 9 0 0 1 15-6.7" />
          <path d="M6 19H3v-3" />
          <path d="M18 5h3v3" />
        </svg>
        {isLoading ? vi.home.manualSync.loading : vi.home.manualSync.label}
      </button>
      {message ? (
        <p
          className={`max-w-xs text-xs leading-5 ${
            state === "error" ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
