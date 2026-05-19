"use client";

import { useState } from "react";

type TriggerState = "idle" | "loading" | "success" | "error";
type AdminAction = "sync" | "backfill" | "metadata";

export function AdminTriggerSyncButton() {
  const [state, setState] = useState<TriggerState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function runAction(action: AdminAction) {
    const secret = window.prompt("Nhập mã admin để trigger sync");

    if (!secret) {
      return;
    }

    setState("loading");
    setMessage(null);

    try {
      const response = action === "sync"
        ? await fetch("/api/admin/trigger-sync", {
            method: "POST",
            headers: {
              "x-admin-sync-secret": secret,
            },
          })
        : await fetch("/api/admin/run-job", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-admin-sync-secret": secret,
            },
            body: JSON.stringify({ job: action }),
          });
      const payload = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "Không gửi được lệnh sync.");
      }

      setState("success");
      setMessage(payload.message ?? "Đã gửi lệnh admin.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Không gửi được lệnh sync.");
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-950 dark:text-white">Admin actions</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Các lệnh này chạy qua server, không expose secret ra client.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminButton label="Trigger Sync" loading={state === "loading"} onClick={() => runAction("sync")} />
          <AdminButton label="Trigger Backfill" loading={state === "loading"} onClick={() => runAction("backfill")} />
          <AdminButton label="Trigger Metadata Sync" loading={state === "loading"} onClick={() => runAction("metadata")} />
        </div>
      </div>
      {message ? (
        <p className={`mt-3 text-sm ${state === "error" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}

function AdminButton({
  label,
  loading,
  onClick,
}: {
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
    >
      {loading ? "Đang gửi..." : label}
    </button>
  );
}
