import process from "node:process";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type TermiiChannel = "generic" | "dnd" | "whatsapp";

const ENDPOINT = "https://api.ng.termii.com/api/sms/send";

/** Nigerian numbers arrive as 0803…, +234…, or 234… — Termii wants bare international digits. */
export function normalizePhone(n: string): string {
  const digits = n.replace(/\D/g, "");
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return "234" + digits.slice(1);
  return digits;
}

/**
 * Send one message body to one or more phones through Termii and log the attempt
 * to public.notifications. Env vars are read inside the call: on Cloudflare
 * Workers they only bind per request, never at module load.
 */
export async function sendTermiiMessage(opts: {
  supabase: SupabaseClient<Database>;
  school_id: string;
  to: string[];
  message: string;
  channel?: TermiiChannel;
  title?: string;
}): Promise<{ ok: boolean; sent: number; error: string | null }> {
  const apiKey = process.env.TERMII_API_KEY;
  const sender = process.env.TERMII_SENDER_ID || "N-Alert";
  if (!apiKey) throw new Error("Termii is not configured for this school yet");

  const channel = opts.channel ?? "generic";
  const to = Array.from(new Set(opts.to.map(normalizePhone))).filter((n) => n.length >= 10);
  if (!to.length) return { ok: false, sent: 0, error: "No usable phone number" };

  let delivered = false;
  let errorMsg: string | null = null;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        to: to.length === 1 ? to[0] : to,
        from: sender,
        sms: opts.message,
        type: "plain",
        channel: channel === "whatsapp" ? "whatsapp" : channel,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) errorMsg = (json?.message as string) || `HTTP ${res.status}`;
    else delivered = true;
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "Network error";
  }

  await opts.supabase.from("notifications").insert(
    to.map((phone) => ({
      school_id: opts.school_id,
      channel: channel === "whatsapp" ? "whatsapp" : "sms",
      title: opts.title ?? "Outgoing message",
      body: opts.message,
      meta: { phone, sender },
      delivered,
      error: errorMsg,
    })),
  );

  return { ok: delivered, sent: to.length, error: errorMsg };
}
