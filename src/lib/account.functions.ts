import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// The service-role client must stay in server-only code. Never import it at the
// top level of this file: *.functions.ts ships to the client bundle. Import it
// dynamically inside the handler so only the server build carries the key.
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ confirmUsername: z.string().min(1).max(24) }))
  .handler(async ({ data, context }) => {
    const { data: profile, error: profileError } = await context.supabase.rpc("my_profile");
    if (profileError) throw new Error(profileError.message);
    const username = (profile as { username?: string } | null)?.username;
    if (!username) throw new Error("Your profile could not be loaded. Please try again.");
    if (data.confirmUsername.trim().toLowerCase() !== username.toLowerCase()) {
      throw new Error("That doesn't match your username.");
    }

    const { data: isAdmin, error: adminError } = await context.supabase.rpc("is_admin");
    if (adminError) throw new Error(adminError.message);
    if (isAdmin === true) throw new Error("Admin accounts can't be deleted here.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (deleteError) throw new Error(deleteError.message);

    try {
      const { error: purgeError } = await supabaseAdmin.rpc("purge_orphan_reports");
      if (purgeError) console.error("[account.deleteMyAccount] purge_orphan_reports failed", purgeError);
    } catch (err) {
      console.error("[account.deleteMyAccount] purge_orphan_reports failed", err);
    }

    return { ok: true as const };
  });
