// The one piece of logic the whole tool exists for: turning a due date into a state
// you can act on. Deliberately shared by the API and the front end so a deadline can
// never be flagged one way on the dashboard and another way in the detail view.

export const STATES = {
  submitted: { label: "Submitted", tone: "done", rank: 5 },
  overdue: { label: "Overdue", tone: "bad", rank: 0 },
  today: { label: "Due today", tone: "bad", rank: 1 },
  soon: { label: "Due soon", tone: "warn", rank: 2 },
  week: { label: "This week", tone: "mild", rank: 3 },
  upcoming: { label: "Upcoming", tone: "calm", rank: 4 },
  undated: { label: "No date set", tone: "calm", rank: 4.5 },
};

const DAY = 24 * 60 * 60 * 1000;

export function flag(assignment, now = new Date()) {
  if (assignment.state === "submitted") return { key: "submitted", ...STATES.submitted, days: null };
  if (!assignment.due_at) return { key: "undated", ...STATES.undated, days: null };

  const due = new Date(assignment.due_at);
  const ms = due - now;
  const days = Math.ceil(ms / DAY);

  let key;
  if (ms < 0) key = "overdue";
  else if (ms <= DAY) key = "today";
  else if (ms <= 3 * DAY) key = "soon";
  else if (ms <= 7 * DAY) key = "week";
  else key = "upcoming";

  return { key, ...STATES[key], days };
}

// Most urgent first. Undated work sinks below anything with a real deadline, because a
// task with no date should never outrank one that is actually about to be late.
export function byUrgency(a, b, now = new Date()) {
  const fa = flag(a, now);
  const fb = flag(b, now);
  if (fa.rank !== fb.rank) return fa.rank - fb.rank;
  if (a.due_at && b.due_at) return new Date(a.due_at) - new Date(b.due_at);
  if (a.due_at) return -1;
  if (b.due_at) return 1;
  return a.title.localeCompare(b.title);
}

export function humanDue(assignment, now = new Date()) {
  if (!assignment.due_at) return "No due date";
  const due = new Date(assignment.due_at);
  const f = flag(assignment, now);
  const when = due.toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
  if (assignment.state === "submitted") return `Was due ${when}`;
  if (f.key === "overdue") {
    const late = Math.abs(f.days);
    return `${when} · ${late} day${late === 1 ? "" : "s"} overdue`;
  }
  if (f.key === "today") return `${when} · due within 24 hours`;
  return `${when} · ${f.days} day${f.days === 1 ? "" : "s"} left`;
}
