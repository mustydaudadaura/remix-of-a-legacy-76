import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { invoiceOutstanding } from "@/lib/finance-math";

export { invoiceOutstanding };


async function schoolCode(supabase: any, schoolId: string): Promise<string> {
  const { data, error } = await supabase.from("schools").select("code").eq("id", schoolId).maybeSingle();
  if (error || !data?.code) throw new Error("School not found for this account");
  return data.code as string;
}

function serial(prefix: string, code: string, stamp: string) {
  return `${prefix}/${code}/${stamp}/${Date.now().toString().slice(-6)}`;
}

/** Approve a discount or waiver on one invoice. */
export const setInvoiceDiscount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    invoice_id: z.string().uuid(),
    discount_amount: z.number().min(0),
    discount_kind: z.string().max(30).optional(),
    discount_reason: z.string().max(200).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: inv, error: fetchErr } = await supabase
      .from("fee_invoices")
      .select("id, amount_due, amount_paid, discount_amount")
      .eq("id", data.invoice_id)
      .maybeSingle();
    if (fetchErr || !inv) throw new Error("Invoice not found");
    const unpaid = Number(inv.amount_due) - Number(inv.amount_paid);
    if (data.discount_amount > unpaid) {
      throw new Error(`The discount cannot be more than the unpaid balance of ₦${unpaid.toLocaleString()}`);
    }
    if (data.discount_amount > 0 && !data.discount_reason?.trim()) {
      throw new Error("Give a reason for the discount");
    }
    const { data: saved, error } = await supabase.from("fee_invoices")
      .update({
        discount_amount: data.discount_amount,
        discount_kind: data.discount_kind || null,
        discount_reason: data.discount_amount > 0 ? data.discount_reason!.trim() : null,
      } as never)
      .eq("id", data.invoice_id)
      .select("id, discount_amount, discount_kind, discount_reason")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, invoice: saved };
  });

/** Record a school expense (income is never recorded here — only what the school spent). */
export const addExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    school_id: z.string().uuid(),
    title: z.string().min(2).max(120),
    category: z.string().max(40).default("other"),
    amount: z.number().positive(),
    spent_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    paid_to: z.string().max(80).optional(),
    method: z.string().max(30).default("cash"),
    reference: z.string().max(60).optional(),
    notes: z.string().max(300).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const code = await schoolCode(supabase, data.school_id);
    const expense_no = serial("EXP", code, data.spent_on.slice(0, 4));
    const { data: saved, error } = await supabase.from("school_expenses").insert({
      school_id: data.school_id,
      expense_no,
      title: data.title,
      category: data.category,
      amount: data.amount,
      spent_on: data.spent_on,
      paid_to: data.paid_to || null,
      method: data.method,
      reference: data.reference || null,
      notes: data.notes || null,
      recorded_by: userId,
    } as never).select("id, expense_no, title, amount").single();
    if (error) throw new Error(error.message);
    return { ok: true, expense: saved };
  });

/** Standing discount for a student; optionally applied to invoices already raised. */
export const saveScholarship = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    school_id: z.string().uuid(),
    student_id: z.string().uuid(),
    label: z.string().min(2).max(80),
    discount_type: z.enum(["percent", "flat"]),
    discount_value: z.number().positive(),
    session: z.string().min(3).max(20),
    term: z.enum(["first", "second", "third"]).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: saved, error } = await supabase.from("student_scholarships").insert({
      school_id: data.school_id,
      student_id: data.student_id,
      label: data.label,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      session: data.session,
      term: data.term ?? null,
      approved_by: userId,
    } as never).select("id").single();
    if (error) throw new Error(error.message);
    const applied = await applyDiscountsFor(supabase, data.school_id, data.session, data.term ?? null);
    return { ok: true, scholarship: saved, applied };
  });

/** Match active scholarships to invoices that carry no discount yet. */
async function applyDiscountsFor(supabase: any, schoolId: string, session: string, term: string | null) {
  const { data: awards, error: awardsErr } = await supabase.from("student_scholarships")
    .select("student_id, label, discount_type, discount_value, term")
    .eq("school_id", schoolId)
    .eq("session", session)
    .eq("status", "active");
  if (awardsErr) throw new Error(awardsErr.message);
  if (!awards?.length) return { applied: 0, total: 0 };

  const byStudent = new Map<string, any>();
  for (const a of awards) {
    if (a.term && a.term !== term) continue;
    byStudent.set(a.student_id, a);
  }
  if (!byStudent.size) return { applied: 0, total: 0 };

  const invoiceFilter = supabase.from("fee_invoices")
    .select("id, student_id, amount_due, amount_paid, discount_amount")
    .eq("school_id", schoolId)
    .eq("session", session)
    .eq("discount_amount", 0)
    .in("student_id", [...byStudent.keys()]);
  const { data: invoices, error: invErr } = await (term ? invoiceFilter.eq("term", term) : invoiceFilter);
  if (invErr) throw new Error(invErr.message);

  let applied = 0;
  let total = 0;
  for (const inv of invoices ?? []) {
    const award = byStudent.get(inv.student_id);
    if (!award) continue;
    const unpaid = Number(inv.amount_due) - Number(inv.amount_paid);
    const raw = award.discount_type === "percent"
      ? Number(inv.amount_due) * Number(award.discount_value) / 100
      : Number(award.discount_value);
    const discount = Math.min(Math.round(raw), Math.max(unpaid, 0));
    if (discount <= 0) continue;
    const { error } = await supabase.from("fee_invoices")
      .update({ discount_amount: discount, discount_kind: "scholarship", discount_reason: award.label } as never)
      .eq("id", inv.id);
    if (!error) { applied += 1; total += discount; }
  }
  return { applied, total };
}

export const applyScholarships = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    school_id: z.string().uuid(),
    session: z.string().min(3).max(20),
    term: z.enum(["first", "second", "third"]).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    return { ok: true, ...(await applyDiscountsFor(supabase, data.school_id, data.session, data.term ?? null)) };
  });

/** Fix a staff member's monthly pay so payroll can be run in one click. */
export const saveStaffSalary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    school_id: z.string().uuid(),
    user_id: z.string().uuid(),
    basic: z.number().min(0),
    allowances: z.number().min(0),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: saved, error } = await supabase.from("staff_salary_settings")
      .upsert({
        school_id: data.school_id,
        user_id: data.user_id,
        basic: data.basic,
        allowances: data.allowances,
        updated_at: new Date().toISOString(),
      } as never, { onConflict: "school_id,user_id" })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, setting: saved };
  });

/** Create this month's salary records for every staff member with a salary on file. */
export const runPayroll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    school_id: z.string().uuid(),
    month: z.string().regex(/^\d{4}-\d{2}$/),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const code = await schoolCode(supabase, data.school_id);
    const month = `${data.month}-01`;
    const { data: settings, error: sErr } = await supabase.from("staff_salary_settings")
      .select("user_id, basic, allowances").eq("school_id", data.school_id);
    if (sErr) throw new Error(sErr.message);
    if (!settings?.length) throw new Error("No staff salaries on file yet. Set a salary for each staff member first.");
    const { data: existing, error: eErr } = await supabase.from("staff_salaries")
      .select("user_id").eq("school_id", data.school_id).eq("month", month);
    if (eErr) throw new Error(eErr.message);
    const done = new Set((existing ?? []).map((r: any) => r.user_id));
    const rows = settings
      .filter((s: any) => !done.has(s.user_id))
      .map((s: any) => ({
        school_id: data.school_id,
        user_id: s.user_id,
        month,
        payslip_no: serial("PSL", code, data.month.replace("-", "")),
        basic: s.basic,
        allowances: s.allowances,
        deductions: 0,
        recorded_by: userId,
      }));
    if (!rows.length) return { ok: true, created: 0 };
    const { error } = await supabase.from("staff_salaries").insert(rows as never);
    if (error) throw new Error(error.message);
    return { ok: true, created: rows.length };
  });

/** Release one salary. */
export const markSalaryPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    salary_id: z.string().uuid(),
    method: z.string().max(30).default("bank_transfer"),
    reference: z.string().max(60).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("staff_salaries")
      .update({
        status: "paid",
        method: data.method,
        reference: data.reference || null,
        paid_by: userId,
        paid_at: new Date().toISOString(),
      } as never)
      .eq("id", data.salary_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Adjust one salary record before it is released (e.g. a deduction). */
export const setSalaryDeduction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    salary_id: z.string().uuid(),
    deductions: z.number().min(0),
    notes: z.string().max(200).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("staff_salaries")
      .update({ deductions: data.deductions, notes: data.notes || null } as never)
      .eq("id", data.salary_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type FinanceSummary = {
  billed: number; discounted: number; collected: number; outstanding: number;
  invoices: number; defaulters: number;
  expenseTotal: number; expenseByCategory: { category: string; total: number }[];
  payrollTotal: number; payrollPending: number; payrollPaid: number;
};

/** Termly money picture: what was billed, collected, owed, spent and paid as salaries. */
export const financeSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    school_id: z.string().uuid(),
    session: z.string().min(3).max(20),
    term: z.enum(["first", "second", "third"]),
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  }).parse(d))
  .handler(async ({ data, context }): Promise<FinanceSummary> => {
    const { supabase } = context;
    const [{ data: invoices, error: invErr }, { data: expenses, error: expErr }] = await Promise.all([
      supabase.from("fee_invoices")
        .select("amount_due, discount_amount, amount_paid, status")
        .eq("school_id", data.school_id).eq("session", data.session).eq("term", data.term),
      supabase.from("school_expenses")
        .select("category, amount").eq("school_id", data.school_id),
    ]);
    if (invErr) throw new Error(invErr.message);
    if (expErr) throw new Error(expErr.message);

    let billed = 0, discounted = 0, collected = 0, outstanding = 0, defaulters = 0;
    for (const i of invoices ?? []) {
      billed += Number(i.amount_due);
      discounted += Number(i.discount_amount ?? 0);
      collected += Number(i.amount_paid);
      const due = invoiceOutstanding(i);
      if (due > 0) { outstanding += due; defaulters += 1; }
    }
    const byCategory = new Map<string, number>();
    let expenseTotal = 0;
    for (const e of expenses ?? []) {
      const amt = Number(e.amount);
      expenseTotal += amt;
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + amt);
    }

    let payrollTotal = 0, payrollPending = 0, payrollPaid = 0;
    if (data.month) {
      const { data: salaries } = await supabase.from("staff_salaries")
        .select("net, status").eq("school_id", data.school_id).eq("month", `${data.month}-01`);
      for (const s of salaries ?? []) {
        payrollTotal += Number(s.net);
        if (s.status === "paid") payrollPaid += Number(s.net); else payrollPending += Number(s.net);
      }
    }

    return {
      billed, discounted, collected, outstanding,
      invoices: invoices?.length ?? 0, defaulters,
      expenseTotal,
      expenseByCategory: [...byCategory.entries()]
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total),
      payrollTotal, payrollPending, payrollPaid,
    };
  });
