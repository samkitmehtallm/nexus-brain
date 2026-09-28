import { db } from "../lib/db.js";

export default async function handler(req, res) {
  try {
    const supabase = db();

    if (req.method === "POST") {
      const { assignment_id, label, position } = req.body || {};
      if (!assignment_id || !label) return res.status(400).json({ error: "assignment_id and label are required" });
      const { data, error } = await supabase.from("nexus_deliverables")
        .insert({ assignment_id, label, position: position ?? 99 }).select().single();
      if (error) throw new Error(error.message);
      return res.status(200).json({ deliverable: data });
    }

    if (req.method === "PATCH") {
      const { id, done } = req.body || {};
      if (!id) return res.status(400).json({ error: "id is required" });
      const { data, error } = await supabase.from("nexus_deliverables")
        .update({ done: !!done }).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return res.status(200).json({ deliverable: data });
    }

    if (req.method === "DELETE") {
      const id = req.query.id || (req.body || {}).id;
      if (!id) return res.status(400).json({ error: "id is required" });
      const { error } = await supabase.from("nexus_deliverables").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("deliverable error:", e);
    res.status(500).json({ error: e.message });
  }
}
