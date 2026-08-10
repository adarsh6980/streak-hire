function sendMessage(type, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      if (!response || !response.ok) {
        reject(new Error(response?.error || "Unknown error"));
        return;
      }
      resolve(response.data);
    });
  });
}

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");

// Operate-mode motion rule (impeccable's operate.md): no orchestrated
// page-load sequences on every refresh — only the very first paint gets the
// staggered entrance. Every subsequent refresh (after a status change, edit,
// delete, import) renders instantly; individual rows/cards get a one-shot
// "stamped" pulse instead when *they specifically* changed.
let hasAnimatedFirstLoad = false;

function animateIn(el, index = 0) {
  if (REDUCED_MOTION.matches || hasAnimatedFirstLoad) return;
  el.animate(
    [
      { opacity: 0, transform: "translateY(8px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    { duration: 200, delay: Math.min(index, 10) * 25, easing: "ease-out", fill: "backwards" }
  );
}

// The postal-world "physical presence" motion per DESIGN.md's Tilt-Not-Lift
// Rule: a brief rotation pulse, standing in for the moment something gets
// stamped — used after a save/delete succeeds, never as a hover effect.
function pulseStamp(el) {
  if (REDUCED_MOTION.matches || !el) return;
  el.animate(
    [
      { transform: "rotate(0deg) scale(1)" },
      { transform: "rotate(-2.5deg) scale(1.02)" },
      { transform: "rotate(0deg) scale(1)" },
    ],
    { duration: 380, easing: "ease-out" }
  );
}

const STATUSES = ["applied", "received", "assessment", "interview", "offer", "rejected", "withdrawn"];

const SOURCE_LABELS = {
  linkedin: "LinkedIn",
  greenhouse: "Greenhouse",
  lever: "Lever",
  workday: "Workday",
  generic: "Web",
  manual: "Manual",
  "manual-scrape": "Scraped",
  "quick-confirm": "Quick log",
  import: "Imported",
};

function humanizeSource(app) {
  return SOURCE_LABELS[app.source] || (app.auto ? "Auto" : "Manual");
}

const rowTemplate = document.getElementById("row-template");
const cardTemplate = document.getElementById("card-template");

let allApplications = [];
let currentDetailId = null;
let currentStatusFilter = "all";
let currentView = localStorage.getItem("pounce_dashboard_view") || "list";

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatFullDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function findApp(id) {
  return allApplications.find((a) => a.id === id);
}

function matchesSearch(app, query) {
  if (!query) return true;
  const haystack = `${app.role || ""} ${app.company || ""}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function getFilteredApplications() {
  const query = document.getElementById("search-input").value.trim();
  return allApplications.filter(
    (app) =>
      matchesSearch(app, query) &&
      (currentStatusFilter === "all" || app.status === currentStatusFilter)
  );
}

async function updateStatus(app, newStatus, el) {
  await sendMessage("UPDATE_APPLICATION_STATUS", { applicationId: app.id, status: newStatus });
  pulseStamp(el);
  await refresh();
}

function buildRow(app, index) {
  const node = rowTemplate.content.cloneNode(true);
  const row = node.querySelector(".row");
  row.dataset.id = app.id;

  row.querySelector(".row-role").textContent = app.role || "Role";
  row.querySelector(".row-company").textContent = app.company || "";
  row.querySelector(".row-date").textContent = formatDate(app.appliedAt);
  row.querySelector(".row-badge").textContent = humanizeSource(app);

  const resumeChip = row.querySelector(".row-resume-chip");
  if (app.resumeFileName) {
    resumeChip.textContent = app.resumeFileName;
    resumeChip.classList.remove("hidden");
  }

  const statusSelect = row.querySelector(".row-status-select");
  statusSelect.value = app.status || "applied";
  statusSelect.addEventListener("click", (e) => e.stopPropagation());
  statusSelect.addEventListener("change", () => updateStatus(app, statusSelect.value, row));

  row.addEventListener("click", () => openDetail(app.id));
  row.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDetail(app.id);
    }
  });

  requestAnimationFrame(() => animateIn(row, index));
  return node;
}

function buildCard(app, index) {
  const node = cardTemplate.content.cloneNode(true);
  const card = node.querySelector(".card");
  card.dataset.id = app.id;

  card.querySelector(".card-role").textContent = app.role || "Role";
  card.querySelector(".card-company").textContent = app.company || "";
  card.querySelector(".card-date").textContent = `Applied ${formatDate(app.appliedAt)}`;
  card.querySelector(".card-badge").textContent = humanizeSource(app);

  const resumeChip = card.querySelector(".card-resume-chip");
  if (app.resumeFileName) {
    resumeChip.textContent = app.resumeFileName;
    resumeChip.classList.remove("hidden");
  }

  const statusSelect = card.querySelector(".card-status-select");
  statusSelect.value = app.status || "applied";
  statusSelect.addEventListener("click", (e) => e.stopPropagation());
  statusSelect.addEventListener("change", () => updateStatus(app, statusSelect.value, card));

  card.addEventListener("click", () => openDetail(app.id));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDetail(app.id);
    }
  });

  requestAnimationFrame(() => animateIn(card, index));
  return node;
}

function renderList(filtered) {
  const container = document.getElementById("list-rows");
  container.innerHTML = "";
  filtered.forEach((app, i) => container.appendChild(buildRow(app, i)));
}

function renderBoardColumns(filtered) {
  const columns = Object.fromEntries(STATUSES.map((status) => [status, []]));
  for (const app of filtered) {
    (columns[app.status] || columns.applied).push(app);
  }

  for (const status of STATUSES) {
    const container = document.getElementById(`cards-${status}`);
    container.innerHTML = "";
    if (columns[status].length === 0) {
      const empty = document.createElement("p");
      empty.className = "column-empty";
      empty.textContent = "No applications here.";
      container.appendChild(empty);
    } else {
      columns[status].forEach((app, i) => container.appendChild(buildCard(app, i)));
    }
    document.getElementById(`count-${status}`).textContent = columns[status].length;
  }
}

function renderFilterCounts() {
  document.getElementById("filtercount-all").textContent = allApplications.length;
  for (const status of STATUSES) {
    document.getElementById(`filtercount-${status}`).textContent = allApplications.filter(
      (a) => a.status === status
    ).length;
  }
}

function render() {
  const filtered = getFilteredApplications();

  document.getElementById("list-view").classList.toggle("hidden", currentView !== "list");
  document.getElementById("board-view").classList.toggle("hidden", currentView !== "board");

  if (currentView === "list") {
    renderList(filtered);
  } else {
    renderBoardColumns(filtered);
  }

  renderFilterCounts();
  hasAnimatedFirstLoad = true;

  const hasAny = allApplications.length > 0;
  const searchActive = Boolean(document.getElementById("search-input").value.trim());
  document.getElementById("list-view").classList.toggle("hidden", currentView !== "list" || !hasAny);
  document.getElementById("board-view").classList.toggle("hidden", currentView !== "board" || !hasAny);
  document.getElementById("empty-state").classList.toggle("hidden", hasAny);
  document
    .getElementById("no-results-state")
    .classList.toggle("hidden", !(hasAny && filtered.length === 0));
}

function renderDigest(digest) {
  document.getElementById("digest-week-count").textContent = digest.applicationsLast7Days;
  document.getElementById("digest-interview-count").textContent = digest.interviewsLast7Days;
  document.getElementById("digest-total-count").textContent = digest.total;

  const banner = document.getElementById("followup-banner");
  const list = document.getElementById("followup-list");
  list.innerHTML = "";

  if (digest.needsFollowUp.length === 0) {
    banner.classList.add("hidden");
    return;
  }

  banner.classList.remove("hidden");
  for (const app of digest.needsFollowUp) {
    const li = document.createElement("li");
    li.className = "followup-item";
    li.innerHTML = `
      <span>${escapeHtml(app.role || "Role")} at ${escapeHtml(app.company || "")} — applied ${formatDate(app.appliedAt)}</span>
    `;
    const btn = document.createElement("button");
    btn.className = "followup-item-btn";
    btn.textContent = "Mark followed up";
    btn.addEventListener("click", async () => {
      await sendMessage("MARK_FOLLOWED_UP", { applicationId: app.id });
      await refresh();
    });
    li.appendChild(btn);
    list.appendChild(li);
  }
}

// --- Toolbar: filter tabs + view toggle ---

document.getElementById("filter-tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-tab");
  if (!btn) return;
  currentStatusFilter = btn.dataset.status;
  document
    .querySelectorAll(".filter-tab")
    .forEach((t) => t.classList.toggle("active", t === btn));
  render();
});

document.getElementById("view-toggle").addEventListener("click", (e) => {
  const btn = e.target.closest(".view-toggle-btn");
  if (!btn) return;
  currentView = btn.dataset.view;
  localStorage.setItem("pounce_dashboard_view", currentView);
  document
    .querySelectorAll(".view-toggle-btn")
    .forEach((t) => t.classList.toggle("active", t === btn));
  render();
});

document.querySelectorAll(".view-toggle-btn").forEach((btn) => {
  btn.classList.toggle("active", btn.dataset.view === currentView);
});

document.getElementById("search-input").addEventListener("input", render);

// --- Detail modal ---

const detailEls = {
  overlay: document.getElementById("detail-overlay"),
  view: document.getElementById("detail-view"),
  editForm: document.getElementById("detail-edit-form"),
  badge: document.getElementById("detail-badge"),
  role: document.getElementById("detail-role"),
  company: document.getElementById("detail-company"),
  date: document.getElementById("detail-date"),
  source: document.getElementById("detail-source"),
  url: document.getElementById("detail-url"),
  resume: document.getElementById("detail-resume"),
  location: document.getElementById("detail-location"),
  salary: document.getElementById("detail-salary"),
  applicationId: document.getElementById("detail-application-id"),
  jobPortal: document.getElementById("detail-job-portal"),
  recruiter: document.getElementById("detail-recruiter"),
  importantLinks: document.getElementById("detail-important-links"),
  notes: document.getElementById("detail-notes"),
  description: document.getElementById("detail-description"),
  editBtn: document.getElementById("detail-edit-btn"),
  deleteBtn: document.getElementById("detail-delete-btn"),
  cancelBtn: document.getElementById("detail-cancel-btn"),
  closeBtn: document.getElementById("detail-close"),
  editRole: document.getElementById("edit-role"),
  editCompany: document.getElementById("edit-company"),
  editResume: document.getElementById("edit-resume"),
  editLocation: document.getElementById("edit-location"),
  editSalary: document.getElementById("edit-salary"),
  editApplicationId: document.getElementById("edit-application-id"),
  editJobPortal: document.getElementById("edit-job-portal"),
  editRecruiterName: document.getElementById("edit-recruiter-name"),
  editRecruiterEmail: document.getElementById("edit-recruiter-email"),
  editImportantLinks: document.getElementById("edit-important-links"),
  editNotes: document.getElementById("edit-notes"),
  editDescription: document.getElementById("edit-description"),
};

let editFormDirty = false;
[
  detailEls.editRole,
  detailEls.editCompany,
  detailEls.editResume,
  detailEls.editLocation,
  detailEls.editSalary,
  detailEls.editApplicationId,
  detailEls.editJobPortal,
  detailEls.editRecruiterName,
  detailEls.editRecruiterEmail,
  detailEls.editImportantLinks,
  detailEls.editNotes,
  detailEls.editDescription,
].forEach((el) => el.addEventListener("input", () => (editFormDirty = true)));

function openDetail(id) {
  const app = findApp(id);
  if (!app) return;
  currentDetailId = id;
  renderDetailView(app);
  detailEls.overlay.classList.remove("hidden");
}

function closeDetail({ skipConfirm = false } = {}) {
  if (!skipConfirm && !detailEls.editForm.classList.contains("hidden") && editFormDirty) {
    if (!window.confirm("Discard unsaved changes?")) return;
  }
  detailEls.overlay.classList.add("hidden");
  detailEls.editForm.classList.add("hidden");
  detailEls.view.classList.remove("hidden");
  editFormDirty = false;
  currentDetailId = null;
}

function renderDetailView(app) {
  detailEls.badge.textContent = humanizeSource(app);
  detailEls.role.textContent = app.role || "Role";
  detailEls.company.textContent = app.company || "";
  detailEls.date.textContent = `Applied ${formatFullDate(app.appliedAt)}`;
  detailEls.source.textContent = app.source ? `via ${humanizeSource(app)}` : "";

  if (app.url) {
    detailEls.url.href = app.url;
    detailEls.url.classList.remove("hidden");
  } else {
    detailEls.url.classList.add("hidden");
  }

  detailEls.resume.textContent = app.resumeFileName || "Not captured";
  detailEls.location.textContent = app.location ?? "Not captured";
  detailEls.salary.textContent = app.salary ?? "Not captured";
  detailEls.applicationId.textContent = app.applicationId ?? "Not captured";
  detailEls.jobPortal.textContent = app.jobPortal ?? "Not captured";

  const recruiterName = app.recruiterName ?? "";
  const recruiterEmail = app.recruiterEmail ?? "";
  detailEls.recruiter.textContent =
    recruiterName || recruiterEmail
      ? `${recruiterName}${recruiterName && recruiterEmail ? " — " : ""}${recruiterEmail}`
      : "Not captured";

  detailEls.importantLinks.innerHTML = "";
  const links = Array.isArray(app.importantLinks) ? app.importantLinks : [];
  if (links.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No links added.";
    detailEls.importantLinks.appendChild(li);
  } else {
    for (const link of links) {
      // importantLinks entries are plain URL strings (or, defensively,
      // {label, url} objects if a future writer uses that shape).
      const url = typeof link === "string" ? link : link?.url ?? "";
      const label = typeof link === "string" ? link : link?.label || link?.url || "";
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.className = "detail-link";
      a.textContent = label;
      li.appendChild(a);
      detailEls.importantLinks.appendChild(li);
    }
  }

  detailEls.notes.textContent = app.notes || "No notes yet.";
  detailEls.description.textContent = app.description || "No description captured for this application.";

  detailEls.view.classList.remove("hidden");
  detailEls.editForm.classList.add("hidden");
}

function openEditMode() {
  const app = findApp(currentDetailId);
  if (!app) return;
  detailEls.editRole.value = app.role || "";
  detailEls.editCompany.value = app.company || "";
  detailEls.editResume.value = app.resumeFileName || "";
  detailEls.editLocation.value = app.location ?? "";
  detailEls.editSalary.value = app.salary ?? "";
  detailEls.editApplicationId.value = app.applicationId ?? "";
  detailEls.editJobPortal.value = app.jobPortal ?? "";
  detailEls.editRecruiterName.value = app.recruiterName ?? "";
  detailEls.editRecruiterEmail.value = app.recruiterEmail ?? "";
  detailEls.editImportantLinks.value = Array.isArray(app.importantLinks)
    ? app.importantLinks
        .map((link) => (typeof link === "string" ? link : link?.url ?? ""))
        .join("\n")
    : "";
  detailEls.editNotes.value = app.notes || "";
  detailEls.editDescription.value = app.description || "";
  editFormDirty = false;
  detailEls.view.classList.add("hidden");
  detailEls.editForm.classList.remove("hidden");
}

detailEls.closeBtn.addEventListener("click", () => closeDetail());
detailEls.overlay.addEventListener("click", (e) => {
  if (e.target === detailEls.overlay) closeDetail();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !detailEls.overlay.classList.contains("hidden")) closeDetail();
});

detailEls.editBtn.addEventListener("click", openEditMode);
detailEls.cancelBtn.addEventListener("click", () => {
  if (editFormDirty && !window.confirm("Discard unsaved changes?")) return;
  editFormDirty = false;
  const app = findApp(currentDetailId);
  if (app) renderDetailView(app);
});

detailEls.editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentDetailId) return;
  const importantLinks = detailEls.editImportantLinks.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  await sendMessage("UPDATE_APPLICATION_DETAILS", {
    applicationId: currentDetailId,
    role: detailEls.editRole.value.trim(),
    company: detailEls.editCompany.value.trim(),
    resumeFileName: detailEls.editResume.value.trim() || null,
    location: detailEls.editLocation.value.trim() || null,
    salary: detailEls.editSalary.value.trim() || null,
    externalApplicationId: detailEls.editApplicationId.value.trim() || null,
    jobPortal: detailEls.editJobPortal.value.trim() || null,
    recruiterName: detailEls.editRecruiterName.value.trim() || null,
    recruiterEmail: detailEls.editRecruiterEmail.value.trim() || null,
    importantLinks,
    notes: detailEls.editNotes.value.trim(),
    description: detailEls.editDescription.value.trim() || null,
  });
  editFormDirty = false;
  pulseStamp(detailEls.overlay.querySelector(".detail-modal"));
  await refresh();
  const app = findApp(currentDetailId);
  if (app) renderDetailView(app);
});

detailEls.deleteBtn.addEventListener("click", async () => {
  const app = findApp(currentDetailId);
  if (!app) return;
  const confirmed = window.confirm(
    `Delete "${app.role || "this application"}" at ${app.company || "this company"}? This can't be undone.`
  );
  if (!confirmed) return;

  await sendMessage("DELETE_APPLICATION", { applicationId: currentDetailId });
  closeDetail({ skipConfirm: true });
  await refresh();
});

// --- CSV export / import ---
// CSV is the universal interchange format Excel, Google Sheets, and Notion
// all natively import/export — one format covers all three rather than
// building three separate API integrations (each of which would need its
// own OAuth consent screen, same setup burden as the Google sign-in flow).

const CSV_COLUMNS = [
  "role",
  "company",
  "status",
  "appliedAt",
  "source",
  "resumeFileName",
  "notes",
  "description",
  "url",
];

function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(applications) {
  const header = CSV_COLUMNS.join(",");
  const rows = applications.map((app) =>
    CSV_COLUMNS.map((col) => csvEscape(app[col])).join(",")
  );
  return [header, ...rows].join("\r\n");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

document.getElementById("export-btn").addEventListener("click", () => {
  const csv = buildCsv(allApplications);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `streakhire-applications-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

const importInput = document.getElementById("import-file-input");
document.getElementById("import-btn").addEventListener("click", () => importInput.click());

importInput.addEventListener("change", async () => {
  const file = importInput.files?.[0];
  importInput.value = "";
  if (!file) return;

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) {
    window.alert("That CSV doesn't look like it has any data rows.");
    return;
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const dataRows = rows.slice(1);

  const applications = dataRows.map((cells) => {
    const record = {};
    header.forEach((col, i) => {
      record[col] = cells[i] ?? "";
    });
    return {
      role: record.role || record.title || "Unknown role",
      company: record.company || "Unknown company",
      status: STATUSES.includes(record.status) ? record.status : "applied",
      appliedAt: record.appliedat || record["applied date"] || null,
      source: "import",
      resumeFileName: record.resumefilename || record["resume file"] || null,
      notes: record.notes || "",
      description: record.description || null,
      url: record.url || "",
    };
  });

  const confirmed = window.confirm(
    `Import ${applications.length} application${applications.length === 1 ? "" : "s"}? This won't affect your streak — streak only counts what you apply to going forward.`
  );
  if (!confirmed) return;

  const result = await sendMessage("IMPORT_APPLICATIONS", { applications });
  await refresh();
  pulseStamp(document.querySelector(".digest-bar"));
  window.alert(`Imported ${result.imported} application${result.imported === 1 ? "" : "s"}.`);
});

// --- Bootstrap ---

async function refresh() {
  const main = document.querySelector(".main");
  main.style.opacity = "0.6";
  try {
    const [state, applications, digest] = await Promise.all([
      sendMessage("GET_STATE"),
      sendMessage("LIST_ALL_APPLICATIONS"),
      sendMessage("GET_DIGEST"),
    ]);

    const streak = state.streak?.current || 0;
    document.getElementById("header-streak-count").textContent = `${streak} day${streak === 1 ? "" : "s"}`;

    allApplications = applications;
    render();
    renderDigest(digest);
  } finally {
    main.style.opacity = "1";
  }
}

refresh().catch((err) => {
  document.querySelector(".main").innerHTML = `<p class="empty-state">${escapeHtml(
    String(err.message || err)
  )} — try signing in from the extension popup first.</p>`;
});
