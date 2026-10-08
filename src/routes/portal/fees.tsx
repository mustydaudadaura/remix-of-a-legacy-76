import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useParentAuth } from "@/hooks/useParentAuth";
import { getActiveChildId } from "@/routes/portal";
import { getPortalFees } from "@/lib/api/portal.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export const Route = createFileRoute("/portal/fees")({
  head: () => ({ meta: [{ title: "Child Fees — EduERP Parent Portal" }, { name: "description", content: "Child Fees for authorized school accounts and families in EduERP." }, { property: "og:title", content: "Child Fees — EduERP Parent Portal" }, { property: "og:description", content: "Child Fees for authorized school accounts and families in EduERP." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

function Page() {
  const { token } = useParentAuth();
  const sid = getActiveChildId();
  const { data } = useQuery({
    queryKey: ["portal-fees", token, sid],
    queryFn: () => getPortalFees({ data: { token: token!, student_id: sid! } }),
    enabled: !!token && !!sid,
  });
  const invoices = data?.invoices ?? [];
  const payments = data?.payments ?? [];
  const balance = invoices.reduce((s: number, i: any) => s + (Number(i.amount_due) - Number(i.amount_paid)), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Total outstanding</div>
          <div className="text-3xl font-bold">₦{balance.toLocaleString()}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Invoices</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {invoices.length === 0 && <p className="text-sm text-muted-foreground">No invoices.</p>}
          {invoices.map((i: any) => {
            const bal = Number(i.amount_due) - Number(i.amount_paid);
            const variant = i.status === "paid" ? "secondary" : i.status === "overdue" ? "destructive" : "outline";
            return (
              <div key={i.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{i.title}</div>
                  <div className="text-xs text-muted-foreground capitalize">{i.session} • {i.term} {i.due_date ? `• due ${new Date(i.due_date).toLocaleDateString()}` : ""}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">₦{bal.toLocaleString()}</div>
                  <Badge variant={variant as any} className="mt-1 capitalize">{i.status}</Badge>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Payments & receipts</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {payments.length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
          {payments.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">₦{Number(p.amount).toLocaleString()} • {p.method}</div>
                <div className="text-xs text-muted-foreground">{new Date(p.paid_at).toLocaleDateString()} • {p.receipt_no}</div>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/portal/receipt/$id" params={{ id: p.id }}><Download className="mr-1 h-4 w-4" />Receipt</Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
