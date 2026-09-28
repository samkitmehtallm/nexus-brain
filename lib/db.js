import { createClient } from "@supabase/supabase-js";

let client = null;
export function db() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_KEY must be set");
  client = createClient(url, key);
  return client;
}
