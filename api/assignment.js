import { db } from "../lib/db.js";

const FIELDS = ["course_id","title","detail","due_at","weight","state","source_url","artefact_url","notes"];

export default async function handler(req, res) {
  try {
    const supabase = db();

    if (req.method === "POST") {
      const body = req.body || {};
      if (!body.title) return res.status(400).json({ error: "title is required" });
      const row = {};
      for (const f of FIELDS) if (body[f] !== undefined) row[f] = body[f];
      const { data, error } = await supabase.from("nexus_assignments").insert(row).select().single();
      if (error) throw new Error(error.message);
      return res.status(200).json({ assignment: data });
    }

    if (req.method === "PATCH") {
      const { id, ...rest } = req.body || {};
      if (!id) return res.status(400).json({ error: "id is required" });
      const row = { updated_at: new Date().toISOString() };
      for (const f of FIELDS) if (rest[f] !== undefined) row[f] = rest[f];
      // Marking something submitted should stamp when — that is the audit trail.
      if (rest.state === "submitted") row.submitted_at = new Date().toISOString();
      if (rest.state && rest.state !== "submitted") row.submitted_at = null;
      const { data, error } = await supabase.from("nexus_assignments").update(row).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return res.status(200).json({ assignment: data });
    }

    if (req.method === "DELETE") {
      const id = req.query.id || (req.body || {}).id;
      if (!id) return res.status(400).json({ error: "id is required" });
      const { error } = await supabase.from("nexus_assignments").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("assignment error:", e);
    res.status(500).json({ error: e.message });
  }
}
