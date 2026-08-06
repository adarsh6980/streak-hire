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

const els = {
  signedOutView: document.getElementById("signed-out-view"),
  signedInView: document.getElementById("signed-in-view"),
  profile: document.getElementById("profile"),
  profilePhoto: document.getElementById("profile-photo"),
  signInBtn: document.getElementById("sign-in-btn"),
  signOutBtn: document.getElementById("sign-out-btn"),
  streakCount: document.getElementById("streak-count"),
  streakLongest: document.getElementById("streak-longest"),
  streakDays: document.getElementById("streak-days"),
  manualLogBtn: document.getElementById("manual-log-btn"),
  manualForm: document.getElementById("manual-log-form"),
  manualCompany: document.getElementById("manual-company"),
  manualRole: document.getElementById("manual-role"),
  manualResume: document.getElementById("manual-resume"),
  manualCancelBtn: document.getElementById("manual-cancel-btn"),
  recentList: document.getElementById("recent-list"),
  recentEmpty: document.getElementById("recent-empty"),
  statusText: document.getElementById("status-text"),
  openDashboardBtn: document.getElementById("open-dashboard-btn"),
  scrapeLogBtn: document.getElementById("scrape-log-btn"),
  scrapeStatus: document.getElementById("scrape-status"),
};

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function renderStreakDays(current) {
  els.streakDays.innerHTML = "";
  const today = new Date().getDay();
  for (let i = 6; i >= 0; i--) {
    const dayIndex = (today - i + 7) % 7;
    const el = document.createElement("div");
    el.className = "streak-day" + (i < Math.min(current, 7) ? " filled" : "");
    el.title = DAY_LABELS[dayIndex];
    els.streakDays.appendChild(el);
  }
}

function renderRecent(applications) {
  els.recentList.innerHTML = "";
  if (!applications || applications.length === 0) {
    els.recentEmpty.classList.remove("hidden");
    return;
  }
  els.recentEmpty.classList.add("hidden");
  for (const app of applications) {
    const li = document.createElement("li");
    li.className = "recent-item";
    li.innerHTML = `
      <div class="recent-item-text">
        <div class="recent-item-role">${escapeHtml(app.role || "Role")}</div>
        <div class="recent-item-company">${escapeHtml(app.company || "")}</div>
      </div>
      <span class="recent-item-badge">${app.auto ? "auto" : "manual"}</span>
    `;
    els.recentList.appendChild(li);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderSignedIn(state) {
  els.signedOutView.classList.add("hidden");
  els.signedInView.classList.remove("hidden");
  els.profile.classList.remove("hidden");

  if (state.profile?.photoURL) {
    els.profilePhoto.src = state.profile.photoURL;
    els.profilePhoto.style.display = "";
  } else {
    els.profilePhoto.style.display = "none";
  }

  const current = state.streak?.current || 0;
  const longest = state.streak?.longest || 0;
  els.streakCount.textContent = `${current} day${current === 1 ? "" : "s"}`;
  els.streakLongest.textContent = longest > current ? `Longest: ${longest} days` : "";
  renderStreakDays(current);
  renderRecent(state.recentApplications);
}

function renderSignedOut() {
  els.signedOutView.classList.remove("hidden");
  els.signedInView.classList.add("hidden");
  els.profile.classList.add("hidden");
}

async function refresh() {
  els.statusText.textContent = "Loading…";
  try {
    const state = await sendMessage("GET_STATE");
    if (state.signedIn) {
      renderSignedIn(state);
    } else {
      renderSignedOut();
    }
    els.statusText.textContent = "";
  } catch (err) {
    els.statusText.textContent = String(err.message || err);
  }
}

els.signInBtn.addEventListener("click", async () => {
  els.signInBtn.disabled = true;
  els.statusText.textContent = "Signing in…";
  try {
    await sendMessage("SIGN_IN");
    await refresh();
  } catch (err) {
    els.statusText.textContent = String(err.message || err);
  } finally {
    els.signInBtn.disabled = false;
  }
});

els.signOutBtn.addEventListener("click", async () => {
  await sendMessage("SIGN_OUT");
  await refresh();
});

els.scrapeLogBtn.addEventListener("click", async () => {
  els.scrapeLogBtn.disabled = true;
  els.scrapeLogBtn.textContent = "Scraping this page…";
  els.scrapeStatus.classList.remove("hidden");
  els.scrapeStatus.textContent = "";
  try {
    const result = await sendMessage("SCRAPE_AND_LOG_ACTIVE_TAB");
    els.scrapeStatus.textContent = `Postmarked: ${result.application.role} at ${result.application.company}`;
    await refresh();
  } catch (err) {
    const message = String(err.message || err);
    els.scrapeStatus.textContent = message.includes("Not signed in")
      ? "Sign in first, then try again."
      : message;
  } finally {
    els.scrapeLogBtn.disabled = false;
    els.scrapeLogBtn.textContent = "Missed one? Scrape this page & log it";
  }
});

els.manualLogBtn.addEventListener("click", () => {
  els.manualForm.classList.toggle("hidden");
});

els.manualCancelBtn.addEventListener("click", () => {
  els.manualForm.classList.add("hidden");
});

els.manualForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const company = els.manualCompany.value.trim();
  const role = els.manualRole.value.trim();
  if (!company || !role) return;

  const resumeFileName = els.manualResume.value.trim() || null;

  els.statusText.textContent = "Postmarking…";
  try {
    await sendMessage("LOG_APPLICATION", { company, role, source: "manual", resumeFileName });
    els.manualCompany.value = "";
    els.manualRole.value = "";
    els.manualResume.value = "";
    els.manualForm.classList.add("hidden");
    await refresh();
  } catch (err) {
    els.statusText.textContent = String(err.message || err);
  }
});

els.openDashboardBtn.addEventListener("click", () => {
  sendMessage("OPEN_DASHBOARD");
});

refresh();
