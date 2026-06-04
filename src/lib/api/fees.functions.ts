import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const generateInvoicesForClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    class_id: z.string().uuid(),
    fee_item_id: z.string().uuid(),
    due_date: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: item, error: iErr } = await supabase.from("fee_items").select("*").eq("id", data.fee_item_id).maybeSingle();
    if (iErr || !item) throw new Error("Fee item not found");
    const { data: students } = await supabase.from("students").select("id, school_id").eq("class_id", data.class_id);
    if (!students?.length) throw new Error("No students in class");
    const rows = students.map((s: any) => ({
      school_id: s.school_id,
      student_id: s.id,
      fee_item_id: item.id,
      title: item.name,
      session: item.session,
      term: item.term,
      amount_due: item.amount,
      due_date: data.due_date || null,
    }));
    const { error } = await supabase.from("fee_invoices").insert(rows as never);
    if (error) throw new Error(error.message);
    return { ok: true, created: rows.length };
  });

export const recordPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    invoice_id: z.string().uuid(),
    amount: z.number().positive(),
    method: z.string().min(1).max(40),
    reference: z.string().max(60).optional(),
    notes: z.string().max(300).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inv, error: iErr } = await supabase.from("fee_invoices").select("id, school_id, student_id, title").eq("id", data.invoice_id).maybeSingle();
    if (iErr || !inv) throw new Error("Invoice not found");
    const { data: pay, error } = await supabase.from("fee_payments").insert({
      school_id: inv.school_id,
      invoice_id: inv.id,
      student_id: inv.student_id,
      amount: data.amount,
      method: data.method,
      reference: data.reference || null,
      notes: data.notes || null,
      recorded_by: userId,
    } as never).select().single();
    if (error) throw new Error(error.message);

    // notify parents
    const { data: links } = await supabase.from("student_parents").select("parent_id").eq("student_id", inv.student_id);
    if (links?.length) {
      await supabase.from("parent_notifications").insert(
        links.map((l: any) => ({
          school_id: inv.school_id,
          parent_id: l.parent_id,
          student_id: inv.student_id,
          type: "general" as const,
          title: `Payment received: ${inv.title}`,
          body: `Amount: ${data.amount}. Receipt: ${(pay as any).receipt_no}`,
          meta: { payment_id: (pay as any).id, receipt_no: (pay as any).receipt_no },
          created_by: userId,
        })) as never,
      );
    }
    return { ok: true, payment: pay };
  });

export const notifyDefaulters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ school_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: count, error } = await supabase.rpc("notify_fee_defaulters", { _school_id: data.school_id, _created_by: userId });
    if (error) throw new Error(error.message);
    return { ok: true, count: count ?? 0 };
  });
