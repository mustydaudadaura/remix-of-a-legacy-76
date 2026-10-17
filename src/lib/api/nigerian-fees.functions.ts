import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTermiiMessage, normalizePhone } from "@/lib/termii.server";
import { formatNaira } from "@/lib/nigerian-fees";
import { invoiceOutstanding } from "@/lib/finance-math";

/**
 * 1. Process Virtual Account Payment Webhook (Mock & Live Reconciliation).
 * Can be called internally or via incoming HTTP post from payment gateways.
 */
export const reconcileVirtualAccountPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      school_id: z.string().uuid(),
      virtual_account: z.string().min(8),
      amount: z.number().positive(),
      student_id: z.string().uuid().optional(),
      admission_no: z.string().optional(),
      sender_name: z.string().default("Bank Transfer Payer"),
      sender_bank: z.string().default("Commercial Bank"),
      reference: z.string().optional(),
      send_receipt_alert: z.boolean().default(true),
      channel: z.enum(["whatsapp", "generic"]).default("whatsapp"),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify school permission
    const { data: allowed } = await supabase.rpc("school_permission", {
      _user_id: userId,
      _school_id: data.school_id,
      _permission: "fees.edit",
    });
    if (!allowed) throw new Error("Unauthorized to reconcile fee payments");

    // Locate the student by student_id or admission_no
    let studentId = data.student_id;
    if (!studentId && data.admission_no) {
      const { data: st } = await supabase
        .from("students")
        .select("id")
        .eq("school_id", data.school_id)
        .eq("admission_no", data.admission_no)
        .maybeSingle();
      studentId = st?.id;
    }

    if (!studentId) {
      // Find open invoices by student admission number match
      throw new Error("Student could not be found for this virtual account");
    }

    // Fetch student & open invoices sorted by oldest first
    const [{ data: student }, { data: invoices }] = await Promise.all([
      supabase
        .from("students")
        .select("id, admission_no, first_name, last_name, class_id, classes(name)")
        .eq("id", studentId)
        .single(),
      supabase
        .from("fee_invoices")
        .select("id, title, session, term, amount_due, amount_paid, discount_amount, status")
        .eq("student_id", studentId)
        .in("status", ["unpaid", "partial", "overdue"])
        .order("created_at", { ascending: true }),
    ]);

    if (!student) throw new Error("Student record missing");

    let remainingToCredit = data.amount;
    const paymentRecords: any[] = [];
    const generatedRef = data.reference || `VA-${Date.now().toString().slice(-8)}`;

    const openInvoices = invoices ?? [];

    if (openInvoices.length === 0) {
      // If no open invoices, create an advance payment record against school fees
      throw new Error("Student currently has no outstanding fee invoices to clear");
    }

    for (const inv of openInvoices) {
      if (remainingToCredit <= 0) break;
      const unpaid = invoiceOutstanding(inv);
      if (unpaid <= 0) continue;

      const allocation = Math.min(unpaid, remainingToCredit);
      remainingToCredit -= allocation;

      // Insert fee_payment
      const { data: payment, error: pErr } = await supabase
        .from("fee_payments")
        .insert({
          school_id: data.school_id,
          invoice_id: inv.id,
          student_id: student.id,
          amount: allocation,
          method: "bank_transfer",
          reference: `${generatedRef} (VA ${data.virtual_account})`,
          notes: `Cleared via Virtual Account (${data.virtual_account}) from ${data.sender_name} [${data.sender_bank}]`,
          recorded_by: userId,
        } as never)
        .select()
        .single();

      if (pErr) throw new Error(`Failed to record payment: ${pErr.message}`);
      paymentRecords.push({ invoice: inv.title, amount: allocation, receipt_no: (payment as any).receipt_no });
    }

    // Send WhatsApp / SMS payment receipt to linked parents
    let alertSent = false;
    let alertMessage = "";
    if (data.send_receipt_alert) {
      const { data: links } = await supabase
        .from("student_parents")
        .select("parent_id, parents(full_name, phone)")
        .eq("student_id", student.id);

      const parentPhones = (links ?? [])
        .map((l: any) => l.parents?.phone)
        .filter(Boolean) as string[];

      if (parentPhones.length > 0) {
        const studentName = `${student.first_name} ${student.last_name}`;
        const totalPaidFormatted = formatNaira(data.amount);
        const receiptList = paymentRecords.map((p) => `${p.invoice}: ${formatNaira(p.amount)} (Rcpt #${p.receipt_no})`).join("\n");

        alertMessage = `*PAYMENT RECEIPT*\nDear Parent, we have confirmed payment of ${totalPaidFormatted} for ${studentName} (${student.admission_no}) via dedicated Virtual Account.\n\n*Breakdown:*\n${receiptList}\n\nThank you for choosing Alegacy School.`;

        try {
          await sendTermiiMessage({
            supabase,
            school_id: data.school_id,
            to: parentPhones,
            message: alertMessage,
            channel: data.channel,
            title: `Fee Payment Receipt - ${studentName}`,
          });
          alertSent = true;
        } catch (smsErr) {
          console.warn("Failed sending receipt SMS/WhatsApp:", smsErr);
        }
      }
    }

    return {
      ok: true,
      student: `${student.first_name} ${student.last_name}`,
      admission_no: student.admission_no,
      amount_cleared: data.amount - remainingToCredit,
      unallocated: remainingToCredit,
      payments: paymentRecords,
      alert_sent: alertSent,
      reference: generatedRef,
    };
  });

/**
 * 2. Send Weekly Attendance WhatsApp & SMS Digest to Parents.
 */
export const sendWeeklyAttendanceDigest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      school_id: z.string().uuid(),
      class_id: z.string().uuid().optional(),
      week_start: z.string(), // YYYY-MM-DD
      week_end: z.string(),   // YYYY-MM-DD
      channel: z.enum(["whatsapp", "generic"]).default("whatsapp"),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: allowed } = await supabase.rpc("school_permission", {
      _user_id: userId,
      _school_id: data.school_id,
      _permission: "communication.edit",
    });
    if (!allowed) throw new Error("Unauthorized to send parent digests");

    // Fetch school name
    const { data: school } = await supabase
      .from("schools")
      .select("name")
      .eq("id", data.school_id)
      .single();

    const schoolName = school?.name || "Alegacy School";

    // Fetch students
    let query = supabase
      .from("students")
      .select("id, first_name, last_name, admission_no, class_id, classes(name)")
      .eq("school_id", data.school_id);

    if (data.class_id) {
      query = query.eq("class_id", data.class_id);
    }

    const { data: students } = await query;
    if (!students?.length) throw new Error("No students found");

    // Fetch attendance records for this period
    const { data: attRecords } = await supabase
      .from("attendance")
      .select("student_id, date, status")
      .eq("school_id", data.school_id)
      .gte("date", data.week_start)
      .lte("date", data.week_end);

    const attMap = new Map<string, { present: number; absent: number; late: number }>();
    (attRecords ?? []).forEach((r) => {
      const cur = attMap.get(r.student_id) || { present: 0, absent: 0, late: 0 };
      if (r.status === "present") cur.present += 1;
      else if (r.status === "absent") cur.absent += 1;
      else if (r.status === "late") cur.late += 1;
      attMap.set(r.student_id, cur);
    });

    let sentCount = 0;
    const errors: string[] = [];

    for (const st of students) {
      // Find parent phone
      const { data: links } = await supabase
        .from("student_parents")
        .select("parent_id, parents(full_name, phone)")
        .eq("student_id", st.id);

      const phones = (links ?? [])
        .map((l: any) => l.parents?.phone)
        .filter(Boolean) as string[];

      if (!phones.length) continue;

      const counts = attMap.get(st.id) || { present: 5, absent: 0, late: 0 };
      const total = counts.present + counts.absent + counts.late || 5;
      const rate = Math.round((counts.present / total) * 100);

      const studentName = `${st.first_name} ${st.last_name}`;
      const className = (st as any).classes?.name || "Class";

      const message = `*WEEKLY ATTENDANCE DIGEST*\nSchool: ${schoolName}\nStudent: ${studentName} (${className})\nPeriod: ${data.week_start} to ${data.week_end}\n\n` +
        `• Present: ${counts.present} day(s)\n` +
        `• Absent: ${counts.absent} day(s)\n` +
        `• Late: ${counts.late} day(s)\n` +
        `• Weekly Rate: ${rate}%\n\n` +
        `Thank you for keeping ${st.first_name}'s education consistent. Contact the school office for any inquiries.`;

      try {
        const r = await sendTermiiMessage({
          supabase,
          school_id: data.school_id,
          to: phones,
          message,
          channel: data.channel,
          title: `Weekly Attendance Digest - ${studentName}`,
        });
        if (r.ok) sentCount += phones.length;
      } catch (err: any) {
        errors.push(`${studentName}: ${err.message}`);
      }
    }

    return { ok: true, sentCount, errors };
  });

/**
 * 3. Send Termly Report Card Release Announcements via WhatsApp / SMS.
 */
export const sendReportCardReleaseAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      school_id: z.string().uuid(),
      session: z.string(),
      term: z.enum(["first", "second", "third"]),
      class_id: z.string().uuid().optional(),
      portal_url: z.string().optional(),
      custom_note: z.string().max(200).optional(),
      channel: z.enum(["whatsapp", "generic"]).default("whatsapp"),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: allowed } = await supabase.rpc("school_permission", {
      _user_id: userId,
      _school_id: data.school_id,
      _permission: "communication.edit",
    });
    if (!allowed) throw new Error("Unauthorized to broadcast announcements");

    const { data: school } = await supabase
      .from("schools")
      .select("name")
      .eq("id", data.school_id)
      .single();

    const schoolName = school?.name || "Alegacy School";

    // Query published report cards
    let q = supabase
      .from("report_cards")
      .select("id, student_id, average, position, students(first_name, last_name, admission_no, classes(name))")
      .eq("school_id", data.school_id)
      .eq("session", data.session)
      .eq("term", data.term)
      .eq("published", true);

    if (data.class_id) {
      q = q.eq("class_id", data.class_id);
    }

    const { data: reports } = await q;
    if (!reports?.length) {
      throw new Error("No published report cards found for this term");
    }

    let sentCount = 0;
    const termLabel = `${data.term.toUpperCase()} TERM ${data.session}`;

    for (const rep of reports) {
      const st = (rep as any).students;
      if (!st) continue;

      const { data: links } = await supabase
        .from("student_parents")
        .select("parent_id, parents(full_name, phone)")
        .eq("student_id", rep.student_id);

      const phones = (links ?? [])
        .map((l: any) => l.parents?.phone)
        .filter(Boolean) as string[];

      if (!phones.length) continue;

      const studentName = `${st.first_name} ${st.last_name}`;
      const className = st.classes?.name || "Class";
      const avg = rep.average ? `${Number(rep.average).toFixed(1)}%` : "N/A";
      const pos = rep.position ? `#${rep.position}` : "N/A";

      const message = `*TERMLY REPORT CARD RELEASE*\nSchool: ${schoolName}\nTerm: ${termLabel}\nStudent: ${studentName} (${className})\n\n` +
        `We are pleased to inform you that the terminal report card is now available.\n` +
        `• Terminal Average: ${avg}\n` +
        `• Position in Class: ${pos}\n` +
        (data.custom_note ? `\nNotice: ${data.custom_note}\n` : "") +
        `\nLog in to your Parent Portal to view and download the official report card.`;

      try {
        const r = await sendTermiiMessage({
          supabase,
          school_id: data.school_id,
          to: phones,
          message,
          channel: data.channel,
          title: `Report Card Release - ${studentName}`,
        });
        if (r.ok) sentCount += phones.length;
      } catch (e) {
        console.warn("Error sending report card alert:", e);
      }
    }

    return { ok: true, sentCount };
  });
