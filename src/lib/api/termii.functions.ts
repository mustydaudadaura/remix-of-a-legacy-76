import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendTermiiMessage } from "@/lib/termii.server";

const SendSmsInput = z.object({
  school_id: z.string().uuid(),
  to: z.array(z.string().min(7).max(20)).min(1).max(500),
  message: z.string().min(1).max(459),
  channel: z.enum(["generic", "dnd", "whatsapp"]).default("generic"),
});

/**
 * Send SMS / WhatsApp via Termii to an explicit list of numbers.
 * Every delivery is logged to public.notifications by the shared helper.
 */
export const sendTermiiSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SendSmsInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: staffOk } = await context.supabase.rpc("school_permission", {
      _user_id: context.userId,
      _school_id: data.school_id,
      _permission: "communication.edit",
    });
    if (!staffOk) throw new Error("Not authorized");

    const r = await sendTermiiMessage({
      supabase: context.supabase,
      school_id: data.school_id,
      to: data.to,
      message: data.message,
      channel: data.channel,
      title: "Outgoing message",
    });
    return { ok: r.ok, sent: r.sent, error: r.error };
  });
