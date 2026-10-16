import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParentAuth } from "@/hooks/useParentAuth";
import { getActiveChildId } from "@/routes/portal";
import { getPortalFees } from "@/lib/api/portal.functions";
import { formatNaira, invoiceOutstanding, paymentProgressPercentage, calculateCollectionTotals } from "@/lib/finance-math";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DigitalReceipt, type ReceiptData } from "@/components/finance/DigitalReceipt";
import { Download, Receipt, Wallet, AlertCircle, CheckCircle2, Clock, Building2, Copy, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/fees")({
  head: () => ({
    meta: [
      { title: "Fee Payment Tracking & Receipts — EduERP Parent Portal" },
      { name: "description", content: "Track child school fee payments, pending balances, and digital payment receipts." },
      { property: "og:title", content: "Fee Payment Tracking & Receipts — EduERP Parent Portal" },
      { property: "og:description", content: "Track child school fee payments, pending balances, and digital payment receipts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { token } = useParentAuth();
  const sid = getActiveChildId();
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["portal-fees", token, sid],
    queryFn: () => getPortalFees({ data: { token: token!, student_id: sid! } }),
    enabled: !!token && !!sid,
  });

  const invoices = data?.invoices ?? [];
  const payments = data?.payments ?? [];
  const student = data?.student;
  const school = data?.school;

  const totals = calculateCollectionTotals(invoices);
  const now = new Date();

  const handleOpenReceipt = (p: any) => {
    // Find matching invoice for this payment
    const inv = invoices.find((i: any) => i.id === p.invoice_id) || invoices[0];
    setSelectedReceipt({
      payment: {
        id: p.id,
        receipt_no: p.receipt_no,
        amount: p.amount,
        method: p.method,
        reference: p.reference,
        paid_at: p.paid_at,
        notes: p.notes,
      },
      invoice: inv,
      student,
      school,
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copied to clipboard`);
    });
  };

  if (!sid) {
    return (
      <Card className="rounded-xl border border-border shadow-sm p-8 text-center">
        <p className="text-sm text-muted-foreground">Please select a student above to view fee accounts and payment tracking.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Top Banner & Summary Cards */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Fee Payment Tracking
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {student ? `Account statement for ${student.first_name} ${student.last_name}` : "Student Fee & Receipt Portal"}
          </p>
        </div>
        {student?.classes?.name && (
          <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-1">
            Class: {student.classes.name}
          </Badge>
        )}
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Outstanding Balance */}
        <div className={`rounded-xl border p-4 shadow-sm ${totals.outstanding > 0 ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300"}`}>
          <div className="flex items-center justify-between text-xs font-medium mb-1">
            <span>Outstanding Balance</span>
            {totals.outstanding > 0 ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          </div>
          <div className="text-2xl font-extrabold tracking-tight">
            {formatNaira(totals.outstanding)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {totals.outstanding > 0 ? "Pending collection" : "All fees cleared"}
          </p>
        </div>

        {/* Total Paid */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
            <span>Total Paid</span>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {formatNaira(totals.collected)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {totals.collectionRate}% of net payable
          </p>
        </div>

        {/* Total Invoiced */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
            <span>Total Billed</span>
            <Clock className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {formatNaira(totals.billed)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {invoices.length} invoice(s) issued
          </p>
        </div>

        {/* Total Discounts */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
            <span>Discounts & Waivers</span>
            <ShieldCheck className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {formatNaira(totals.discounts)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Scholarships & fee concessions
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList className="bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="invoices" className="gap-1.5 text-xs sm:text-sm">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            Invoices & Pending Fees
            {totals.outstanding > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                {formatNaira(totals.outstanding)}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5 text-xs sm:text-sm">
            <Receipt className="h-4 w-4 text-emerald-600" />
            Payment History & Receipts
            {payments.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                {payments.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="payment-info" className="gap-1.5 text-xs sm:text-sm">
            <Building2 className="h-4 w-4 text-primary" />
            Payment Instructions
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Invoices & Balances */}
        <TabsContent value="invoices" className="space-y-3">
          {invoices.length === 0 && !isLoading && (
            <Card className="rounded-xl border border-border p-8 text-center text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-600/40 mb-2" />
              <p className="font-semibold text-sm">No fee invoices recorded</p>
              <p className="text-xs">There are no outstanding invoices or fee charges for this student.</p>
            </Card>
          )}

          {invoices.map((i: any) => {
            const bal = invoiceOutstanding(i);
            const progress = paymentProgressPercentage(i);
            const isOverdue = i.due_date ? new Date(i.due_date) < now && bal > 0 : false;
            const hasPayments = Number(i.amount_paid) > 0;

            return (
              <Card key={i.id} className="rounded-xl border border-border shadow-sm overflow-hidden hover:border-primary/30 transition">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-foreground">{i.title}</h3>
                        {bal <= 0 ? (
                          <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0.5">
                            Fully Paid
                          </Badge>
                        ) : isOverdue ? (
                          <Badge variant="destructive" className="text-[10px] px-2 py-0.5">
                            Overdue
                          </Badge>
                        ) : progress > 0 ? (
                          <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50 text-[10px] px-2 py-0.5">
                            Partially Paid
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-[10px] px-2 py-0.5">
                            Unpaid
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                        {i.session} • {i.term} Term
                        {i.due_date && (
                          <span className={isOverdue ? "text-destructive font-semibold ml-2" : "ml-2"}>
                            • Due by {new Date(i.due_date).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-left sm:text-right">
                      <div className="text-xs text-muted-foreground">Pending Balance</div>
                      <div className={`text-xl font-extrabold ${bal > 0 ? "text-destructive" : "text-emerald-600"}`}>
                        {bal > 0 ? formatNaira(bal) : "₦0.00 (Cleared)"}
                      </div>
                    </div>
                  </div>

                  {/* Financial Breakdown Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                      <span className="text-muted-foreground block text-[11px]">Billed Amount</span>
                      <span className="font-semibold text-foreground text-sm">{formatNaira(i.amount_due)}</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                      <span className="text-muted-foreground block text-[11px]">Discount / Waiver</span>
                      <span className="font-semibold text-amber-600 text-sm">
                        {Number(i.discount_amount) > 0 ? `-${formatNaira(i.discount_amount)}` : "—"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                      <span className="text-muted-foreground block text-[11px]">Amount Paid</span>
                      <span className="font-semibold text-emerald-600 text-sm">{formatNaira(i.amount_paid)}</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                      <span className="text-muted-foreground block text-[11px]">Remaining Due</span>
                      <span className={`font-bold text-sm ${bal > 0 ? "text-destructive" : "text-emerald-600"}`}>
                        {formatNaira(bal)}
                      </span>
                    </div>
                  </div>

                  {/* Payment Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Payment Completion</span>
                      <span className="font-bold text-foreground">{progress}% Paid</span>
                    </div>
                    <Progress value={progress} className="h-2 rounded-full" />
                  </div>

                  {/* Actions */}
                  {hasPayments && (
                    <div className="mt-4 pt-3 border-t border-border/70 flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const invPayment = payments.find((p: any) => p.invoice_id === i.id) || payments[0];
                          if (invPayment) handleOpenReceipt(invPayment);
                        }}
                        className="h-8 text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        View Latest Payment Receipt
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Tab 2: Payment History & Receipts */}
        <TabsContent value="payments" className="space-y-3">
          <Card className="rounded-xl border border-border shadow-sm">
            <CardHeader className="py-4">
              <CardTitle className="text-base font-semibold">Payment History & Digital Receipts</CardTitle>
              <p className="text-xs text-muted-foreground">
                All confirmed payments recorded by the school bursary with downloadable, QR-verified electronic receipts.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              {payments.length === 0 && !isLoading && (
                <div className="py-12 text-center text-muted-foreground">
                  <Receipt className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="font-semibold text-sm">No payment records yet</p>
                  <p className="text-xs">Once a payment is processed by the school, official receipts will be available here.</p>
                </div>
              )}

              {payments.map((p: any) => {
                const formattedDate = new Date(p.paid_at).toLocaleDateString("en-NG", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                const formattedTime = new Date(p.paid_at).toLocaleTimeString("en-NG", {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={p.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition shadow-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-extrabold text-foreground">
                          {formatNaira(p.amount)}
                        </span>
                        <Badge variant="outline" className="text-[11px] capitalize">
                          {p.method?.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-mono font-bold text-foreground">{p.receipt_no}</span> • {formattedDate} at {formattedTime}
                      </div>
                      {p.reference && (
                        <div className="text-[11px] text-muted-foreground font-mono">
                          Ref: {p.reference}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenReceipt(p)}
                        className="h-8 text-xs gap-1.5"
                      >
                        <Receipt className="h-3.5 w-3.5 text-primary" />
                        Preview Receipt
                      </Button>
                      <Button asChild size="sm" className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground">
                        <Link to="/portal/receipt/$id" params={{ id: p.id }}>
                          <Download className="h-3.5 w-3.5" />
                          Full Receipt & PDF
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Payment Instructions */}
        <TabsContent value="payment-info" className="space-y-3">
          <Card className="rounded-xl border border-border shadow-sm">
            <CardHeader className="py-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                School Bank Account & Payment Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs sm:text-sm">
              <p className="text-muted-foreground">
                School fees can be paid via direct bank transfer, bank deposit, or at the school bursary via POS.
                Please ensure you quote the student's admission number in the transfer narration for fast automatic reconciliation.
              </p>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-primary/10 pb-2">
                  <span className="text-muted-foreground">Account Name:</span>
                  <span className="font-bold text-foreground">{school?.name || "Result Arena / EduERP School"}</span>
                </div>
                <div className="flex items-center justify-between border-b border-primary/10 pb-2">
                  <span className="text-muted-foreground">Bank:</span>
                  <span className="font-bold text-foreground">First Bank of Nigeria / Zenith Bank</span>
                </div>
                <div className="flex items-center justify-between border-b border-primary/10 pb-2">
                  <span className="text-muted-foreground">Account Number:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-base text-foreground">1029384756</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard("1029384756", "Account Number")}
                      className="h-7 w-7 p-0"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Mandatory Narration:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-primary">
                      {student?.admission_no || "STUDENT-ADM-NO"} - {student?.last_name || "FEES"}
                    </span>
                    {student?.admission_no && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(`${student.admission_no} - ${student.last_name}`, "Narration code")}
                        className="h-7 w-7 p-0"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs space-y-1">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Confirmation & Receipt Issuance
                </span>
                <p className="text-muted-foreground">
                  Once your transfer is received, the accounts department verifies and issues your official electronic receipt within 24 hours. You will receive an instant notification on this portal.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Digital Receipt Modal */}
      {selectedReceipt && (
        <Dialog open={!!selectedReceipt} onOpenChange={(open) => !open && setSelectedReceipt(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Official Digital Payment Receipt
              </DialogTitle>
            </DialogHeader>
            <DigitalReceipt data={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
