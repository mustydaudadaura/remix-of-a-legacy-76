import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParentAuth } from "@/hooks/useParentAuth";
import { getActiveChildId } from "@/routes/portal";
import { getPortalFees } from "@/lib/api/portal.functions";
import { formatNaira, invoiceOutstanding, paymentProgressPercentage, calculateCollectionTotals, resolveFeeBreakdown } from "@/lib/finance-math";
import { generateStudentVirtualAccount, formatNubanDisplay } from "@/lib/virtual-accounts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DigitalReceipt, type ReceiptData } from "@/components/finance/DigitalReceipt";
import { Download, Receipt, Wallet, AlertCircle, CheckCircle2, Clock, Building2, Copy, ShieldCheck, Zap, CreditCard, ArrowRight } from "lucide-react";
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

  const virtualAccount = student
    ? generateStudentVirtualAccount({
        schoolCode: (school as any)?.code || "SCH",
        schoolName: school?.name || "School",
        studentId: student.id,
        admissionNo: student.admission_no,
        firstName: student.first_name,
        lastName: student.last_name,
      })
    : null;

  const currentInvoice = invoices[0];
  const feeBreakdown = currentInvoice
    ? resolveFeeBreakdown(currentInvoice.title, Number(currentInvoice.amount_due) || 0)
    : [];

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

        {/* Tab 3: Dedicated Virtual Account & Payment Instructions */}
        <TabsContent value="payment-info" className="space-y-4">
          {/* Dedicated Student Virtual Account Card */}
          {virtualAccount && (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 text-white shadow-lg border border-slate-700">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base tracking-tight">Dedicated Student Virtual Account</h3>
                    <p className="text-xs text-slate-300">Central Bank of Nigeria (CBN) Instant Automated Fee Clearing</p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[11px] font-semibold">
                  Instant NUBAN
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 block">Bank Name</span>
                  <span className="text-base font-bold text-white">{virtualAccount.bankName}</span>
                </div>

                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 block">Account Number (10-Digit NUBAN)</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xl sm:text-2xl font-extrabold text-emerald-400 tracking-wider">
                      {formatNubanDisplay(virtualAccount.accountNumber)}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => copyToClipboard(virtualAccount.accountNumber, "Virtual Account Number")}
                      className="h-7 px-2 text-xs bg-white/10 hover:bg-white/20 text-white border border-white/20"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 block">Account Beneficiary</span>
                  <span className="text-sm font-semibold text-white font-mono truncate block">{virtualAccount.accountName}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-300">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Transfers to this dedicated NUBAN clear pending invoices automatically within 30 seconds.</span>
                </div>
                <span className="font-mono text-[11px] text-slate-400">Ref: {virtualAccount.paymentReference}</span>
              </div>
            </div>
          )}

          {/* Nigerian Statutory Fee Breakdown Table */}
          {feeBreakdown.length > 0 && (
            <Card className="rounded-xl border border-border shadow-sm">
              <CardHeader className="py-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold">Standard Nigerian Fee Structure</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Statutory itemization across Tuition, PTA, Uniforms, Books, and Boarding.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs font-semibold">
                    Total: {formatNaira(sumBreakdown(feeBreakdown))}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-b border-border text-left text-muted-foreground font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Fee Component</th>
                        <th className="py-2.5 px-4">Classification</th>
                        <th className="py-2.5 px-4 text-right">Amount (₦)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {feeBreakdown.map((item, idx) => (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="py-3 px-4 font-medium text-foreground">
                            {item.name}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
                              {item.category}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                            {formatNaira(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/30 font-bold border-t border-border">
                      <tr>
                        <td colSpan={2} className="py-2.5 px-4 text-right text-muted-foreground">Composite Total:</td>
                        <td className="py-2.5 px-4 text-right font-mono text-primary text-sm">
                          {formatNaira(sumBreakdown(feeBreakdown))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* General School Bank Account (Manual Fallback) */}
          <Card className="rounded-xl border border-border shadow-sm">
            <CardHeader className="py-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                School Main Account & Bursary Over-the-Counter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs sm:text-sm">
              <p className="text-muted-foreground">
                In addition to your child's dedicated virtual account, you may also pay via POS at the bursary or via manual bank deposit. Please quote the student admission number.
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
                  <span className="text-muted-foreground">Main School Account:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-base text-foreground">1029384756</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard("1029384756", "Main School Account")}
                      className="h-7 w-7 p-0"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Student Narration Code:</span>
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
                  Confirmation & Electronic Receipts
                </span>
                <p className="text-muted-foreground">
                  Manual transfers are audited and credited within 24 hours. Dedicated virtual account transfers clear instantly. Download or print your verified electronic receipt anytime from the Payment History tab.
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
