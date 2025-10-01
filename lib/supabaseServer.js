import { createClient } from "@supabase/supabase-js";

const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // server-only
);

export default supabaseServer;
