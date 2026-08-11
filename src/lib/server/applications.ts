// Shared server-side data assembly for every dashboard page (Dashboard home,
// Applications, Action Centre, Calendar, Companies, Analytics, Inbox
// Activity). One place computes derived state (stats, tasks, activity feed)
// from raw Firestore records so each page doesn't re-derive its own version
// of "what counts as awaiting response" and drift from the others.

import {
  adminListApplications,
  adminQueryTimelineAcrossApplications,
  type AdminApplicationRecord,
  type AdminTimelineEventRecord,
} from "@/lib/server/firestore-admin";

// Mirrors extension/dashboard/dashboard.js's STATUSES and
// src/lib/server/gmail-sync.ts's APPLICATION_STATUSES — the one closed
// 7-value enum, never add an 8th value here without updating those too.
export const APPLICATION_STATUSES = [
  "applied",
  "received",
  "assessment",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

const TERMINAL_STATUSES: ReadonlySet<ApplicationStatus> = new Set<ApplicationStatus>([
  "offer",
  "rejected",
  "withdrawn",
]);

// "Awaiting response" needs no stored value — it's threshold days since the
// most recent activity (appliedAt, or a later timeline event if any) on a
// still-open application. 14 days is a starting default, not a researched
// constant — easy to tune later, kept as one named constant so it's obvious
// where to change it.
const AWAITING_RESPONSE_THRESHOLD_DAYS = 14;

export interface ApplicationTask {
  id?: string;
  type?: string;
  label?: string;
  dueAt?: string;
  completed?: boolean;
}

export interface EnrichedApplication {
  id: string;
  company: string;
  role: string;
  description: string | null;
  url: string;
  source: string;
  auto: boolean;
  status: ApplicationStatus;
  appliedAt: string;
  resumeFileName: string | null;
  notes: string;
  location: string | null;
  salary: string | null;
  applicationId: string | null;
  recruiterName: string | null;
  recruiterEmail: string | null;
  jobPortal: string | null;
  importantLinks: string[];
  tasks: ApplicationTask[];
  companyManuallySet: boolean;
  lastActivityAt: string;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function asStringOrNull(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}
function asStatus(v: unknown): ApplicationStatus {
  return APPLICATION_STATUSES.includes(v as ApplicationStatus)
    ? (v as ApplicationStatus)
    : "applied";
}

function enrichApplication(
  raw: AdminApplicationRecord,
  latestTimelineAtByApp: Map<string, string>
): EnrichedApplication {
  const appliedAt = asString(raw.appliedAt, new Date(0).toISOString());
  const latestTimelineAt = latestTimelineAtByApp.get(raw.id);
  const lastActivityAt =
    latestTimelineAt && latestTimelineAt > appliedAt ? latestTimelineAt : appliedAt;

  return {
    id: raw.id,
    company: asString(raw.company, "Unknown company"),
    role: asString(raw.role, "Unknown role"),
    description: asStringOrNull(raw.description),
    url: asString(raw.url),
    source: asString(raw.source, "manual"),
    auto: Boolean(raw.auto),
    status: asStatus(raw.status),
    appliedAt,
    resumeFileName: asStringOrNull(raw.resumeFileName),
    notes: asString(raw.notes),
    location: asStringOrNull(raw.location),
    salary: asStringOrNull(raw.salary),
    applicationId: asStringOrNull(raw.applicationId),
    recruiterName: asStringOrNull(raw.recruiterName),
    recruiterEmail: asStringOrNull(raw.recruiterEmail),
    jobPortal: asStringOrNull(raw.jobPortal),
    importantLinks: Array.isArray(raw.importantLinks)
      ? (raw.importantLinks as unknown[]).filter((v): v is string => typeof v === "string")
      : [],
    tasks: Array.isArray(raw.tasks) ? (raw.tasks as ApplicationTask[]) : [],
    companyManuallySet: Boolean(raw.companyManuallySet),
    lastActivityAt,
  };
}

export interface DashboardData {
  applications: EnrichedApplication[];
  recentTimeline: AdminTimelineEventRecord[];
}

// The one place that fetches applications + a recent cross-application
// timeline feed and assembles them together (so lastActivityAt reflects real
// timeline events, not just appliedAt) — every page below reads from this,
// rather than re-fetching/re-deriving independently.
export async function getDashboardData(
  uid: string,
  timelineLimit = 200
): Promise<DashboardData> {
  const [rawApplications, timeline] = await Promise.all([
    adminListApplications(uid),
    adminQueryTimelineAcrossApplications(uid, timelineLimit),
  ]);

  const latestTimelineAtByApp = new Map<string, string>();
  for (const event of timeline) {
    const detectedAt = asString(event.detectedAt);
    if (!detectedAt) continue;
    const current = latestTimelineAtByApp.get(event.applicationId);
    if (!current || detectedAt > current) {
      latestTimelineAtByApp.set(event.applicationId, detectedAt);
    }
  }

  const applications = rawApplications
    .map((raw) => enrichApplication(raw, latestTimelineAtByApp))
    .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));

  return { applications, recentTimeline: timeline };
}

export interface DashboardStats {
  total: number;
  byStatus: Record<ApplicationStatus, number>;
  awaitingResponse: number;
  requiringAction: number;
  thisWeek: number;
}

function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return (Date.now() - then) / (1000 * 60 * 60 * 24);
}

export function computeDashboardStats(applications: EnrichedApplication[]): DashboardStats {
  const byStatus = Object.fromEntries(
    APPLICATION_STATUSES.map((s) => [s, 0])
  ) as Record<ApplicationStatus, number>;

  let awaitingResponse = 0;
  let requiringAction = 0;
  let thisWeek = 0;

  for (const app of applications) {
    byStatus[app.status]++;

    if (
      !TERMINAL_STATUSES.has(app.status) &&
      daysSince(app.lastActivityAt) >= AWAITING_RESPONSE_THRESHOLD_DAYS
    ) {
      awaitingResponse++;
    }

    if (app.tasks.some((t) => !t.completed)) {
      requiringAction++;
    }

    if (daysSince(app.appliedAt) <= 7) {
      thisWeek++;
    }
  }

  return {
    total: applications.length,
    byStatus,
    awaitingResponse,
    requiringAction,
    thisWeek,
  };
}

export interface TaskWithContext extends ApplicationTask {
  applicationId: string;
  company: string;
  role: string;
}

// Flattens every incomplete task across every application into one
// due-date-sorted list — feeds both the Action Centre and Calendar (same
// data, different rendering, per the plan's explicit "don't build a second
// data path for it" note).
export function getUpcomingTasks(applications: EnrichedApplication[]): TaskWithContext[] {
  const tasks: TaskWithContext[] = [];
  for (const app of applications) {
    for (const task of app.tasks) {
      if (task.completed) continue;
      tasks.push({ ...task, applicationId: app.id, company: app.company, role: app.role });
    }
  }
  return tasks.sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
}

export interface CompanyGroup {
  company: string;
  applications: EnrichedApplication[];
  latestStatus: ApplicationStatus;
  latestActivityAt: string;
}

export function groupByCompany(applications: EnrichedApplication[]): CompanyGroup[] {
  const byCompany = new Map<string, EnrichedApplication[]>();
  for (const app of applications) {
    const key = app.company || "Unknown company";
    const list = byCompany.get(key) ?? [];
    list.push(app);
    byCompany.set(key, list);
  }

  return Array.from(byCompany.entries())
    .map(([company, apps]) => {
      const sorted = [...apps].sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
      return {
        company,
        applications: sorted,
        latestStatus: sorted[0].status,
        latestActivityAt: sorted[0].lastActivityAt,
      };
    })
    .sort((a, b) => b.latestActivityAt.localeCompare(a.latestActivityAt));
}

export interface AnalyticsData {
  responseRate: number; // fraction of applications that moved past "applied"
  interviewConversionRate: number; // fraction of applications that reached "interview" or later
  offerConversionRate: number; // fraction of applications that reached "offer"
  mostActiveCompanies: Array<{ company: string; count: number }>;
  applicationsPerWeek: Array<{ weekStart: string; count: number }>;
}

const REACHED_INTERVIEW_OR_LATER: ReadonlySet<ApplicationStatus> = new Set<ApplicationStatus>([
  "interview",
  "offer",
  "rejected", // a rejection after interview still counts as having reached it;
  // this is a simplification (we don't track exactly which stage a rejection
  // followed) — good enough for a first version, revisit if it's misleading.
]);

function weekStartIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday as week start
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function computeAnalytics(applications: EnrichedApplication[]): AnalyticsData {
  const total = applications.length || 1; // avoid divide-by-zero; rates read as 0% on an empty account

  const respondedTo = applications.filter((a) => a.status !== "applied").length;
  const reachedInterview = applications.filter((a) =>
    REACHED_INTERVIEW_OR_LATER.has(a.status)
  ).length;
  const offers = applications.filter((a) => a.status === "offer").length;

  const companyCounts = new Map<string, number>();
  for (const app of applications) {
    companyCounts.set(app.company, (companyCounts.get(app.company) ?? 0) + 1);
  }
  const mostActiveCompanies = Array.from(companyCounts.entries())
    .map(([company, count]) => ({ company, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const weekCounts = new Map<string, number>();
  for (const app of applications) {
    const week = weekStartIso(app.appliedAt);
    weekCounts.set(week, (weekCounts.get(week) ?? 0) + 1);
  }
  const applicationsPerWeek = Array.from(weekCounts.entries())
    .map(([weekStart, count]) => ({ weekStart, count }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  return {
    responseRate: respondedTo / total,
    interviewConversionRate: reachedInterview / total,
    offerConversionRate: offers / total,
    mostActiveCompanies,
    applicationsPerWeek,
  };
}
