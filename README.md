# Nexus Brain

A companion for the [Nexus LMS](https://students.mesaschool.co.in/student/lms): every
assignment flagged by how close its deadline is, broken into deliverables, and organised
by course.

**Live:** https://nexus-brain-noreply6.vercel.app

## Why it exists

Nexus tells you an assignment exists. It doesn't tell you which one is about to bite,
what the brief actually asks you to hand over, or how the pieces of a course fit
together. This does those three things.

## What it does

**Deadline flagging.** Everything is sorted most-urgent-first and colour-coded:

| Flag | Meaning |
|---|---|
| Overdue | past its deadline, not submitted |
| Due today | within 24 hours |
| Due soon | within 3 days |
| This week | within 7 days |
| Upcoming | further out |
| Submitted | filed away, out of the main list |

Undated work always sinks below anything with a real deadline — a task with no date
should never outrank one about to be late.

**Deliverables.** Most briefs ask for several things ("nine checks", "components map",
"live URL"). Each is a separate tickable item, so the shape of the work is visible
instead of buried in a PDF.

**Two views.** *By urgency* answers "what do I do now". *By course* gives the curriculum
structure — each course with its own progress count.

## The Nexus limitation, stated plainly

Nexus sits behind an institutional login, and there's no public API or feed. Nothing can
be pulled automatically, and handing over portal credentials isn't a sensible trade.

So instead: **Add / import** takes text pasted straight out of the portal and reads the
titles and dates out of it. The parser is deterministic — plain pattern matching, no LLM,
no API quota — and it shows you exactly what it understood before anything is saved.

Handles `2 October 2026`, `Oct 16`, `2026-10-09`, `02/11/2026 9:00 am`, and the common
portal layout where a title sits on one line and `Due: ...` on the next. Times are read
as IST; a date with no time defaults to 11:59 pm.

## Layout

```
index.html / styles.css / app.js   Three views: urgency, course, add/import
lib/status.js                      Due date -> flag. Shared by API and front end,
                                   so a deadline can't be flagged two different ways
lib/parse.js                       The paste parser
api/data.js                        Everything in one call
api/assignment.js                  Create / update state / delete
api/deliverable.js                 Tick items off
api/import.js                      Parse preview — never writes
```

Data lives in Supabase (`nexus_courses`, `nexus_assignments`, `nexus_deliverables`).

## Running locally

```bash
npm install
cp .env.example .env   # add SUPABASE_URL and SUPABASE_KEY
```

## One thing to keep in mind

Ticking a deliverable here doesn't submit anything. Nexus is still where work gets
handed in — this only tracks it.
