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

function animateIn(el, index = 0) {
  if (REDUCED_MOTION.matches) return;
  el.animate(
    [
      { opacity: 0, transform: "translateY(8px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    { duration: 220, delay: Math.min(index, 8) * 30, easing: "ease-out", fill: "backwards" }
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

const STATUSES = ["applied", "interviewing", "offer", "rejected"];
const cardTemplate = document.getElementById("card-template");

let allApplications = [];
let currentDetailId = null;

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

function buildCard(app, index) {
  const node = cardTemplate.content.cloneNode(true);
  const card = node.querySelector(".card");
  card.dataset.id = app.id;

  node.querySelector(".card-role").textContent = app.role || "Role";
  node.querySelector(".card-company").textContent = app.company || "";
  node.querySelector(".card-date").textContent = `Applied ${formatDate(app.appliedAt)}`;
  node.querySelector(".card-badge").textContent = app.auto ? "auto" : app.source || "manual";

  const resumeChip = node.querySelector(".card-resume-chip");
  if (app.resumeFileName) {
    resumeChip.textContent = app.resumeFileName;
    resumeChip.classList.remove("hidden");
  }

  const statusSelect = node.querySelector(".card-status-select");
  statusSelect.value = app.status || "applied";
  statusSelect.addEventListener("click", (e) => e.stopPropagation());
  statusSelect.addEventListener("change", async () => {
    await sendMessage("UPDATE_APPLICATION_STATUS", {
      applicationId: app.id,
      status: statusSelect.value,
    });
    await refresh();
  });

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

function matchesSearch(app, query) {
  if (!query) return true;
  const haystack = `${app.role || ""} ${app.company || ""}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function renderBoard() {
  const query = document.getElementById("search-input").value.trim();
  const filtered = allApplications.filter((app) => matchesSearch(app, query));

  const columns = { applied: [], interviewing: [], offer: [], rejected: [] };
  for (const app of filtered) {
    (columns[app.status] || columns.applied).push(app);
  }

  for (const status of STATUSES) {
    const container = document.getElementById(`cards-${status}`);
    container.innerHTML = "";
    columns[status].forEach((app, i) => container.appendChild(buildCard(app, i)));
    document.getElementById(`count-${status}`).textContent = columns[status].length;
  }

  document.querySelector(".board").classList.toggle("hidden", allApplications.length === 0);
  document.getElementById("empty-state").classList.toggle("hidden", allApplications.length > 0);
  document
    .getElementById("no-results-state")
    .classList.toggle("hidden", !(allApplications.length > 0 && filtered.length === 0 && query));
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
  notes: document.getElementById("detail-notes"),
  description: document.getElementById("detail-description"),
  editBtn: document.getElementById("detail-edit-btn"),
  deleteBtn: document.getElementById("detail-delete-btn"),
  cancelBtn: document.getElementById("detail-cancel-btn"),
  closeBtn: document.getElementById("detail-close"),
  editRole: document.getElementById("edit-role"),
  editCompany: document.getElementById("edit-company"),
  editResume: document.getElementById("edit-resume"),
  editNotes: document.getElementById("edit-notes"),
  editDescription: document.getElementById("edit-description"),
};

function openDetail(id) {
  const app = findApp(id);
  if (!app) return;
  currentDetailId = id;
  renderDetailView(app);
  detailEls.overlay.classList.remove("hidden");
}

function closeDetail() {
  detailEls.overlay.classList.add("hidden");
  detailEls.editForm.classList.add("hidden");
  detailEls.view.classList.remove("hidden");
  currentDetailId = null;
}

function renderDetailView(app) {
  detailEls.badge.textContent = app.auto ? "auto" : app.source || "manual";
  detailEls.role.textContent = app.role || "Role";
  detailEls.company.textContent = app.company || "";
  detailEls.date.textContent = `Applied ${formatFullDate(app.appliedAt)}`;
  detailEls.source.textContent = app.source ? `via ${app.source}` : "";

  if (app.url) {
    detailEls.url.href = app.url;
    detailEls.url.classList.remove("hidden");
  } else {
    detailEls.url.classList.add("hidden");
  }

  detailEls.resume.textContent = app.resumeFileName || "Not captured";
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
  detailEls.editNotes.value = app.notes || "";
  detailEls.editDescription.value = app.description || "";
  detailEls.view.classList.add("hidden");
  detailEls.editForm.classList.remove("hidden");
}

detailEls.closeBtn.addEventListener("click", closeDetail);
detailEls.overlay.addEventListener("click", (e) => {
  if (e.target === detailEls.overlay) closeDetail();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !detailEls.overlay.classList.contains("hidden")) closeDetail();
});

detailEls.editBtn.addEventListener("click", openEditMode);
detailEls.cancelBtn.addEventListener("click", () => {
  const app = findApp(currentDetailId);
  if (app) renderDetailView(app);
});

detailEls.editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentDetailId) return;
  await sendMessage("UPDATE_APPLICATION_DETAILS", {
    applicationId: currentDetailId,
    role: detailEls.editRole.value.trim(),
    company: detailEls.editCompany.value.trim(),
    resumeFileName: detailEls.editResume.value.trim() || null,
    notes: detailEls.editNotes.value.trim(),
    description: detailEls.editDescription.value.trim() || null,
  });
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
  closeDetail();
  await refresh();
});

// --- Bootstrap ---

document.getElementById("search-input").addEventListener("input", renderBoard);

async function refresh() {
  const [state, applications, digest] = await Promise.all([
    sendMessage("GET_STATE"),
    sendMessage("LIST_ALL_APPLICATIONS"),
    sendMessage("GET_DIGEST"),
  ]);

  const streak = state.streak?.current || 0;
  document.getElementById("header-streak-count").textContent = `${streak} day${streak === 1 ? "" : "s"}`;

  allApplications = applications;
  renderBoard();
  renderDigest(digest);
}

refresh().catch((err) => {
  document.querySelector(".main").innerHTML = `<p class="empty-state">${escapeHtml(
    String(err.message || err)
  )} — try signing in from the extension popup first.</p>`;
});
