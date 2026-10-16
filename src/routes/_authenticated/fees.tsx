import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasRole } from "@/hooks/useAuth";
import { generateInvoicesForClass, recordPayment, notifyDefaulters } from "@/lib/api/fees.functions";
import { setInvoiceDiscount } from "@/lib/api/finance.functions";
import { invoiceOutstanding, formatNaira, calculateCollectionTotals } from "@/lib/finance-math";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, BellRing, Percent, Receipt, Wallet, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { ScholarshipManager } from "@/components/finance/ScholarshipManager";
import { ExpenseManager } from "@/components/finance/ExpenseManager";
import { PayrollManager } from "@/components/finance/PayrollManager";
import { FinanceReports } from "@/components/finance/FinanceReports";
import { PaymentHistoryTable, type PaymentRecord } from "@/components/finance/PaymentHistoryTable";
import { PendingBalancesTracker, type PendingInvoice } from "@/components/finance/PendingBalancesTracker";
import { DigitalReceipt, type ReceiptData } from "@/components/finance/DigitalReceipt";

export const Route = createFileRoute("/_authenticated/fees")({
  head: () => ({
    meta: [
      { title: "Fees & Payment Tracking — EduERP" },
      { name: "description", content: "Fee payment tracking, pending balances, collection history, and digital payment receipts." },
      { property: "og:title", content: "Fees & Payment Tracking — EduERP" },
      { property: "og:description", content: "Fee payment tracking, pending balances, collection history, and digital payment receipts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Invoice = {
  id: string; title: string; session: string; term: string;
  amount_due: number; amount_paid: number; discount_amount: number;
  discount_reason: string | null; discount_kind: string | null;
  status: string; due_date: string | null;
  students?: { id: string; first_name: string; last_name: string; admission_no: string; class_id?: string | null; classes?: { id: string; name: string } | null } | null;
};

function Page() {
  const { schoolId, roles } = useAuth();
  const qc = useQueryClient();
  const canPayroll = hasRole(roles, "super_admin", "school_admin");

  const [activeTab, setActiveTab] = useState("pending-balances");
  const [selectedInvoiceForPay, setSelectedInvoiceForPay] = useState<Invoice | null>(null);
  const [selectedInvoiceForDiscount, setSelectedInvoiceForDiscount] = useState<Invoice | null>(null);
  const [activeReceiptData, setActiveReceiptData] = useState<ReceiptData | null>(null);

  const { data: items } = useQuery({
    queryKey: ["fee-items", schoolId],
    queryFn: async () => (await supabase.from("fee_items").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: invoices } = useQuery({
    queryKey: ["fee-invoices", schoolId],
    queryFn: async () => (await supabase.from("fee_invoices")
      .select("id, title, session, term, amount_due, amount_paid, discount_amount, discount_reason, discount_kind, status, due_date, students(id, first_name, last_name, admission_no, class_id, classes(id, name))")
      .order("created_at", { ascending: false }).limit(250)).data ?? [],
  });

  const { data: payments, isLoading: isPaymentsLoading } = useQuery({
    queryKey: ["fee-payments", schoolId],
    queryFn: async () => (await supabase.from("fee_payments")
      .select("*, students(id, first_name, last_name, admission_no, classes(name)), fee_invoices(id, title, session, term, amount_due, amount_paid, discount_amount, discount_reason, discount_kind, status, due_date)")
      .order("paid_at", { ascending: false }).limit(300)).data ?? [],
  });

  const { data: school } = useQuery({
    queryKey: ["school-profile", schoolId],
    queryFn: async () => {
      if (!schoolId) return null;
      const { data } = await supabase.from("schools").select("name, logo_url, address, phone, email, motto, branch_name").eq("id", schoolId).maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });

  const { data: classes } = useQuery({
    queryKey: ["classes-fees"],
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });

  const list = (invoices ?? []) as Invoice[];
  const totals = calculateCollectionTotals(list);

  const handleNotifyDefaulters = async () => {
    if (!schoolId) return;
    try {
      const res = await notifyDefaulters({ data: { school_id: schoolId } });
      toast.success(`Sent reminder notification to ${res.count} parent(s) with pending balance`);
      qc.invalidateQueries({ queryKey: ["fee-invoices"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to notify defaulters");
    }
  };

  const handleViewInvoiceReceipt = (inv: Invoice) => {
    // Find latest payment for this invoice
    const invPayments = (payments ?? []).filter((p: any) => p.invoice_id === inv.id);
    if (!invPayments.length) {
      toast.info("No payment has been recorded for this invoice yet");
      return;
    }
    const latestPay = invPayments[0];
    setActiveReceiptData({
      payment: {
        id: latestPay.id,
        receipt_no: latestPay.receipt_no,
        amount: latestPay.amount,
        method: latestPay.method,
        reference: latestPay.reference,
        paid_at: latestPay.paid_at,
        notes: latestPay.notes,
      },
      invoice: inv,
      student: inv.students,
      school,
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Fees & Payment Tracking</h1>
          <p className="text-sm text-muted-foreground">
            Track student fee payments, monitor pending balances, and generate verified digital receipts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleNotifyDefaulters} className="gap-1.5 text-xs">
            <BellRing className="h-4 w-4 text-amber-600" />
            Notify Defaulters
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="pending-balances" className="gap-1.5 text-xs sm:text-sm">
            <AlertCircle className="h-4 w-4 text-destructive" />
            Pending Balances
            {totals.outstanding > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                {formatNaira(totals.outstanding)}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs sm:text-sm">
            <Receipt className="h-4 w-4 text-emerald-600" />
            Payment History & Receipts
            {(payments?.length ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                {payments?.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="invoices" className="text-xs sm:text-sm">All Invoices</TabsTrigger>
          <TabsTrigger value="items" className="text-xs sm:text-sm">Fee Items</TabsTrigger>
          <TabsTrigger value="scholarships" className="text-xs sm:text-sm">Scholarships & Waivers</TabsTrigger>
          <TabsTrigger value="expenses" className="text-xs sm:text-sm">Expenses</TabsTrigger>
          {canPayroll && <TabsTrigger value="payroll" className="text-xs sm:text-sm">Payroll</TabsTrigger>}
          {canPayroll && <TabsTrigger value="reports" className="text-xs sm:text-sm">Reports</TabsTrigger>}
        </TabsList>

        {/* Tab 1: Pending Balances Tracker */}
        <TabsContent value="pending-balances" className="space-y-4">
          <PendingBalancesTracker
            invoices={list as unknown as PendingInvoice[]}
            classes={classes ?? []}
            onRecordPayment={(inv) => setSelectedInvoiceForPay(inv as unknown as Invoice)}
            onApplyDiscount={(inv) => setSelectedInvoiceForDiscount(inv as unknown as Invoice)}
            onNotifyDefaulters={handleNotifyDefaulters}
          />
        </TabsContent>

        {/* Tab 2: Payment History & Receipts */}
        <TabsContent value="history" className="space-y-4">
          <PaymentHistoryTable
            payments={(payments ?? []) as PaymentRecord[]}
            school={school}
            isLoading={isPaymentsLoading}
          />
        </TabsContent>

        {/* Tab 3: All Invoices */}
        <TabsContent value="invoices" className="space-y-4">
          <GenerateInvoicesCard
            items={items ?? []}
            classes={classes ?? []}
            onDone={() => {
              qc.invalidateQueries({ queryKey: ["fee-invoices"] });
              qc.invalidateQueries({ queryKey: ["fee-payments"] });
            }}
          />

          <Card className="rounded-xl border border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-base font-semibold">Master Invoices Registry</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Showing all generated student fee invoices and billing status.</p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead className="text-right">Billed</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((i) => {
                      const bal = invoiceOutstanding(i);
                      const hasPaidAny = Number(i.amount_paid) > 0;
                      return (
                        <TableRow key={i.id} className="hover:bg-muted/30">
                          <TableCell className="text-sm">
                            <div className="font-medium text-foreground">{i.students?.first_name} {i.students?.last_name}</div>
                            <div className="text-[11px] font-mono text-muted-foreground">{i.students?.admission_no}</div>
                          </TableCell>
                          <TableCell className="text-sm font-medium">{i.title}</TableCell>
                          <TableCell className="text-xs capitalize text-muted-foreground">{i.session} • {i.term}</TableCell>
                          <TableCell className="text-right text-xs font-medium">{formatNaira(i.amount_due)}</TableCell>
                          <TableCell className="text-right text-xs">
                            {Number(i.discount_amount) > 0 ? (
                              <span className="text-amber-600 font-medium" title={i.discount_reason ?? ""}>
                                -{formatNaira(i.discount_amount)}
                              </span>
                            ) : (
                              "——"
                            )}
                          </TableCell>
                          <TableCell className="text-right text-xs font-medium text-emerald-600">{formatNaira(i.amount_paid)}</TableCell>
                          <TableCell className="text-right text-xs font-bold">
                            <span className={bal > 0 ? "text-destructive" : "text-emerald-600"}>
                              {formatNaira(bal)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={i.status === "paid" ? "secondary" : i.status === "overdue" ? "destructive" : "outline"}
                              className="capitalize text-[11px]"
                            >
                              {i.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {hasPaidAny && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleViewInvoiceReceipt(i)}
                                  className="h-8 text-xs px-2 text-primary hover:bg-primary/10 gap-1"
                                  title="View Latest Digital Receipt"
                                >
                                  <Receipt className="h-3.5 w-3.5" />
                                  Receipt
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={bal <= 0}
                                onClick={() => setSelectedInvoiceForPay(i)}
                                className="h-8 text-xs px-2.5"
                              >
                                Pay
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedInvoiceForDiscount(i)}
                                className="h-8 w-8 p-0"
                                title="Discount or waiver"
                              >
                                <Percent className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!list.length && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                          No fee invoices found. Generate invoices for a class above to begin.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Fee Items */}
        <TabsContent value="items">
          <FeeItemsCard items={items ?? []} onDone={() => qc.invalidateQueries({ queryKey: ["fee-items"] })} />
        </TabsContent>

        {/* Tab 5: Scholarships */}
        <TabsContent value="scholarships">
          <ScholarshipManager />
        </TabsContent>

        {/* Tab 6: Expenses */}
        <TabsContent value="expenses">
          <ExpenseManager />
        </TabsContent>

        {/* Tab 7: Payroll */}
        {canPayroll && (
          <TabsContent value="payroll">
            <PayrollManager />
          </TabsContent>
        )}

        {/* Tab 8: Reports */}
        {canPayroll && (
          <TabsContent value="reports">
            <FinanceReports />
          </TabsContent>
        )}
      </Tabs>

      {/* Dialog for Recording Payment */}
      {selectedInvoiceForPay && (
        <RecordPaymentModal
          invoice={selectedInvoiceForPay}
          open={!!selectedInvoiceForPay}
          onOpenChange={(open) => !open && setSelectedInvoiceForPay(null)}
          onDone={(newPayment) => {
            qc.invalidateQueries({ queryKey: ["fee-invoices"] });
            qc.invalidateQueries({ queryKey: ["fee-payments"] });
            setSelectedInvoiceForPay(null);
            if (newPayment) {
              setActiveReceiptData({
                payment: newPayment,
                invoice: selectedInvoiceForPay,
                student: selectedInvoiceForPay.students,
                school,
              });
            }
          }}
        />
      )}

      {/* Dialog for Setting Discount */}
      {selectedInvoiceForDiscount && (
        <DiscountModal
          invoice={selectedInvoiceForDiscount}
          open={!!selectedInvoiceForDiscount}
          onOpenChange={(open) => !open && setSelectedInvoiceForDiscount(null)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["fee-invoices"] });
            setSelectedInvoiceForDiscount(null);
          }}
        />
      )}

      {/* Digital Receipt Modal */}
      {activeReceiptData && (
        <Dialog open={!!activeReceiptData} onOpenChange={(open) => !open && setActiveReceiptData(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Digital Payment Receipt
              </DialogTitle>
            </DialogHeader>
            <DigitalReceipt data={activeReceiptData} onClose={() => setActiveReceiptData(null)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function FeeItemsCard({ items, onDone }: any) {
  const { schoolId } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", amount: "", session: "", term: "first" as "first"|"second"|"third" });
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return;
    const { error } = await supabase.from("fee_items").insert({ school_id: schoolId, name: form.name, amount: Number(form.amount), session: form.session, term: form.term } as never);
    if (error) return toast.error(error.message);
    toast.success("Fee item added"); setOpen(false); setForm({ name: "", amount: "", session: "", term: "first" }); onDone();
  };
  return (
    <Card className="rounded-xl border border-border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold">Standard Fee Items</CardTitle>
          <p className="text-xs text-muted-foreground">Define standard tuition, boarding, uniform, and activity fees per session and term.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />New Item</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Fee Item</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-3">
              <div><Label>Name</Label><Input required placeholder="e.g. Tuition Fee" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Amount (₦)</Label><Input type="number" required placeholder="50000" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                <div><Label>Academic Session</Label><Input required placeholder="2025/2026" value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value })} /></div>
              </div>
              <div>
                <Label>Term</Label>
                <Select value={form.term} onValueChange={(v: any) => setForm({ ...form, term: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="first">First Term</SelectItem><SelectItem value="second">Second Term</SelectItem><SelectItem value="third">Third Term</SelectItem></SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">Save Fee Item</Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-muted/40"><TableRow><TableHead>Fee Name</TableHead><TableHead className="text-right">Standard Amount</TableHead><TableHead>Term & Session</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((i: any) => (<TableRow key={i.id}><TableCell className="font-medium text-sm">{i.name}</TableCell><TableCell className="text-right font-semibold text-sm">{formatNaira(i.amount)}</TableCell><TableCell className="capitalize text-xs text-muted-foreground">{i.session} • {i.term} Term</TableCell></TableRow>))}
            {items.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No fee items configured yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function GenerateInvoicesCard({ items, classes, onDone }: any) {
  const [form, setForm] = useState({ class_id: "", fee_item_id: "", due_date: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await generateInvoicesForClass({ data: { class_id: form.class_id, fee_item_id: form.fee_item_id, due_date: form.due_date || undefined } });
      toast.success(`Successfully generated ${r.created} invoices`);
      onDone();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Card className="rounded-xl border border-border shadow-sm">
      <CardHeader className="py-4"><CardTitle className="text-base font-semibold">Generate Class Fee Invoices</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-4">
          <div>
            <Label>Target Class</Label>
            <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
              <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fee Item</Label>
            <Select value={form.fee_item_id} onValueChange={(v) => setForm({ ...form, fee_item_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select Fee" /></SelectTrigger>
              <SelectContent>{items.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name} ({formatNaira(i.amount)})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Payment Due Date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
          <div className="flex items-end"><Button type="submit" className="w-full" disabled={!form.class_id || !form.fee_item_id || busy}>{busy ? "Generating…" : "Generate Invoices"}</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

function RecordPaymentModal({
  invoice,
  open,
  onOpenChange,
  onDone,
}: {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (newPayment?: any) => void;
}) {
  const balance = invoiceOutstanding(invoice);
  const [form, setForm] = useState({ amount: String(Math.max(balance, 0)), method: "bank_transfer", reference: "", notes: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await recordPayment({
        data: {
          invoice_id: invoice.id,
          amount: Number(form.amount),
          method: form.method,
          reference: form.reference || undefined,
          notes: form.notes || undefined,
        },
      });
      toast.success(`Payment of ${formatNaira(form.amount)} recorded! Receipt ${res.payment?.receipt_no} generated.`);
      onDone(res.payment);
    } catch (e: any) {
      toast.error(e.message || "Failed to record payment");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-emerald-600" />
            Record Fee Payment
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3.5">
          <div className="rounded-lg bg-muted/40 p-3 border border-border text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Student:</span>
              <span className="font-semibold text-foreground">{invoice.students?.first_name} {invoice.students?.last_name} ({invoice.students?.admission_no})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fee Item:</span>
              <span className="font-medium text-foreground">{invoice.title}</span>
            </div>
            <div className="flex justify-between text-sm pt-1 border-t border-border">
              <span className="font-medium text-muted-foreground">Outstanding Balance:</span>
              <span className="font-bold text-destructive">{formatNaira(balance)}</span>
            </div>
          </div>

          <div>
            <Label htmlFor="pay_amount">Payment Amount (₦)</Label>
            <Input
              id="pay_amount"
              type="number"
              min="1"
              max={Math.max(balance, 1)}
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="font-bold text-base"
            />
          </div>

          <div>
            <Label htmlFor="pay_method">Payment Method</Label>
            <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
              <SelectTrigger id="pay_method"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Direct Bank Transfer</SelectItem>
                <SelectItem value="pos">POS Terminal (Card at Bursary)</SelectItem>
                <SelectItem value="cash">Cash at Bursary</SelectItem>
                <SelectItem value="online">Online Payment Gateway</SelectItem>
                <SelectItem value="cheque">Bank Draft / Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="pay_ref">Transaction Reference / Teller No. (Optional)</Label>
            <Input
              id="pay_ref"
              placeholder="e.g. STANBIC/REF-94819"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="pay_notes">Bursar Notes / Narration (Optional)</Label>
            <Input
              id="pay_notes"
              placeholder="e.g. Paid by Parent via mobile app"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" disabled={busy}>
            {busy ? "Recording Payment & Issuing Receipt…" : `Confirm Payment (${formatNaira(form.amount || 0)})`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const DISCOUNT_KINDS = [
  { id: "scholarship", name: "Scholarship / Bursary" },
  { id: "sibling", name: "Sibling Discount" },
  { id: "staff_child", name: "Staff Child Concession" },
  { id: "early_payment", name: "Early Payment Incentive" },
  { id: "waiver", name: "Financial Hardship Waiver" },
  { id: "other", name: "Other Approved Concession" },
];

function DiscountModal({
  invoice,
  open,
  onOpenChange,
  onDone,
}: {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    discount_amount: String(invoice.discount_amount ?? 0),
    discount_kind: invoice.discount_kind ?? "scholarship",
    discount_reason: invoice.discount_reason ?? "",
  });
  const unpaid = Number(invoice.amount_due) - Number(invoice.amount_paid);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await setInvoiceDiscount({
        data: {
          invoice_id: invoice.id,
          discount_amount: Number(form.discount_amount || 0),
          discount_kind: form.discount_kind,
          discount_reason: form.discount_reason,
        },
      });
      toast.success("Discount / waiver successfully saved");
      onDone();
    } catch (err: any) {
      toast.error(err.message || "Failed to save discount");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Fee Discount or Waiver</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3.5">
          <div className="rounded-lg bg-muted/40 p-3 border border-border text-xs">
            <span className="font-semibold text-foreground">{invoice.students?.first_name} {invoice.students?.last_name}</span>
            <div className="text-muted-foreground mt-0.5">Maximum eligible waivable amount: <b>{formatNaira(unpaid)}</b></div>
          </div>

          <div>
            <Label htmlFor="inv_discount">Discount / Waiver Amount (₦)</Label>
            <Input
              id="inv_discount"
              type="number"
              min="0"
              max={unpaid}
              required
              value={form.discount_amount}
              onChange={(e) => setForm({ ...form, discount_amount: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="inv_discount_kind">Concession Category</Label>
            <Select value={form.discount_kind} onValueChange={(v) => setForm({ ...form, discount_kind: v })}>
              <SelectTrigger id="inv_discount_kind"><SelectValue /></SelectTrigger>
              <SelectContent>{DISCOUNT_KINDS.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="inv_discount_reason">Approval Reason (Required for audit)</Label>
            <Input
              id="inv_discount_reason"
              required
              value={form.discount_reason}
              placeholder="e.g. 50% Sibling concession approved by Principal"
              onChange={(e) => setForm({ ...form, discount_reason: e.target.value })}
            />
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Saving Concession…" : "Save Discount / Waiver"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
