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

const STATUSES = ["applied", "interviewing", "offer", "rejected"];
const cardTemplate = document.getElementById("card-template");

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function buildCard(app) {
  const node = cardTemplate.content.cloneNode(true);
  const card = node.querySelector(".card");
  card.dataset.id = app.id;

  node.querySelector(".card-role").textContent = app.role || "Role";
  node.querySelector(".card-company").textContent = app.company || "";
  node.querySelector(".card-date").textContent = `Applied ${formatDate(app.appliedAt)}`;
  node.querySelector(".card-badge").textContent = app.auto ? "auto" : "manual";

  const resumeChip = node.querySelector(".card-resume-chip");
  if (app.resumeFileName) {
    resumeChip.textContent = app.resumeFileName;
    resumeChip.classList.remove("hidden");
  }

  const resumeInput = node.querySelector(".card-resume-input");
  const notesInput = node.querySelector(".card-notes-input");
  resumeInput.value = app.resumeFileName || "";
  notesInput.value = app.notes || "";

  const expandBtn = node.querySelector(".card-expand-btn");
  const expandPanel = node.querySelector(".card-expand");
  expandBtn.addEventListener("click", () => {
    expandPanel.classList.toggle("hidden");
  });

  node.querySelector(".card-save-btn").addEventListener("click", async () => {
    await sendMessage("UPDATE_APPLICATION_DETAILS", {
      applicationId: app.id,
      notes: notesInput.value.trim(),
      resumeFileName: resumeInput.value.trim() || null,
    });
    await refresh();
  });

  const statusSelect = node.querySelector(".card-status-select");
  statusSelect.value = app.status || "applied";
  statusSelect.addEventListener("change", async () => {
    await sendMessage("UPDATE_APPLICATION_STATUS", {
      applicationId: app.id,
      status: statusSelect.value,
    });
    await refresh();
  });

  return node;
}

function renderBoard(applications) {
  const columns = { applied: [], interviewing: [], offer: [], rejected: [] };
  for (const app of applications) {
    (columns[app.status] || columns.applied).push(app);
  }

  for (const status of STATUSES) {
    const container = document.getElementById(`cards-${status}`);
    container.innerHTML = "";
    for (const app of columns[status]) {
      container.appendChild(buildCard(app));
    }
    document.getElementById(`count-${status}`).textContent = columns[status].length;
  }

  document.getElementById("empty-state").classList.toggle("hidden", applications.length > 0);
  document
    .querySelector(".board")
    .classList.toggle("hidden", applications.length === 0);
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

async function refresh() {
  const [state, applications, digest] = await Promise.all([
    sendMessage("GET_STATE"),
    sendMessage("LIST_ALL_APPLICATIONS"),
    sendMessage("GET_DIGEST"),
  ]);

  const streak = state.streak?.current || 0;
  document.getElementById("header-streak-count").textContent = `${streak} day${streak === 1 ? "" : "s"}`;

  renderBoard(applications);
  renderDigest(digest);
}

refresh().catch((err) => {
  document.querySelector(".main").innerHTML = `<p class="empty-state">${escapeHtml(
    String(err.message || err)
  )} — try signing in from the extension popup first.</p>`;
});
