"use client";

import { useEffect, useState } from "react";
import { vi } from "@/lib/i18n/vi";

type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "stock-analyzer-theme";
const MODES: ThemeMode[] = ["light", "dark", "system"];

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    const stored = readStoredTheme();
    setMode(stored);
    applyTheme(stored);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readStoredTheme() === "system") {
        applyTheme("system");
      }
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function selectTheme(nextMode: ThemeMode) {
    localStorage.setItem(STORAGE_KEY, nextMode);
    setMode(nextMode);
    applyTheme(nextMode);
  }

  return (
    <div
      className="inline-flex items-center gap-1 rounded-2xl border border-sky-200 bg-white p-1 shadow-[0_14px_40px_rgba(15,23,42,0.08)] dark:border-cyan-400/15 dark:bg-[#0b1b31] dark:shadow-[0_14px_40px_rgba(2,8,23,0.16)] sm:gap-2 sm:p-1.5"
      aria-label={vi.theme.select}
    >
      {MODES.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => selectTheme(item)}
          aria-label={vi.theme[item]}
          title={vi.theme[item]}
          className={`grid h-9 w-9 place-items-center rounded-xl transition sm:h-11 sm:w-11 ${
            mode === item
              ? "border border-cyan-400/70 bg-cyan-50 text-cyan-700 shadow-[0_0_24px_rgba(14,165,233,0.14)] dark:border-cyan-300/70 dark:bg-cyan-400/10 dark:text-cyan-200 dark:shadow-[0_0_24px_rgba(34,211,238,0.18)]"
              : "border border-transparent text-slate-400 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-white/5 dark:hover:text-white"
          }`}
        >
          <ThemeIcon mode={item} />
        </button>
      ))}
    </div>
  );
}

function readStoredTheme(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

function applyTheme(mode: ThemeMode) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const shouldUseDark = mode === "dark" || (mode === "system" && prefersDark);

  document.documentElement.classList.toggle("dark", shouldUseDark);
  document.documentElement.style.colorScheme = shouldUseDark ? "dark" : "light";
}

function ThemeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === "light") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3v2" />
        <path d="M12 19v2" />
        <path d="m4.22 4.22 1.42 1.42" />
        <path d="m18.36 18.36 1.42 1.42" />
        <path d="M3 12h2" />
        <path d="M19 12h2" />
        <path d="m4.22 19.78 1.42-1.42" />
        <path d="m18.36 5.64 1.42-1.42" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    );
  }

  if (mode === "dark") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 7 7 0 1 0 20.5 14.5Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </svg>
  );
}
