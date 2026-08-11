"use client";

// Client-side search/filter/view-toggle shell for the Applications page.
// Ports the INTERACTION DESIGN of extension/dashboard/dashboard.js (search +
// status filter tabs feed both a flat list and per-status board columns;
// view choice persists to localStorage) into React, rather than the
// vanilla-JS DOM-cloning implementation. The full `applications` array is
// passed down from the server component (already fetched via
// getDashboardData) — this component only filters/reshapes it client-side,
// it never fetches on its own.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ALL_STATUSES, STATUS_LABELS, STATUS_DOT_CLASSES } from "@/lib/status";
import { humanizeSource, matchesSearch } from "@/lib/applications-ui";
import { formatDateShort } from "@/lib/format-date";
import type { ApplicationStatus, EnrichedApplication } from "@/lib/server/applications";
import { StatusSelect } from "./status-select";
import { cn } from "@/lib/utils";

const VIEW_STORAGE_KEY = "streakhire_web_dashboard_view";
type View = "list" | "board";

export function ApplicationsExplorer({ applications }: { applications: EnrichedApplication[] }) {
  const [view, setView] = useState<View>("list");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("all");

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "list" || stored === "board") setView(stored);
  }, []);

  function handleViewChange(next: View) {
    setView(next);
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  }

  const filtered = useMemo(
    () =>
      applications.filter(
        (app) => matchesSearch(app, query) && (statusFilter === "all" || app.status === statusFilter)
      ),
    [applications, query, statusFilter]
  );

  const countsByStatus = useMemo(() => {
    const counts = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<
      ApplicationStatus,
      number
    >;
    for (const app of applications) counts[app.status]++;
    return counts;
  }, [applications]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search company or role…"
          className="flex-1 min-w-0 rounded-full border border-ink/15 bg-paper-light px-4 py-2 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus:border-ink/30"
        />
        <div className="flex items-center gap-1 rounded-full border border-ink/15 bg-paper-light p-1 shrink-0">
          {(["list", "board"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => handleViewChange(v)}
              className={cn(
                "font-mono text-[11px] uppercase tracking-wide px-3 py-1.5 rounded-full transition-colors",
                view === v ? "bg-stamp text-paper-light" : "text-ink-soft hover:text-ink"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-8">
        <FilterTab
          active={statusFilter === "all"}
          label="All"
          count={applications.length}
          onClick={() => setStatusFilter("all")}
        />
        {ALL_STATUSES.map((s) => (
          <FilterTab
            key={s}
            active={statusFilter === s}
            label={STATUS_LABELS[s]}
            count={countsByStatus[s]}
            onClick={() => setStatusFilter(s)}
          />
        ))}
      </div>

      {applications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 bg-paper-light px-8 py-12 text-center">
          <p className="text-ink-soft">No applications logged yet.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 bg-paper-light px-8 py-12 text-center">
          <p className="text-ink-soft">No applications match your search or filter.</p>
        </div>
      ) : view === "list" ? (
        <ListView applications={filtered} />
      ) : (
        <BoardView applications={filtered} />
      )}
    </div>
  );
}

function FilterTab({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "font-mono text-[11px] uppercase tracking-wide px-3 py-1.5 rounded-full border transition-colors",
        active
          ? "bg-stamp text-paper-light border-stamp"
          : "border-ink/15 text-ink-soft hover:border-ink/30 hover:text-ink"
      )}
    >
      {label} <span className="opacity-70">{count}</span>
    </button>
  );
}

function ListView({ applications }: { applications: EnrichedApplication[] }) {
  return (
    <ul className="space-y-2">
      {applications.map((app) => (
        <li
          key={app.id}
          className="flex items-center gap-4 rounded-2xl border border-ink/12 bg-paper-light px-5 py-4 hover:border-ink/25 transition-colors"
        >
          {/* Link wraps only non-interactive content — nesting the
              StatusSelect's <select> inside an <a> is invalid HTML and
              unreliable across browsers, so it's kept as a sibling. */}
          <Link href={`/applications/${app.id}`} className="min-w-0 flex-1 flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-ink font-medium truncate">{app.role}</p>
              <p className="font-mono text-[12px] text-ink-soft truncate mt-0.5">
                {app.company}
                {app.location ? ` · ${app.location}` : ""}
              </p>
            </div>
            <span className="font-mono text-[11px] text-ink-soft whitespace-nowrap shrink-0 hidden sm:inline">
              {formatDateShort(app.lastActivityAt)}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wide text-ink-soft bg-ink/5 px-2 py-1 rounded-full shrink-0 hidden sm:inline">
              {humanizeSource(app.source, app.auto)}
            </span>
          </Link>
          <StatusSelect applicationId={app.id} status={app.status} />
        </li>
      ))}
    </ul>
  );
}

function BoardView({ applications }: { applications: EnrichedApplication[] }) {
  const byStatus = new Map<ApplicationStatus, EnrichedApplication[]>();
  for (const s of ALL_STATUSES) byStatus.set(s, []);
  for (const app of applications) byStatus.get(app.status)?.push(app);

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {ALL_STATUSES.map((status) => {
        const apps = byStatus.get(status) ?? [];
        return (
          <div key={status} className="shrink-0 w-72">
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className={cn("h-2 w-2 rounded-full", STATUS_DOT_CLASSES[status])} />
              <h3 className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">
                {STATUS_LABELS[status]}
              </h3>
              <span className="font-mono text-[11px] text-ink-soft/60">{apps.length}</span>
            </div>
            <div className="space-y-2.5">
              {apps.length === 0 ? (
                <p className="font-mono text-[11px] text-ink-soft/50 px-1">No applications here.</p>
              ) : (
                apps.map((app) => (
                  <div
                    key={app.id}
                    className="rounded-2xl border border-ink/12 bg-paper-light p-4 hover:border-ink/25 transition-colors"
                  >
                    {/* Link wraps only non-interactive content, same reasoning
                        as ListView above. */}
                    <Link href={`/applications/${app.id}`} className="block">
                      <p className="text-ink font-medium text-sm truncate">{app.role}</p>
                      <p className="font-mono text-[11px] text-ink-soft truncate mt-0.5">
                        {app.company}
                      </p>
                    </Link>
                    <div className="flex items-center justify-between gap-2 mt-3">
                      <span className="font-mono text-[10px] uppercase tracking-wide text-ink-soft bg-ink/5 px-2 py-1 rounded-full">
                        {humanizeSource(app.source, app.auto)}
                      </span>
                      <StatusSelect applicationId={app.id} status={app.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
