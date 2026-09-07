// The decoy frontend. Note what it does NOT do: it never lets you choose a
// patient id. It asks /api/profile who *you* are, then requests only your own
// records. Clicking around this UI can never reach another patient's data.
// The IDOR is real, but it lives at the API boundary — reachable from Postman,
// not from here.

const $ = (sel) => document.querySelector(sel);

async function api(path, opts = {}) {
  const res = await fetch(path, { credentials: "include", ...opts });
  return res;
}

async function showDashboard() {
  const res = await api("/api/profile");
  if (!res.ok) return showLogin();

  const me = await res.json();
  $("#me-name").textContent = me.displayName;
  $("#login-view").hidden = true;
  $("#dash-view").hidden = false;
  $("#logout").hidden = false;

  // Only ever our OWN id (me.id) — never a value the user typed.
  const [notes, appts] = await Promise.all([
    api(`/api/patients/${me.id}/visit-notes`).then((r) => r.json()),
    api(`/api/patients/${me.id}/appointments`).then((r) => r.json()),
  ]);

  $("#notes").innerHTML = notes.length
    ? notes
        .map(
          (n) =>
            `<div class="row"><strong>${escapeHtml(n.diagnosis)}</strong>
             <span class="muted">${new Date(n.date).toLocaleDateString("mk-MK")}</span>
             <p>${escapeHtml(n.notes)}</p></div>`,
        )
        .join("")
    : "<p class='muted'>Нема белешки.</p>";

  $("#appointments").innerHTML = appts.length
    ? appts
        .map(
          (a) =>
            `<div class="row"><strong>${escapeHtml(a.reason)}</strong>
             <span class="muted">${new Date(a.scheduledAt).toLocaleDateString("mk-MK")} · ${escapeHtml(a.status)}</span></div>`,
        )
        .join("")
    : "<p class='muted'>Нема термини.</p>";
}

function showLogin() {
  $("#dash-view").hidden = true;
  $("#login-view").hidden = false;
  $("#logout").hidden = true;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const res = await api("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: form.get("username"),
      password: form.get("password"),
    }),
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

showDashboard();
