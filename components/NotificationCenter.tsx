"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { generateStockNotifications, type NotificationType } from "@/lib/notifications";
import { vi } from "@/lib/i18n/vi";
import type { StockSummary } from "@/types/stock";

export function NotificationCenter({ stocks }: { stocks: StockSummary[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const notifications = useMemo(() => generateStockNotifications(stocks), [stocks]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-30 flex min-h-12 items-center gap-2 rounded-full border border-slate-200 bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20"
        aria-label={vi.home.notifications.open}
      >
        <span>{vi.home.notifications.title}</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-950">
          {notifications.length}
        </span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/30"
            aria-label={vi.home.notifications.close}
            onClick={() => setIsOpen(false)}
          />
          <section className="absolute inset-x-0 bottom-0 max-h-[78vh] rounded-t-2xl bg-white p-4 shadow-2xl sm:left-auto sm:right-4 sm:bottom-4 sm:w-96 sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{vi.home.notifications.title}</h2>
                <p className="text-sm text-slate-500">
                  {vi.home.notifications.count(notifications.length)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-950"
              >
                {vi.home.notifications.close}
              </button>
            </div>

            {notifications.length > 0 ? (
              <div className="max-h-[58vh] space-y-3 overflow-y-auto pr-1">
                {notifications.map((notification) => (
                  <Link
                    key={notification.id}
                    href={`/stock/${notification.symbol}`}
                    onClick={() => setIsOpen(false)}
                    className="block rounded-lg border border-slate-200 bg-slate-50 p-3 transition hover:border-slate-300 hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-950">
                            {notification.symbol}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${getTypeClass(notification.type)}`}
                          >
                            {notification.signalLabel}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-950">
                          {notification.title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">
                          {notification.message}
                        </p>
                        <p className="mt-2 text-xs font-medium text-slate-400">
                          {formatNotificationTime(notification.createdAt)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded bg-white px-2 py-1 text-xs font-semibold text-slate-500">
                        P{notification.priority}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <p className="text-base font-semibold text-slate-950">
                  {vi.home.notifications.emptyTitle}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {vi.home.notifications.emptyDescription}
                </p>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}

function getTypeClass(type: NotificationType): string {
  if (type === "bullish") return "bg-emerald-100 text-emerald-700";
  if (type === "bearish") return "bg-rose-100 text-rose-700";
  if (type === "warning") return "bg-amber-100 text-amber-700";
  return "bg-slate-200 text-slate-700";
}

function formatNotificationTime(value: string): string {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}
