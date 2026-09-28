import { parseAssignments } from "../lib/parse.js";

// Preview only — never writes. You see exactly what was understood from the pasted text
// and confirm before anything lands in the database.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { text, year } = req.body || {};
    const parsed = parseAssignments(text, year || new Date().getFullYear());
    res.status(200).json({ parsed, count: parsed.length });
  } catch (e) {
    console.error("import error:", e);
    res.status(500).json({ error: e.message });
  }
}
