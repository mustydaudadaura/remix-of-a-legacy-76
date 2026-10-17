import { createFileRoute } from "@tanstack/react-router";
import { processVirtualAccountPayment } from "@/lib/api/fee-reconciliation.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/webhooks/payments")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();

          // Support Monnify, Paystack, or generic NUBAN transfer webhooks
          const accountNumber =
            body.account_number ||
            body.accountNumber ||
            body.destinationAccountNumber ||
            body.data?.customer?.account_number ||
            body.eventData?.destinationAccountNumber;

          const amount =
            Number(body.amount || body.amountPaid || body.data?.amount || body.eventData?.amountPaid) || 0;

          const transactionReference =
            body.transaction_reference ||
            body.transactionReference ||
            body.reference ||
            body.data?.reference ||
            body.eventData?.transactionReference ||
            `TX-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

          const payerName =
            body.payer_name ||
            body.payerName ||
            body.data?.customer?.name ||
            body.eventData?.payerName ||
            "Bank Transfer Payer";

          const payerBank =
            body.payer_bank ||
            body.payerBank ||
            body.data?.authorization?.bank ||
            body.eventData?.originBankName ||
            "NIP Bank Transfer";

          const narration =
            body.narration ||
            body.paymentDescription ||
            body.data?.metadata?.narration ||
            body.eventData?.narration ||
            "School Fees NUBAN Transfer";

          if (!accountNumber) {
            return Response.json(
              { error: "Missing required 'account_number' in webhook payload" },
              { status: 400 }
            );
          }

          if (amount <= 0) {
            return Response.json(
              { error: "Payment amount must be greater than zero" },
              { status: 400 }
            );
          }

          // Execute automated fee clearing and reconciliation
          const result = await processVirtualAccountPayment(supabaseAdmin, {
            account_number: String(accountNumber),
            amount,
            transaction_reference: String(transactionReference),
            payer_name: String(payerName),
            payer_bank: String(payerBank),
            narration: String(narration),
          });

          return Response.json(
            {
              status: "success",
              message: "Payment processed and fee invoices reconciled successfully",
              data: result,
            },
            { status: 200 }
          );
        } catch (err: any) {
          console.error("Payment webhook reconciliation error:", err);
          return Response.json(
            {
              status: "error",
              error: err?.message || "Webhook processing failed",
            },
            { status: 500 }
          );
        }
      },

      GET: async () => {
        return Response.json({
          status: "active",
          service: "Nigerian Dedicated Virtual Account Payment Webhook & Reconciliation Engine",
          version: "2026.1",
          accepted_providers: ["Monnify", "Paystack Dedicated Accounts", "Flutterwave", "NIP Transfer Simulation"],
          endpoint: "/api/webhooks/payments",
        });
      },
    },
  },
});
