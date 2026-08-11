// Small date-formatting helpers shared by the Action Centre, Calendar,
// Analytics, and Inbox Activity pages — kept in one place so "what does a
// due date look like" and "what does a timestamp look like" don't drift
// into three slightly different implementations across those pages.

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export interface DueLabel {
  text: string;
  urgent: boolean;
}

// Computes a relative "due X" label from an ISO due date, comparing calendar
// days (not raw ms) so "today"/"tomorrow" read correctly regardless of time
// of day. `urgent` flags overdue/today/tomorrow for the caller to style
// distinctly (per the Action Centre spec: flag anything due today/tomorrow).
export function relativeDueLabel(dueAt?: string): DueLabel {
  if (!dueAt) return { text: "No due date", urgent: false };
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return { text: "No due date", urgent: false };

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(new Date());
  const dueDay = startOfDay(due);
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) {
    const n = Math.abs(diffDays);
    return { text: `${n} day${n === 1 ? "" : "s"} overdue`, urgent: true };
  }
  if (diffDays === 0) return { text: "Due today", urgent: true };
  if (diffDays === 1) return { text: "Due tomorrow", urgent: true };
  if (diffDays <= 6) return { text: `Due in ${diffDays} days`, urgent: false };
  return { text: `Due ${formatDateShort(dueAt)}`, urgent: false };
}
