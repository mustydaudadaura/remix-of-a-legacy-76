import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TokenOnly = z.object({ token: z.string().min(10) });
const WithChild = z.object({ token: z.string().min(10), student_id: z.string().uuid().optional() });

async function verify(token: string) {
  const { verifyParentToken } = await import("@/lib/parent-auth.server");
  return verifyParentToken(token);
}
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** List parent's children + school. */
export const getPortalContext = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenOnly.parse(d))
  .handler(async ({ data }) => {
    const claims = await verify(data.token);
    const db = await admin();
    const [{ data: parent }, { data: school }, { data: links }] = await Promise.all([
      db.from("parents").select("id, full_name, phone, email").eq("id", claims.parent_id).maybeSingle(),
      db.from("schools").select("id, name, logo_url, code, phone, address, motto, current_session, current_term").eq("id", claims.school_id).maybeSingle(),
      db.from("student_parents").select("is_primary, students(id, admission_no, first_name, last_name, photo_url, classes(name))").eq("parent_id", claims.parent_id),
    ]);
    const students = (links ?? []).map((l: any) => l.students).filter(Boolean);
    return { parent, school, students };
  });

export const getPortalSummary = createServerFn({ method: "POST" })
  .inputValidator((d) => WithChild.parse(d))
  .handler(async ({ data }) => {
    const claims = await verify(data.token);
    const db = await admin();
    const sid = data.student_id;
    if (!sid) return { attendance: { present: 0, total: 0 }, balance: 0, unreadCount: 0, latestReport: null };

    // confirm sid belongs to parent
    const { data: ok } = await db.from("student_parents").select("student_id").eq("parent_id", claims.parent_id).eq("student_id", sid).maybeSingle();
    if (!ok) throw new Error("Not your child");

    const since = new Date(); since.setDate(since.getDate() - 30);
    const [{ data: att }, { data: invs }, { data: notifs }, { data: rc }] = await Promise.all([
      db.from("attendance").select("status").eq("student_id", sid).gte("date", since.toISOString().slice(0, 10)),
      db.from("fee_invoices").select("amount_due, amount_paid, status").eq("student_id", sid),
      db.from("parent_notifications").select("id", { count: "exact", head: true }).eq("parent_id", claims.parent_id).is("read_at", null),
      db.from("report_cards").select("id, session, term, average, position, class_size, published").eq("student_id", sid).eq("published", true).order("created_at", { ascending: false }).limit(1),
    ]);
    const present = (att ?? []).filter((a: any) => a.status === "present" || a.status === "late").length;
    const total = (att ?? []).length;
    const balance = (invs ?? []).reduce((s: number, i: any) => s + (Number(i.amount_due) - Number(i.amount_paid)), 0);
    return {
      attendance: { present, total },
      balance,
      unreadCount: (notifs as any)?.length ?? 0,
      latestReport: rc?.[0] ?? null,
    };
  });

export const getPortalAttendance = createServerFn({ method: "POST" })
  .inputValidator((d) => WithChild.extend({ from: z.string(), to: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const claims = await verify(data.token);
    const db = await admin();
    const { data: ok } = await db.from("student_parents").select("student_id").eq("parent_id", claims.parent_id).eq("student_id", data.student_id!).maybeSingle();
    if (!ok) throw new Error("Not your child");
    const { data: rows } = await db.from("attendance").select("date, status, note").eq("student_id", data.student_id!).gte("date", data.from).lte("date", data.to).order("date", { ascending: false });
    return { rows: rows ?? [] };
  });

export const getPortalReportCards = createServerFn({ method: "POST" })
  .inputValidator((d) => WithChild.parse(d))
  .handler(async ({ data }) => {
    const claims = await verify(data.token);
    const db = await admin();
    const { data: ok } = await db.from("student_parents").select("student_id").eq("parent_id", claims.parent_id).eq("student_id", data.student_id!).maybeSingle();
    if (!ok) throw new Error("Not your child");
    const { data: rows } = await db.from("report_cards").select("id, session, term, average, total_score, position, class_size, gpa, published, verification_code").eq("student_id", data.student_id!).eq("published", true).order("created_at", { ascending: false });
    return { rows: rows ?? [] };
  });

export const getPortalFees = createServerFn({ method: "POST" })
  .inputValidator((d) => WithChild.parse(d))
  .handler(async ({ data }) => {
    const claims = await verify(data.token);
    const db = await admin();
    const { data: ok } = await db.from("student_parents").select("student_id").eq("parent_id", claims.parent_id).eq("student_id", data.student_id!).maybeSingle();
    if (!ok) throw new Error("Not your child");
    const [{ data: invoices }, { data: payments }] = await Promise.all([
      db.from("fee_invoices").select("id, title, session, term, amount_due, amount_paid, status, due_date").eq("student_id", data.student_id!).order("created_at", { ascending: false }),
      db.from("fee_payments").select("id, invoice_id, amount, method, reference, paid_at, receipt_no").eq("student_id", data.student_id!).order("paid_at", { ascending: false }),
    ]);
    return { invoices: invoices ?? [], payments: payments ?? [] };
  });

export const getPortalNotifications = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenOnly.parse(d))
  .handler(async ({ data }) => {
    const claims = await verify(data.token);
    const db = await admin();
    const { data: rows } = await db.from("parent_notifications").select("id, type, title, body, meta, read_at, created_at, student_id").eq("parent_id", claims.parent_id).order("created_at", { ascending: false }).limit(100);
    return { rows: rows ?? [] };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenOnly.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const claims = await verify(data.token);
    const db = await admin();
    await db.from("parent_notifications").update({ read_at: new Date().toISOString() }).eq("id", data.id).eq("parent_id", claims.parent_id);
    return { ok: true };
  });

export const getReceipt = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenOnly.extend({ payment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const claims = await verify(data.token);
    const db = await admin();
    const { data: p } = await db.from("fee_payments").select("id, amount, method, reference, paid_at, receipt_no, invoice_id, student_id, school_id, notes").eq("id", data.payment_id).maybeSingle();
    if (!p) throw new Error("Receipt not found");
    if (p.school_id !== claims.school_id) throw new Error("Not authorized");
    const { data: ok } = await db.from("student_parents").select("student_id").eq("parent_id", claims.parent_id).eq("student_id", p.student_id).maybeSingle();
    if (!ok) throw new Error("Not your child");
    const [{ data: inv }, { data: stu }, { data: sch }] = await Promise.all([
      db.from("fee_invoices").select("title, session, term, amount_due, amount_paid").eq("id", p.invoice_id).maybeSingle(),
      db.from("students").select("first_name, last_name, admission_no, classes(name)").eq("id", p.student_id).maybeSingle(),
      db.from("schools").select("name, address, phone, logo_url, motto").eq("id", p.school_id).maybeSingle(),
    ]);
    return { payment: p, invoice: inv, student: stu, school: sch };
  });
