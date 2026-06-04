import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useParentAuth } from "@/hooks/useParentAuth";
import { getReceipt } from "@/lib/api/portal.functions";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/_portal/receipt/$id")({
  component: Page,
});

function Page() {
  const { id } = useParams({ from: "/_portal/receipt/$id" });
  const { token } = useParentAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["receipt", token, id],
    queryFn: () => getReceipt({ data: { token: token!, payment_id: id } }),
    enabled: !!token,
  });

  if (isLoading) return <p className="p-6 text-center text-sm text-muted-foreground">Loading receipt…</p>;
  if (!data) return <p className="p-6 text-center text-sm text-muted-foreground">Receipt not available.</p>;
  const { payment, invoice, student, school } = data as any;

  return (
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <Button size="sm" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print / Save PDF</Button>
      </div>
      <div className="rounded-lg border bg-white p-6 text-sm text-black shadow-sm print:border-0 print:shadow-none">
        <div className="mb-4 flex items-start justify-between">
          <div>
            {school?.logo_url && <img src={school.logo_url} alt="" className="mb-2 h-12" />}
            <div className="text-lg font-bold">{school?.name}</div>
            <div className="text-xs">{school?.address}</div>
            <div className="text-xs">{school?.phone}</div>
            {school?.motto && <div className="mt-1 text-xs italic">"{school.motto}"</div>}
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Receipt</div>
            <div className="font-mono text-lg font-bold">{payment.receipt_no}</div>
            <div className="text-xs">{new Date(payment.paid_at).toLocaleString()}</div>
          </div>
        </div>
        <hr className="my-4" />
        <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
          <div><span className="text-muted-foreground">Student:</span> <b>{student?.first_name} {student?.last_name}</b></div>
          <div><span className="text-muted-foreground">Adm. No:</span> {student?.admission_no}</div>
          <div><span className="text-muted-foreground">Class:</span> {student?.classes?.name ?? "—"}</div>
          <div><span className="text-muted-foreground">Method:</span> {payment.method}</div>
          {payment.reference && <div><span className="text-muted-foreground">Reference:</span> {payment.reference}</div>}
        </div>
        <table className="mt-4 w-full text-sm">
          <thead><tr className="border-b text-left text-xs uppercase text-muted-foreground"><th className="py-2">Description</th><th className="py-2 text-right">Amount</th></tr></thead>
          <tbody>
            <tr className="border-b"><td className="py-2">{invoice?.title} ({invoice?.session} • {invoice?.term})</td><td className="py-2 text-right">₦{Number(payment.amount).toLocaleString()}</td></tr>
          </tbody>
          <tfoot><tr><td className="pt-3 text-right font-semibold">Total paid</td><td className="pt-3 text-right font-bold">₦{Number(payment.amount).toLocaleString()}</td></tr></tfoot>
        </table>
        {payment.notes && <p className="mt-4 text-xs text-muted-foreground">Notes: {payment.notes}</p>}
        <p className="mt-8 text-center text-xs text-muted-foreground">Thank you for your payment. This is an electronically generated receipt.</p>
      </div>
    </div>
  );
}
