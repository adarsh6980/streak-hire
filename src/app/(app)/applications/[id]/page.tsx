import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/server/session";
import { adminGetApplication, adminListApplicationTimeline } from "@/lib/server/firestore-admin";
import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
  type ApplicationTask,
} from "@/lib/server/applications";
import { humanizeSource } from "@/lib/applications-ui";
import { formatDateShort, formatDateTime, relativeDueLabel } from "@/lib/format-date";
import { StatusSelect } from "../status-select";
import { DetailTaskCheckbox } from "./detail-task-checkbox";
import { NotesEditor } from "./notes-editor";
import { cn } from "@/lib/utils";

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function asStringOrNull(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}
function asStatus(v: unknown): ApplicationStatus {
  return (APPLICATION_STATUSES as readonly string[]).includes(v as string)
    ? (v as ApplicationStatus)
    : "applied";
}

export default async function ApplicationDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/?connect=1");

  const [raw, timeline] = await Promise.all([
    adminGetApplication(session.uid, params.id),
    adminListApplicationTimeline(session.uid, params.id),
  ]);

  // adminGetApplication reads users/{uid}/applications/{id} — an id that
  // doesn't exist, or belongs to a different uid, resolves to a 404 from
  // Firestore either way, which adminGetApplication surfaces as null. That
  // makes ownership implicit in the fetch path itself: there's no separate
  // "does this app belong to this session" check to write, notFound() here
  // covers both the made-up-id and not-my-application cases identically.
  if (!raw) notFound();

  const app = {
    id: raw.id,
    company: asString(raw.company, "Unknown company"),
    role: asString(raw.role, "Unknown role"),
    description: asStringOrNull(raw.description),
    url: asString(raw.url),
    source: asString(raw.source, "manual"),
    auto: Boolean(raw.auto),
    status: asStatus(raw.status),
    appliedAt: asString(raw.appliedAt),
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
  };

  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <Link
        href="/applications"
        className="font-mono text-[11px] uppercase tracking-wide text-ink-soft hover:text-stamp transition-colors"
      >
        ← All applications
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap mt-4 mb-8">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold text-ink">{app.role}</h1>
          <p className="text-ink-soft mt-1">{app.company}</p>
        </div>
        <StatusSelect applicationId={app.id} status={app.status} />
      </div>

      {/* Overview */}
      <section className="mb-10">
        <h2 className="font-display text-lg font-bold text-ink mb-4">Overview</h2>
        <div className="rounded-2xl border border-ink/12 bg-paper-light p-6">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Company" value={app.company} />
            <Field label="Role" value={app.role} />
            <Field label="Location" value={app.location} />
            <Field label="Salary" value={app.salary} />
            <Field label="Source" value={humanizeSource(app.source, app.auto)} />
            <Field label="Applied" value={app.appliedAt ? formatDateShort(app.appliedAt) : null} />
            <Field label="Recruiter" value={app.recruiterName} />
            <Field
              label="Recruiter email"
              value={
                app.recruiterEmail ? (
                  <a href={`mailto:${app.recruiterEmail}`} className="text-airmail underline">
                    {app.recruiterEmail}
                  </a>
                ) : null
              }
            />
            <Field label="Job portal" value={app.jobPortal} />
            <Field label="Application ID" value={app.applicationId} />
            {app.url && (
              <Field
                label="Job posting"
                value={
                  <a
                    href={app.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-airmail underline break-all"
                  >
                    {app.url}
                  </a>
                }
              />
            )}
          </dl>

          {app.importantLinks.length > 0 && (
            <div className="mt-5 pt-5 border-t border-ink/10">
              <p className="font-mono text-[11px] uppercase tracking-wide text-ink-soft mb-2">
                Important links
              </p>
              <ul className="space-y-1">
                {app.importantLinks.map((link, i) => (
                  <li key={`${link}-${i}`}>
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-airmail underline break-all text-sm"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Tasks */}
        <div className="mt-4">
          <h3 className="font-mono text-[11px] uppercase tracking-wide text-ink-soft mb-2">
            Tasks
          </h3>
          {app.tasks.length === 0 ? (
            <p className="text-ink-soft text-sm">No tasks for this application.</p>
          ) : (
            <ul className="space-y-2">
              {app.tasks.map((task, i) => {
                const due = relativeDueLabel(task.dueAt);
                return (
                  <li
                    key={task.id ?? `${task.type ?? "task"}-${i}`}
                    className="flex items-center gap-3 rounded-xl border border-ink/12 bg-paper-light px-4 py-3"
                  >
                    <DetailTaskCheckbox applicationId={app.id} tasks={app.tasks} taskIndex={i} />
                    <p
                      className={cn(
                        "flex-1 min-w-0 truncate text-sm",
                        task.completed ? "text-ink-soft line-through" : "text-ink"
                      )}
                    >
                      {task.label || "Task"}
                    </p>
                    {task.dueAt && (
                      <span
                        className={cn(
                          "font-mono text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0",
                          due.urgent && !task.completed
                            ? "bg-stamp/10 text-stamp"
                            : "bg-ink/5 text-ink-soft"
                        )}
                      >
                        {due.text}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Timeline */}
      <section className="mb-10">
        <h2 className="font-display text-lg font-bold text-ink mb-4">Timeline</h2>
        {timeline.length === 0 ? (
          <p className="text-ink-soft text-sm">No timeline events recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {timeline.map((event) => {
              const label = typeof event.label === "string" ? event.label : "Update detected";
              const stage = typeof event.stage === "string" ? event.stage : null;
              const source = typeof event.source === "string" ? event.source : null;
              const detectedAt = typeof event.detectedAt === "string" ? event.detectedAt : "";
              const confidence = typeof event.confidence === "number" ? event.confidence : null;
              const sourceEmailId =
                typeof event.sourceEmailId === "string" ? event.sourceEmailId : null;
              return (
                <li
                  key={event.id}
                  className="rounded-2xl border border-ink/12 bg-paper-light px-5 py-4"
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <p className="text-ink font-medium">{label}</p>
                    <span className="font-mono text-[11px] text-ink-soft whitespace-nowrap">
                      {detectedAt ? formatDateTime(detectedAt) : "—"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {stage && (
                      <span className="font-mono text-[10px] uppercase tracking-wide text-ink-soft bg-ink/5 px-2 py-1 rounded-full">
                        {stage.replace(/_/g, " ")}
                      </span>
                    )}
                    {source && (
                      <span className="font-mono text-[10px] uppercase tracking-wide text-airmail bg-airmail/10 px-2 py-1 rounded-full">
                        {source}
                      </span>
                    )}
                    {confidence !== null && (
                      <span className="font-mono text-[10px] text-ink-soft/70">
                        {Math.round(confidence * 100)}% confidence
                      </span>
                    )}
                    {sourceEmailId && (
                      <span className="font-mono text-[10px] text-ink-soft/50 truncate">
                        email:{sourceEmailId}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Notes */}
      <section className="mb-10">
        <h2 className="font-display text-lg font-bold text-ink mb-4">Notes</h2>
        <NotesEditor applicationId={app.id} initialNotes={app.notes} />
      </section>

      {/* Job Description */}
      {app.description && (
        <section>
          <h2 className="font-display text-lg font-bold text-ink mb-4">Job Description</h2>
          <div className="rounded-2xl border border-ink/12 bg-paper-light p-6">
            <p className="text-ink-soft text-sm whitespace-pre-wrap">{app.description}</p>
          </div>
        </section>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[11px] uppercase tracking-wide text-ink-soft mb-0.5">
        {label}
      </dt>
      <dd className="text-ink text-sm truncate">{value}</dd>
    </div>
  );
}
