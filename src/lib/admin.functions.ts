import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

// The service-role client must stay in server-only code. Never import it at the
// top level of this file: *.functions.ts ships to the client bundle. Import it
// dynamically inside the handlers so only the server build carries the key.
const SERVICE_ROLE_WARNING =
  "This account was restricted, but the sign-in lock could not be applied. Check the server's service-role configuration.";

async function assertAdmin(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Not authorized");
}

export const banAuthor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      type: z.enum(["post", "comment"]),
      targetId: z.string().uuid(),
      reason: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);

    const { data: banId, error } = await context.supabase.rpc("admin_ban_author_of", {
      p_type: data.type,
      p_target: data.targetId,
      p_reason: data.reason ?? "",
    });
    if (error) throw new Error(error.message);
    if (!banId) throw new Error("This account could not be restricted.");

    let warning: string | null = null;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: ban, error: readError } = await supabaseAdmin
        .from("bans")
        .select("user_id")
        .eq("id", banId)
        .single();
      if (readError || !ban) throw new Error(readError?.message ?? "Ban not found");
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(ban.user_id, {
        ban_duration: "876000h",
      });
      if (authError) throw new Error(authError.message);
    } catch (err) {
      warning = SERVICE_ROLE_WARNING;
      console.error("[admin.banAuthor]", err);
    }

    return { ok: true as const, warning };
  });

export const unban = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ banId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);

    let userId: string | null = null;
    let warning: string | null = null;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: ban, error: readError } = await supabaseAdmin
        .from("bans")
        .select("user_id")
        .eq("id", data.banId)
        .maybeSingle();
      if (readError) throw new Error(readError.message);
      userId = ban?.user_id ?? null;
    } catch (err) {
      warning = SERVICE_ROLE_WARNING;
      console.error("[admin.unban]", err);
    }

    const { data: ok, error } = await context.supabase.rpc("admin_unban", { p_ban: data.banId });
    if (error) throw new Error(error.message);
    if (!ok) throw new Error("This ban no longer exists.");

    if (userId) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: "none",
        });
        if (authError) throw new Error(authError.message);
      } catch (err) {
        warning = SERVICE_ROLE_WARNING;
        console.error("[admin.unban]", err);
      }
    }

    return { ok: true as const, warning };
  });
