// The decoy frontend. Note what it does NOT do: it never lets you choose a patient
// id. It asks /api/profile who *you* are, then requests only your own records
// (/api/patients/<me.id>/...). Clicking around this UI can never reach another
// patient's data. The IDOR is real, but it lives at the API boundary — reachable
// from Postman, not from here.

const $ = (sel) => document.querySelector(sel);

let me = null;
const loaded = new Set(); // tabs whose data we've already fetched

async function api(path, opts = {}) {
  return fetch(path, { credentials: "include", ...opts });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
const fmtDate = (d) => new Date(d).toLocaleDateString("mk-MK", { year: "numeric", month: "short", day: "numeric" });

function empty(msg) {
  return `<div class="empty">${escapeHtml(msg)}</div>`;
}
function loading() {
  return `<div class="empty">Се вчитува…</div>`;
}

const STATUS_MK = {
  scheduled: "закажан",
  completed: "завршен",
  cancelled: "откажан",
  "no-show": "непојавен",
};

// ── data loaders (each only ever uses me.id) ────────────────────────────────

async function loadOverview() {
  const el = $("#panel-overview");
  el.innerHTML = `
    <div class="card profile-card">
      <div class="avatar-lg">${escapeHtml(me.displayName[0])}</div>
      <div class="profile-fields">
        <h2>${escapeHtml(me.displayName)}</h2>
        <dl>
          <div><dt>Корисник</dt><dd>${escapeHtml(me.username)}</dd></div>
          <div><dt>Улога</dt><dd>${escapeHtml(me.role)}</dd></div>
          <div><dt>Датум на раѓање</dt><dd>${fmtDate(me.dateOfBirth)}</dd></div>
          <div><dt>Пациент бр.</dt><dd>#${escapeHtml(me.id)}</dd></div>
        </dl>
      </div>
    </div>`;
}

async function loadNotes() {
  const el = $("#panel-notes");
  el.innerHTML = loading();
  const notes = await api(`/api/patients/${me.id}/visit-notes`).then((r) => r.json());
  $("#count-notes").textContent = notes.length || "";
  el.innerHTML = notes.length
    ? notes
        .map(
          (n) => `
      <article class="card record">
        <div class="record-head">
          <span class="badge">Дијагноза</span>
          <time>${fmtDate(n.date)}</time>
        </div>
        <h3>${escapeHtml(n.diagnosis)}</h3>
        <p>${escapeHtml(n.notes)}</p>
      </article>`,
        )
        .join("")
    : empty("Нема белешки од прегледи.");
}

async function loadAppointments() {
  const el = $("#panel-appointments");
  el.innerHTML = loading();
  const appts = await api(`/api/patients/${me.id}/appointments`).then((r) => r.json());
  $("#count-appointments").textContent = appts.length || "";
  el.innerHTML = appts.length
    ? `<div class="list">${appts
        .map(
          (a) => `
      <div class="row">
        <div class="row-main">
          <strong>${escapeHtml(a.reason)}</strong>
          <span class="muted">${fmtDate(a.scheduledAt)}</span>
        </div>
        <span class="status status-${escapeHtml(a.status)}">${escapeHtml(STATUS_MK[a.status] ?? a.status)}</span>
      </div>`,
        )
        .join("")}</div>`
    : empty("Нема закажани термини.");
}

async function loadPrescriptions() {
  const el = $("#panel-prescriptions");
  el.innerHTML = loading();
  const scripts = await api(`/api/patients/${me.id}/prescriptions`).then((r) => r.json());
  $("#count-prescriptions").textContent = scripts.length || "";
  el.innerHTML = scripts.length
    ? `<div class="list">${scripts
        .map(
          (p) => `
      <div class="row">
        <div class="row-main">
          <strong>💊 ${escapeHtml(p.drug)}</strong>
          <span class="muted">${escapeHtml(p.dosage)}</span>
        </div>
        <span class="status ${p.active ? "status-scheduled" : "status-cancelled"}">${p.active ? "активна" : "неактивна"}</span>
      </div>`,
        )
        .join("")}</div>`
    : empty("Нема пропишани терапии.");
}

const LOADERS = {
  overview: loadOverview,
  notes: loadNotes,
  appointments: loadAppointments,
  prescriptions: loadPrescriptions,
};

// ── tabs ────────────────────────────────────────────────────────────────────

function switchTab(name) {
  document.querySelectorAll(".tab").forEach((t) => {
    const active = t.dataset.tab === name;
    t.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll(".panel").forEach((p) => {
    p.hidden = p.id !== `panel-${name}`;
  });
  if (!loaded.has(name)) {
    loaded.add(name);
    LOADERS[name]().catch((e) => {
      loaded.delete(name);
      $(`#panel-${name}`).innerHTML = empty("Грешка при вчитување.");
      console.error(e);
    });
  }
}

// ── session ──────────────────────────────────────────────────────────────────

async function showDashboard() {
  const res = await api("/api/profile");
  if (!res.ok) return showLogin();
  me = await res.json();

  $("#me-name").textContent = me.displayName;
  $("#me-initial").textContent = me.displayName[0];
  $("#user-area").hidden = false;
  $("#login-view").hidden = true;
  $("#dash-view").hidden = false;

  loaded.clear();
  // Prefetch counts for notes/appointments/prescriptions so the tab badges fill in.
  switchTab("overview");
  ["notes", "appointments", "prescriptions"].forEach((name) => {
    loaded.add(name);
    LOADERS[name]().catch(() => loaded.delete(name));
  });
  // Re-show the overview panel (the prefetch above rendered into hidden panels).
  document.querySelectorAll(".panel").forEach((p) => (p.hidden = p.id !== "panel-overview"));
}

function showLogin() {
  me = null;
  $("#dash-view").hidden = true;
  $("#user-area").hidden = true;
  $("#login-view").hidden = false;
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const res = await api("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
  });
  if (res.ok) {
    $("#login-error").hidden = true;
    showDashboard();
  } else {
    $("#login-error").textContent = "Неточно корисничко име или лозинка.";
    $("#login-error").hidden = false;
  }
});

$("#logout").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  showLogin();
});

document.querySelectorAll(".tab").forEach((t) =>
  t.addEventListener("click", () => switchTab(t.dataset.tab)),
);

showDashboard();
