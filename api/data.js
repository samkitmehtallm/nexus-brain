import { db } from "../lib/db.js";

// One call returns the whole picture. The dataset is a single student's coursework —
// small enough that paginating it would add complexity and buy nothing.
export default async function handler(req, res) {
  try {
    const supabase = db();
    const [{ data: courses }, { data: assignments }, { data: deliverables }] = await Promise.all([
      supabase.from("nexus_courses").select("*").order("position"),
      supabase.from("nexus_assignments").select("*").order("due_at", { nullsFirst: false }),
      supabase.from("nexus_deliverables").select("*").order("position"),
    ]);
    res.status(200).json({
      courses: courses || [],
      assignments: assignments || [],
      deliverables: deliverables || [],
      server_now: new Date().toISOString(),
    });
  } catch (e) {
    console.error("data error:", e);
    res.status(500).json({ error: e.message });
  }
}
