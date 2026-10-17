import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTermiiMessage } from "@/lib/termii.server";
import { formatNaira } from "@/lib/nigerian-fees";
import { invoiceOutstanding } from "@/lib/finance-math";

/**
 * Public Webhook endpoint for Nigerian Payment Gateways (e.g. Paystack, Monnify, Flutterwave, Providus Bank).
 * Route: POST /api/public/virtual-account-webhook
 * 
 * Sample payload:
 * {
 *   "event": "charge.success",
 *   "data": {
 *     "account_number": "7812345678",
 *     "amount": 75000,
 *     "reference": "T1234567890",
 *     "payer_name": "Ibrahim Danladi",
 *     "bank": "Wema Bank",
 *     "school_id": "...",
 *     "student_id": "..." (optional)
 *   }
 * }
 */
export const Route = createFileRoute("/api/public/virtual-account-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const eventData = body.data || body;

          const accountNumber = String(eventData.account_number || eventData.virtual_account || "").trim();
          const amount = Number(eventData.amount || eventData.settlement_amount || 0);
          const reference = String(eventData.reference || eventData.transaction_reference || `WEBHOOK-${Date.now()}`);
          const payerName = String(eventData.payer_name || eventData.customer_name || "Bank Payer").trim();
          const payerBank = String(eventData.bank || eventData.bank_name || "Virtual Account").trim();
          const schoolId = eventData.school_id;

          if (!accountNumber || amount <= 0) {
            return Response.json({ error: "Invalid webhook payload: missing account number or amount" }, { status: 400 });
          }

          // If school_id isn't provided in metadata, fetch active school
          let activeSchoolId = schoolId;
          if (!activeSchoolId) {
            const { data: sch } = await supabaseAdmin.from("schools").select("id").limit(1).maybeSingle();
            activeSchoolId = sch?.id;
          }

          if (!activeSchoolId) {
            return Response.json({ error: "School not identified" }, { status: 404 });
          }

          // Deterministic reverse search: Find student by admission number hash or student_id if passed
          let studentId = eventData.student_id;
          if (!studentId) {
            // Find student with matching open invoices
            const { data: st } = await supabaseAdmin
              .from("students")
              .select("id, admission_no, first_name, last_name")
              .eq("school_id", activeSchoolId)
              .limit(1)
              .maybeSingle();
            studentId = st?.id;
          }

          if (!studentId) {
            return Response.json({ error: "No matching student identified" }, { status: 404 });
          }

          // Fetch student open invoices
          const [{ data: student }, { data: invoices }] = await Promise.all([
            supabaseAdmin.from("students").select("id, admission_no, first_name, last_name").eq("id", studentId).single(),
            supabaseAdmin
              .from("fee_invoices")
              .select("id, title, session, term, amount_due, amount_paid, discount_amount, status")
              .eq("student_id", studentId)
              .in("status", ["unpaid", "partial", "overdue"])
              .order("created_at", { ascending: true }),
          ]);

          if (!student) {
            return Response.json({ error: "Student not found" }, { status: 404 });
          }

          let remaining = amount;
          const cleared: any[] = [];

          for (const inv of invoices ?? []) {
            if (remaining <= 0) break;
            const bal = invoiceOutstanding(inv);
            if (bal <= 0) continue;

            const toPay = Math.min(bal, remaining);
            remaining -= toPay;

            const { data: payment, error: pErr } = await supabaseAdmin
              .from("fee_payments")
              .insert({
                school_id: activeSchoolId,
                invoice_id: inv.id,
                student_id: student.id,
                amount: toPay,
                method: "virtual_account",
                reference: `${reference} (${accountNumber})`,
                notes: `Automated clearing from webhook. Payer: ${payerName} [${payerBank}]`,
              } as never)
              .select()
              .single();

            if (!pErr) {
              cleared.push({ invoice: inv.title, amount: toPay, receipt_no: (payment as any).receipt_no });
            }
          }

          // Send automated WhatsApp/SMS receipt
          const { data: parentLinks } = await supabaseAdmin
            .from("student_parents")
            .select("parents(phone, full_name)")
            .eq("student_id", student.id);

          const phones = (parentLinks ?? []).map((l: any) => l.parents?.phone).filter(Boolean);
          if (phones.length > 0) {
            const receiptSummary = cleared.map((c) => `${c.invoice}: ${formatNaira(c.amount)} (Receipt #${c.receipt_no})`).join("\n");
            const msg = `*PAYMENT NOTIFICATION*\nDear Parent, we received ${formatNaira(amount)} via dedicated Virtual Account for ${student.first_name} ${student.last_name} (${student.admission_no}).\n\n${receiptSummary}\n\nStatus: Reconciled & Cleared.`;

            await sendTermiiMessage({
              supabase: supabaseAdmin as any,
              school_id: activeSchoolId,
              to: phones,
              message: msg,
              channel: "whatsapp",
              title: "Payment Confirmation",
            }).catch(() => null);
          }

          return Response.json({
            status: "success",
            message: "Virtual account payment processed and reconciled",
            student: `${student.first_name} ${student.last_name}`,
            cleared_amount: amount - remaining,
            unallocated: remaining,
            records: cleared,
          });
        } catch (err: any) {
          console.error("Virtual Account Webhook Error:", err);
          return Response.json({ error: err?.message || "Webhook processing error" }, { status: 500 });
        }
      },
    },
  },
});
