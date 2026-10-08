import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SendSmsInput = z.object({
  school_id: z.string().uuid(),
  to: z.array(z.string().min(7).max(20)).min(1).max(500),
  message: z.string().min(1).max(459),
  channel: z.enum(["generic", "dnd", "whatsapp"]).default("generic"),
});

/**
 * Send SMS / WhatsApp via Termii.
 * Docs: https://developer.termii.com/messaging-api
 * Logs each delivery to public.notifications.
 */
export const sendTermiiSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SendSmsInput.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.TERMII_API_KEY;
    const sender = process.env.TERMII_SENDER_ID || "N-Alert";
    if (!apiKey) throw new Error("TERMII_API_KEY not configured");

    const { data: staffOk } = await context.supabase.rpc("school_permission", {
      _user_id: context.userId,
      _school_id: data.school_id,
      _permission: "communication.edit",
    });
    if (!staffOk) throw new Error("Not authorized");

    // Normalize Nigerian numbers to international 234 format
    const normalize = (n: string) => {
      const digits = n.replace(/\D/g, "");
      if (digits.startsWith("234")) return digits;
      if (digits.startsWith("0")) return "234" + digits.slice(1);
      return digits;
    };
    const to = data.to.map(normalize);

    const endpoint =
      data.channel === "whatsapp"
        ? "https://api.ng.termii.com/api/sms/send"
        : "https://api.ng.termii.com/api/sms/send";

    const body = {
      api_key: apiKey,
      to: to.length === 1 ? to[0] : to,
      from: sender,
      sms: data.message,
      type: "plain",
      channel: data.channel === "whatsapp" ? "whatsapp" : data.channel,
    };

    let delivered = false;
    let errorMsg: string | null = null;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        errorMsg = (json?.message as string) || `HTTP ${res.status}`;
      } else {
        delivered = true;
      }
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : "Network error";
    }

    // Log
    await context.supabase.from("notifications").insert(
      to.map((phone) => ({
        school_id: data.school_id,
        channel: data.channel === "whatsapp" ? "whatsapp" : "sms",
        title: "Outgoing message",
        body: data.message,
        meta: { phone, sender },
        delivered,
        error: errorMsg,
      })),
    );

    return { ok: delivered, sent: to.length, error: errorMsg };
  });
