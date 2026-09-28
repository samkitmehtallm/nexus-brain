import { flag, byUrgency, humanDue } from "/lib/status.js";

const $ = (id) => document.getElementById(id);
let DATA = { courses: [], assignments: [], deliverables: [] };
const open = new Set();   // assignment ids currently expanded

async function api(path, options = {}) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

const courseOf = (a) => DATA.courses.find((c) => c.id === a.course_id);
const delivsOf = (a) => DATA.deliverables.filter((d) => d.assignment_id === a.id);
const esc = (s) => String(s ?? "");

// ---------- summary ----------
function renderSummary() {
  const now = new Date();
  const counts = { bad: 0, warn: 0, ahead: 0, done: 0 };
  for (const a of DATA.assignments) {
    const f = flag(a, now);
    if (f.key === "submitted") counts.done++;
    else if (f.key === "overdue" || f.key === "today") counts.bad++;
    else if (f.key === "soon") counts.warn++;
    else counts.ahead++;
  }
  const cards = [
    ["bad", counts.bad, counts.bad === 1 ? "needs action now" : "need action now"],
    ["warn", counts.warn, "due within 3 days"],
    ["", counts.ahead, "further out"],
    ["done", counts.done, "submitted"],
  ];
  $("summary").innerHTML = cards
    .map(([tone, n, label]) => `<div class="stat ${tone}"><b>${n}</b><span>${label}</span></div>`)
    .join("");
}

// ---------- one assignment ----------
function itemNode(a) {
  const now = new Date();
  const f = flag(a, now);
  const course = courseOf(a);
  const ds = delivsOf(a);
  const doneCount = ds.filter((d) => d.done).length;

  const el = document.createElement("article");
  el.className = `item ${f.tone}` + (open.has(a.id) ? " open" : "");

  const head = document.createElement("div");
  head.className = "item-head";
  head.innerHTML = `
    <div class="item-main">
      <p class="item-title">${esc(a.title)}</p>
      <p class="item-sub">${esc(humanDue(a, now))}${a.weight ? " · " + esc(a.weight) : ""}</p>
    </div>
    <div class="item-right">
      ${course ? `<span class="course-tag" style="background:${esc(course.accent)}">${esc(course.code)}</span>` : ""}
      <span class="pill ${f.tone}">${esc(f.label)}</span>
      <span class="chev">${open.has(a.id) ? "▾" : "▸"}</span>
    </div>`;
  head.addEventListener("click", () => {
    open.has(a.id) ? open.delete(a.id) : open.add(a.id);
    render();
  });
  el.appendChild(head);

  const body = document.createElement("div");
  body.className = "item-body";

  if (a.detail) body.innerHTML += `<p class="item-detail">${esc(a.detail)}</p>`;

  if (ds.length) {
    body.innerHTML += `<p class="progress">Deliverables — ${doneCount} of ${ds.length} done</p>`;
    const ul = document.createElement("ul");
    ul.className = "deliverables";
    for (const d of ds) {
      const li = document.createElement("li");
      li.className = d.done ? "checked" : "";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = d.done;
      box.addEventListener("change", async () => {
        box.disabled = true;
        try {
          await api("/api/deliverable", { method: "PATCH", body: JSON.stringify({ id: d.id, done: box.checked }) });
          d.done = box.checked;
          render();
        } catch (e) { alert(e.message); box.checked = d.done; }
        box.disabled = false;
      });
      const span = document.createElement("span");
      span.textContent = d.label;
      li.append(box, span);
      ul.appendChild(li);
    }
    body.appendChild(ul);
  }

  if (a.source_url || a.artefact_url) {
    const links = document.createElement("div");
    links.className = "links";
    if (a.source_url) links.innerHTML += `<a href="${esc(a.source_url)}" target="_blank" rel="noopener">Brief in Nexus ↗</a>`;
    if (a.artefact_url) links.innerHTML += `<a href="${esc(a.artefact_url)}" target="_blank" rel="noopener">What I submitted ↗</a>`;
    body.appendChild(links);
  }

  if (a.notes) {
    const n = document.createElement("div");
    n.className = "note";
    n.textContent = a.notes;
    body.appendChild(n);
  }

  const actions = document.createElement("div");
  actions.className = "actions";
  for (const [state, label] of [["not_started", "Not started"], ["in_progress", "In progress"], ["submitted", "Submitted"]]) {
    const b = document.createElement("button");
    b.textContent = label;
    if (a.state === state) b.className = "on";
    b.addEventListener("click", async () => {
      try {
        const { assignment } = await api("/api/assignment", { method: "PATCH", body: JSON.stringify({ id: a.id, state }) });
        Object.assign(a, assignment);
        render();
      } catch (e) { alert(e.message); }
    });
    actions.appendChild(b);
  }
  const del = document.createElement("button");
  del.className = "danger";
  del.textContent = "Delete";
  del.addEventListener("click", async () => {
    if (!confirm(`Delete "${a.title}"? This cannot be undone.`)) return;
    try {
      await api(`/api/assignment?id=${a.id}`, { method: "DELETE" });
      DATA.assignments = DATA.assignments.filter((x) => x.id !== a.id);
      render();
    } catch (e) { alert(e.message); }
  });
  actions.appendChild(del);
  body.appendChild(actions);

  el.appendChild(body);
  return el;
}

// ---------- views ----------
function renderUrgency() {
  const now = new Date();
  const host = $("view-urgency");
  host.innerHTML = "";

  const live = DATA.assignments.filter((a) => a.state !== "submitted").sort((a, b) => byUrgency(a, b, now));
  const done = DATA.assignments.filter((a) => a.state === "submitted")
    .sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0));

  if (!live.length && !done.length) {
    host.innerHTML = `<div class="empty">Nothing tracked yet. Use <b>Add / import</b> to paste your assignments from Nexus.</div>`;
    return;
  }
  if (live.length) {
    host.insertAdjacentHTML("beforeend", `<p class="group-title">Outstanding — ${live.length}</p>`);
    live.forEach((a) => host.appendChild(itemNode(a)));
  } else {
    host.insertAdjacentHTML("beforeend", `<div class="empty">Nothing outstanding. Everything tracked is submitted.</div>`);
  }
  if (done.length) {
    host.insertAdjacentHTML("beforeend", `<p class="group-title">Submitted — ${done.length}</p>`);
    done.forEach((a) => host.appendChild(itemNode(a)));
  }
}

function renderByCourse() {
  const now = new Date();
  const host = $("view-course");
  host.innerHTML = "";
  for (const c of DATA.courses) {
    const mine = DATA.assignments.filter((a) => a.course_id === c.id).sort((a, b) => byUrgency(a, b, now));
    const doneN = mine.filter((a) => a.state === "submitted").length;
    host.insertAdjacentHTML("beforeend",
      `<p class="group-title" style="color:${esc(c.accent)}">${esc(c.name)}${c.cohort ? " · " + esc(c.cohort) : ""}
       — ${doneN}/${mine.length} done</p>`);
    if (!mine.length) {
      host.insertAdjacentHTML("beforeend", `<div class="empty">Nothing tracked for this course yet.</div>`);
      continue;
    }
    mine.forEach((a) => host.appendChild(itemNode(a)));
  }
}

function fillCourseSelects() {
  const opts = DATA.courses.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  $("paste-course").innerHTML = opts;
  $("new-course").innerHTML = opts;
}

function render() {
  renderSummary();
  renderUrgency();
  renderByCourse();
}

// ---------- tabs ----------
document.querySelectorAll(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === t));
    for (const v of ["urgency", "course", "add"]) $(`view-${v}`).hidden = v !== t.dataset.view;
  });
});

// ---------- import ----------
let parsed = [];
$("btn-parse").addEventListener("click", async () => {
  $("import-error").hidden = true;
  const text = $("paste-box").value.trim();
  if (!text) return;
  try {
    const out = await api("/api/import", { method: "POST", body: JSON.stringify({ text }) });
    parsed = out.parsed;
    const host = $("parse-preview");
    if (!parsed.length) {
      host.innerHTML = `<p class="muted" style="margin-top:12px">Nothing recognisable in that text.</p>`;
      return;
    }
    host.innerHTML =
      `<div class="preview">` +
      parsed.map((p, i) => `
        <div class="preview-row">
          <input type="checkbox" data-i="${i}" checked />
          <span class="t">${esc(p.title)}</span>
          <span class="d ${p.due_at ? "" : "none"}">${p.due_at
            ? new Date(p.due_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })
            : "no date found"}</span>
        </div>`).join("") +
      `</div><button id="btn-confirm" class="primary">Add the ticked ones</button>`;

    $("btn-confirm").addEventListener("click", async () => {
      const picks = [...host.querySelectorAll("input[type=checkbox]:checked")].map((b) => parsed[+b.dataset.i]);
      const course_id = +$("paste-course").value;
      const btn = $("btn-confirm");
      btn.disabled = true;
      try {
        for (const p of picks) {
          await api("/api/assignment", { method: "POST", body: JSON.stringify({ ...p, course_id }) });
        }
        await load();
        $("paste-box").value = "";
        host.innerHTML = `<p class="muted" style="margin-top:12px">Added ${picks.length}. Check the urgency view.</p>`;
      } catch (e) { $("import-error").textContent = e.message; $("import-error").hidden = false; }
      btn.disabled = false;
    });
  } catch (e) {
    $("import-error").textContent = e.message;
    $("import-error").hidden = false;
  }
});

// ---------- manual add ----------
$("btn-add").addEventListener("click", async () => {
  $("add-error").hidden = true;
  const title = $("new-title").value.trim();
  if (!title) { $("add-error").textContent = "Give it a title."; $("add-error").hidden = false; return; }
  const local = $("new-due").value;   // datetime-local has no zone; treat it as IST
  const body = {
    title,
    course_id: +$("new-course").value,
    due_at: local ? `${local}:00+05:30` : null,
    weight: $("new-weight").value.trim() || null,
    detail: $("new-detail").value.trim() || null,
  };
  $("btn-add").disabled = true;
  try {
    await api("/api/assignment", { method: "POST", body: JSON.stringify(body) });
    await load();
    ["new-title", "new-due", "new-weight", "new-detail"].forEach((id) => ($(id).value = ""));
    document.querySelector('.tab[data-view="urgency"]').click();
  } catch (e) { $("add-error").textContent = e.message; $("add-error").hidden = false; }
  $("btn-add").disabled = false;
});

// ---------- boot ----------
async function load() {
  DATA = await api("/api/data");
  fillCourseSelects();
  render();
}

load().catch((e) => {
  $("view-urgency").innerHTML = `<p class="error">${esc(e.message)}</p>`;
});
