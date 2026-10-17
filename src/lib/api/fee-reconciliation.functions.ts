import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { invoiceOutstanding, formatNaira, resolveFeeBreakdown, sumBreakdown, type FeeBreakdownItem } from "@/lib/finance-math";
import {
  generateStudentVirtualAccount,
  isValidNubanAccountNumber,
  generateTransactionReference,
  SUPPORTED_VIRTUAL_BANKS,
  type StudentVirtualAccount,
} from "@/lib/virtual-accounts";

/**
 * Core engine to reconcile an incoming bank transfer / webhook against a student's virtual account.
 * Operates safely with either real Supabase client or fallback database.
 */
export async function processVirtualAccountPayment(
  db: any,
  params: {
    account_number: string;
    amount: number;
    transaction_reference: string;
    payer_name?: string;
    payer_bank?: string;
    payment_date?: string;
    narration?: string;
    recorded_by?: string | null;
  }
) {
  const cleanAccount = params.account_number.replace(/\D/g, "");
  if (!isValidNubanAccountNumber(cleanAccount)) {
    throw new Error(`Invalid 10-digit NUBAN virtual account number: ${params.account_number}`);
  }

  // 1. Check for existing payment with this reference to ensure idempotency
  const { data: existingPay } = await db
    .from("fee_payments")
    .select("id, receipt_no, invoice_id, amount")
    .eq("reference", params.transaction_reference)
    .maybeSingle();

  if (existingPay) {
    return {
      status: "duplicate",
      message: `Transaction reference ${params.transaction_reference} has already been reconciled.`,
      receipt_no: existingPay.receipt_no,
      amount: existingPay.amount,
      cleared: [],
    };
  }

  // 2. Fetch all students with classes and schools to match virtual account
  const { data: students, error: sErr } = await db
    .from("students")
    .select("id, school_id, first_name, last_name, middle_name, admission_no, class_id, classes(id, name), schools(id, code, name)")
    .limit(1000);

  if (sErr || !students?.length) {
    throw new Error("No student records available for virtual account reconciliation");
  }

  // Match the student whose deterministic virtual account matches the incoming account number
  let matchedStudent: any = null;
  let matchedVA: StudentVirtualAccount | null = null;

  for (const s of students) {
    const schoolCode = s.schools?.code || "SCH";
    const schoolName = s.schools?.name || "School";
    const va = generateStudentVirtualAccount({
      schoolCode,
      schoolName,
      studentId: s.id,
      admissionNo: s.admission_no,
      firstName: s.first_name,
      lastName: s.last_name,
    });

    if (va.accountNumber === cleanAccount) {
      matchedStudent = s;
      matchedVA = va;
      break;
    }
  }

  // If no exact algorithmic match, match by admission number in narration or fallback to student
  if (!matchedStudent) {
    matchedStudent = students.find((s: any) =>
      params.narration?.toUpperCase().includes(s.admission_no.toUpperCase()) ||
      params.payer_name?.toUpperCase().includes(s.admission_no.toUpperCase())
    );
    if (matchedStudent) {
      matchedVA = generateStudentVirtualAccount({
        schoolCode: matchedStudent.schools?.code || "SCH",
        schoolName: matchedStudent.schools?.name || "School",
        studentId: matchedStudent.id,
        admissionNo: matchedStudent.admission_no,
        firstName: matchedStudent.first_name,
        lastName: matchedStudent.last_name,
      });
    }
  }

  if (!matchedStudent) {
    throw new Error(`No student matched with virtual account ${cleanAccount} or narration reference`);
  }

  // 3. Find pending/unpaid invoices for this student
  const { data: invoices, error: invErr } = await db
    .from("fee_invoices")
    .select("id, school_id, student_id, title, session, term, amount_due, amount_paid, discount_amount, status, due_date")
    .eq("student_id", matchedStudent.id)
    .order("created_at", { ascending: true });

  if (invErr) {
    throw new Error(`Failed to query student invoices: ${invErr.message}`);
  }

  let remainingFunds = Math.max(Number(params.amount) || 0, 0);
  const clearedInvoices: Array<{
    invoice_id: string;
    title: string;
    amount_paid: number;
    receipt_no: string;
    is_fully_cleared: boolean;
  }> = [];

  const createdPayments: any[] = [];
  const openInvoices = (invoices || []).filter((inv: any) => invoiceOutstanding(inv) > 0);

  // If student has open invoices, waterfall clear them
  if (openInvoices.length > 0) {
    for (const inv of openInvoices) {
      if (remainingFunds <= 0) break;

      const balance = invoiceOutstanding(inv);
      if (balance <= 0) continue;

      const allocation = Math.min(remainingFunds, balance);
      remainingFunds -= allocation;

      const year = new Date().getFullYear();
      const randSuffix = Math.floor(100000 + Math.random() * 900000);
      const receiptNo = `RCP-VA-${year}-${randSuffix}`;

      // Insert payment record
      const { data: paymentRecord, error: pErr } = await db
        .from("fee_payments")
        .insert({
          school_id: inv.school_id,
          invoice_id: inv.id,
          student_id: inv.student_id,
          amount: allocation,
          method: "Virtual Account Transfer (Instant NUBAN)",
          reference: params.transaction_reference,
          receipt_no: receiptNo,
          notes: `Automated clearing via Dedicated NUBAN ${cleanAccount} (${params.payer_bank || matchedVA?.bankName || "Wema Bank"}). Payer: ${params.payer_name || "Direct Transfer"}`,
          paid_at: params.payment_date || new Date().toISOString(),
          recorded_by: params.recorded_by || null,
        } as never)
        .select()
        .single();

      if (!pErr && paymentRecord) {
        createdPayments.push(paymentRecord);
      }

      // Update invoice amount_paid and status
      const newPaid = Number(inv.amount_paid || 0) + allocation;
      const netDue = Math.max(Number(inv.amount_due) - Number(inv.discount_amount || 0), 0);
      const isCleared = newPaid >= netDue;

      await db
        .from("fee_invoices")
        .update({
          amount_paid: newPaid,
          status: isCleared ? "paid" : "partial",
        })
        .eq("id", inv.id);

      clearedInvoices.push({
        invoice_id: inv.id,
        title: inv.title,
        amount_paid: allocation,
        receipt_no: receiptNo,
        is_fully_cleared: isCleared,
      });

      // Send Parent Notification
      const { data: links } = await db
        .from("student_parents")
        .select("parent_id")
        .eq("student_id", matchedStudent.id);

      if (links?.length) {
        await db.from("parent_notifications").insert(
          links.map((l: any) => ({
            school_id: inv.school_id,
            parent_id: l.parent_id,
            student_id: matchedStudent.id,
            type: "general" as const,
            title: `Fee Payment Cleared: ${formatNaira(allocation)}`,
            body: `Your payment of ${formatNaira(allocation)} towards "${inv.title}" for ${matchedStudent.first_name} ${matchedStudent.last_name} was cleared automatically via Dedicated Virtual Account (${cleanAccount}). Receipt #${receiptNo}.`,
            meta: {
              payment_id: paymentRecord?.id,
              receipt_no: receiptNo,
              amount: allocation,
              invoice_id: inv.id,
            },
            created_by: params.recorded_by || null,
          })) as never
        );
      }
    }
  } else {
    // If student has no open invoices, record advance payment against general fees
    const year = new Date().getFullYear();
    const receiptNo = `RCP-VA-${year}-${Math.floor(100000 + Math.random() * 900000)}`;

    const { data: paymentRecord } = await db
      .from("fee_payments")
      .insert({
        school_id: matchedStudent.school_id,
        student_id: matchedStudent.id,
        amount: params.amount,
        method: "Virtual Account Transfer (Instant NUBAN)",
        reference: params.transaction_reference,
        receipt_no: receiptNo,
        notes: `Advance fee credit via Dedicated NUBAN ${cleanAccount} (${params.payer_bank || "Bank Transfer"}). Payer: ${params.payer_name || "Direct Transfer"}`,
        paid_at: params.payment_date || new Date().toISOString(),
        recorded_by: params.recorded_by || null,
      } as never)
      .select()
      .single();

    if (paymentRecord) {
      createdPayments.push(paymentRecord);
    }
  }

  return {
    status: "success",
    student: {
      id: matchedStudent.id,
      name: `${matchedStudent.first_name} ${matchedStudent.last_name}`,
      admission_no: matchedStudent.admission_no,
      class_name: matchedStudent.classes?.name ?? "—",
      virtual_account: matchedVA?.accountNumber ?? cleanAccount,
      bank_name: matchedVA?.bankName ?? "Wema Bank / ALAT",
    },
    total_received: params.amount,
    allocated_to_invoices: params.amount - remainingFunds,
    excess_credit: remainingFunds,
    cleared_invoices: clearedInvoices,
    payments: createdPayments,
    reference: params.transaction_reference,
  };
}

/**
 * Server function to simulate or record a bank transfer to a student's virtual account (for testing or manual bursary reconciliation).
 */
export const simulateVirtualAccountPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      student_id: z.string().uuid(),
      amount: z.number().positive(),
      payer_name: z.string().min(1).max(100).optional(),
      payer_bank: z.string().min(1).max(60).optional(),
      notes: z.string().max(250).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Fetch student info
    const { data: student, error: sErr } = await supabase
      .from("students")
      .select("id, school_id, first_name, last_name, admission_no, schools(code, name)")
      .eq("id", data.student_id)
      .maybeSingle();

    if (sErr || !student) throw new Error("Student not found");

    const schoolCode = (student as any).schools?.code || "SCH";
    const schoolName = (student as any).schools?.name || "School";
    const va = generateStudentVirtualAccount({
      schoolCode,
      schoolName,
      studentId: student.id,
      admissionNo: student.admission_no,
      firstName: student.first_name,
      lastName: student.last_name,
    });

    const txRef = generateTransactionReference("SIM-NUBAN");

    const result = await processVirtualAccountPayment(supabase, {
      account_number: va.accountNumber,
      amount: data.amount,
      transaction_reference: txRef,
      payer_name: data.payer_name || `Parent of ${student.first_name} ${student.last_name}`,
      payer_bank: data.payer_bank || va.bankName,
      narration: `Simulated NIP transfer to ${va.accountNumber} - ${data.notes || "Fees"}`,
      recorded_by: userId,
    });

    return result;
  });

/**
 * Server function to get all student dedicated virtual accounts for a school.
 */
export const getSchoolVirtualAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ school_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [{ data: school }, { data: students }, { data: invoices }] = await Promise.all([
      supabase.from("schools").select("id, code, name").eq("id", data.school_id).maybeSingle(),
      supabase
        .from("students")
        .select("id, school_id, first_name, last_name, middle_name, admission_no, class_id, classes(id, name)")
        .eq("school_id", data.school_id)
        .order("last_name"),
      supabase
        .from("fee_invoices")
        .select("id, student_id, amount_due, amount_paid, discount_amount, status")
        .eq("school_id", data.school_id),
    ]);

    const schoolCode = school?.code || "SCH";
    const schoolName = school?.name || "School";
    const invoiceList = invoices || [];

    const accounts = (students || []).map((s: any, idx: number) => {
      const va = generateStudentVirtualAccount({
        schoolCode,
        schoolName,
        studentId: s.id,
        admissionNo: s.admission_no,
        firstName: s.first_name,
        lastName: s.last_name,
        bankIndex: idx % SUPPORTED_VIRTUAL_BANKS.length,
      });

      const studentInvs = invoiceList.filter((inv: any) => inv.student_id === s.id);
      let totalBilled = 0;
      let totalPaid = 0;
      let totalOutstanding = 0;

      for (const inv of studentInvs) {
        const bal = invoiceOutstanding(inv);
        totalBilled += Number(inv.amount_due) || 0;
        totalPaid += Number(inv.amount_paid) || 0;
        if (bal > 0) totalOutstanding += bal;
      }

      return {
        ...va,
        studentName: [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" "),
        className: s.classes?.name ?? "Unassigned",
        totalBilled,
        totalPaid,
        totalOutstanding,
      };
    });

    return { ok: true, accounts };
  });

/**
 * Server function to create a fee schedule with explicit Nigerian breakdown items
 * (Tuition, PTA, Uniforms, Books, Boarding) and generate invoices for a class.
 */
export const createFeeScheduleWithBreakdown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      class_id: z.string().uuid(),
      session: z.string().min(4).max(20),
      term: z.enum(["first", "second", "third"]),
      due_date: z.string().optional(),
      breakdown: z.array(
        z.object({
          category: z.enum(["tuition", "pta", "uniforms", "books", "boarding", "development", "ict", "exam"]),
          name: z.string().min(1),
          amount: z.number().nonnegative(),
        })
      ),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: cls, error: cErr } = await supabase
      .from("classes")
      .select("id, school_id, name")
      .eq("id", data.class_id)
      .maybeSingle();

    if (cErr || !cls) throw new Error("Class not found");

    const totalAmount = data.breakdown.reduce((sum, item) => sum + item.amount, 0);
    if (totalAmount <= 0) throw new Error("Total fee schedule amount must be greater than zero");

    // Title reflects Nigerian term standard
    const termLabel = data.term.charAt(0).toUpperCase() + data.term.slice(1);
    const scheduleName = `${termLabel} Term Comprehensive School Fees (${cls.name})`;

    // Insert fee item
    const { data: feeItem, error: fErr } = await supabase
      .from("fee_items")
      .insert({
        school_id: cls.school_id,
        class_id: cls.id,
        name: scheduleName,
        session: data.session,
        term: data.term,
        amount: totalAmount,
        active: true,
      } as never)
      .select()
      .single();

    if (fErr || !feeItem) throw new Error(fErr?.message || "Failed to create fee schedule item");

    // Fetch all students in class
    const { data: students } = await supabase
      .from("students")
      .select("id, school_id")
      .eq("class_id", data.class_id);

    if (!students?.length) {
      return { ok: true, fee_item: feeItem, invoices_created: 0, message: "Fee item created, but no students found in class" };
    }

    const rows = students.map((s: any) => ({
      school_id: s.school_id,
      student_id: s.id,
      fee_item_id: (feeItem as any).id,
      title: scheduleName,
      session: data.session,
      term: data.term,
      amount_due: totalAmount,
      due_date: data.due_date || null,
    }));

    const { error: invErr } = await supabase.from("fee_invoices").insert(rows as never);
    if (invErr) throw new Error(invErr.message);

    return {
      ok: true,
      fee_item: feeItem,
      invoices_created: rows.length,
      total_amount: totalAmount,
      breakdown: data.breakdown,
    };
  });
