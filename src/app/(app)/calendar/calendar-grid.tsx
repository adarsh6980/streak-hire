"use client";

// Month-navigation is the one interactive piece of the Calendar page, so
// it's split into its own client component. Grid math is deliberately plain
// Date arithmetic (days-in-month via new Date(y, m+1, 0).getDate(), weekday
// of the 1st via new Date(y, m, 1).getDay()) — no calendar library, per the
// brief (this project has none and adding one is out of scope).

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { TaskWithContext } from "@/lib/server/applications";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function CalendarGrid({
  tasksByDate,
}: {
  tasksByDate: Record<string, TaskWithContext[]>;
}) {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const cells = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const list: Array<{ day: number; key: string } | null> = [];
    for (let i = 0; i < firstWeekday; i++) list.push(null);
    for (let day = 1; day <= totalDays; day++) {
      list.push({ day, key: dateKey(new Date(year, month, day)) });
    }
    return list;
  }, [year, month]);

  function goPrev() {
    setSelectedKey(null);
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function goNext() {
    setSelectedKey(null);
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }

  function goToday() {
    setSelectedKey(null);
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  }

  const todayKey = dateKey(now);
  const selectedTasks = selectedKey ? tasksByDate[selectedKey] ?? [] : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="font-display text-xl font-bold text-ink">
          {MONTH_LABELS[month]} {year}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="font-mono text-xs px-3 py-1.5 rounded-full border border-ink/20 text-ink-soft hover:border-ink/40 hover:text-ink transition-colors"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={goToday}
            className="font-mono text-xs px-3 py-1.5 rounded-full border border-ink/20 text-ink-soft hover:border-ink/40 hover:text-ink transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            onClick={goNext}
            className="font-mono text-xs px-3 py-1.5 rounded-full border border-ink/20 text-ink-soft hover:border-ink/40 hover:text-ink transition-colors"
          >
            Next →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {WEEKDAY_LABELS.map((w) => (
          <div
            key={w}
            className="font-mono text-[10px] uppercase tracking-wide text-ink-soft text-center py-1"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`blank-${i}`} />;
          const dayTasks = tasksByDate[cell.key] ?? [];
          const isToday = cell.key === todayKey;
          const isSelected = cell.key === selectedKey;
          return (
            <button
              type="button"
              key={cell.key}
              onClick={() => setSelectedKey(isSelected ? null : cell.key)}
              className={cn(
                "min-h-[76px] rounded-xl border p-2 text-left flex flex-col gap-1 transition-colors",
                isSelected
                  ? "border-stamp bg-stamp/5"
                  : "border-ink/10 bg-paper-light hover:border-ink/25"
              )}
            >
              <span
                className={cn(
                  "font-mono text-[11px]",
                  isToday ? "text-stamp font-bold" : "text-ink-soft"
                )}
              >
                {cell.day}
              </span>
              {dayTasks.length > 0 && (
                <div className="flex flex-col gap-0.5 min-w-0">
                  {dayTasks.slice(0, 2).map((t, ti) => (
                    <span key={ti} className="flex items-center gap-1 min-w-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-airmail shrink-0" />
                      <span className="text-[10px] text-ink-soft truncate">{t.company}</span>
                    </span>
                  ))}
                  {dayTasks.length > 2 && (
                    <span className="font-mono text-[9px] text-ink-soft/70">
                      +{dayTasks.length - 2} more
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedKey && (
        <div className="mt-6 rounded-2xl border border-ink/12 bg-paper-light p-5">
          <h3 className="font-mono text-[11px] uppercase tracking-wide text-ink-soft mb-3">
            {selectedKey}
          </h3>
          {selectedTasks.length === 0 ? (
            <p className="text-ink-soft text-sm">No tasks due this day.</p>
          ) : (
            <ul className="space-y-2">
              {selectedTasks.map((t, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="text-ink text-sm">{t.label || "Task"}</span>
                  <span className="font-mono text-[11px] text-ink-soft whitespace-nowrap">
                    {t.company}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
