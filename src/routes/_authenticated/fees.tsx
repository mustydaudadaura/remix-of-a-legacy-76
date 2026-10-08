import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasRole } from "@/hooks/useAuth";
import { generateInvoicesForClass, recordPayment, notifyDefaulters } from "@/lib/api/fees.functions";
import { setInvoiceDiscount, invoiceOutstanding } from "@/lib/api/finance.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, BellRing, Percent } from "lucide-react";
import { toast } from "sonner";
import { ScholarshipManager } from "@/components/finance/ScholarshipManager";
import { ExpenseManager } from "@/components/finance/ExpenseManager";
import { PayrollManager } from "@/components/finance/PayrollManager";
import { FinanceReports } from "@/components/finance/FinanceReports";

export const Route = createFileRoute("/_authenticated/fees")({
  head: () => ({ meta: [{ title: "Fees — EduERP" }, { name: "description", content: "Fees for authorized school accounts and families in EduERP." }, { property: "og:title", content: "Fees — EduERP" }, { property: "og:description", content: "Fees for authorized school accounts and families in EduERP." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

type Invoice = {
  id: string; title: string; session: string; term: string;
  amount_due: number; amount_paid: number; discount_amount: number;
  discount_reason: string | null; discount_kind: string | null;
  status: string; due_date: string | null;
  students?: { first_name: string; last_name: string; admission_no: string } | null;
};

function Page() {
  const { schoolId, roles } = useAuth();
  const qc = useQueryClient();
  const canPayroll = hasRole(roles, "super_admin", "school_admin");

  const { data: items } = useQuery({
    queryKey: ["fee-items", schoolId],
    queryFn: async () => (await supabase.from("fee_items").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: invoices } = useQuery({
    queryKey: ["fee-invoices", schoolId],
    queryFn: async () => (await supabase.from("fee_invoices")
      .select("id, title, session, term, amount_due, amount_paid, discount_amount, discount_reason, discount_kind, status, due_date, students(first_name, last_name, admission_no)")
      .order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const { data: classes } = useQuery({
    queryKey: ["classes-fees"],
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });

  const list = (invoices ?? []) as Invoice[];
  const totals = list.reduce((acc, i) => {
    acc.due += Number(i.amount_due);
    acc.discount += Number(i.discount_amount ?? 0);
    acc.paid += Number(i.amount_paid);
    const bal = invoiceOutstanding(i);
    if (bal > 0) acc.balance += bal;
    return acc;
  }, { due: 0, discount: 0, paid: 0, balance: 0 });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Fees</h1>
          <p className="text-sm text-muted-foreground">Fee items, invoices, discounts, expenses, salaries and reports.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={async () => {
            if (!schoolId) return;
            const res = await notifyDefaulters({ data: { school_id: schoolId } });
            toast.success(`Sent ${res.count} reminder(s)`);
            qc.invalidateQueries({ queryKey: ["fee-invoices"] });
          }}><BellRing className="mr-2 h-4 w-4" />Notify defaulters</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Billed</p><p className="text-lg font-semibold">₦{totals.due.toLocaleString()}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Discounts given</p><p className="text-lg font-semibold">₦{totals.discount.toLocaleString()}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Collected</p><p className="text-lg font-semibold text-emerald-600">₦{totals.paid.toLocaleString()}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Still owing</p><p className="text-lg font-semibold text-destructive">₦{totals.balance.toLocaleString()}</p></div>
      </div>

      <Tabs defaultValue="invoices">
        <TabsList className="flex-wrap">
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="items">Fee items</TabsTrigger>
          <TabsTrigger value="scholarships">Scholarships</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          {canPayroll && <TabsTrigger value="payroll">Payroll</TabsTrigger>}
          {canPayroll && <TabsTrigger value="reports">Reports</TabsTrigger>}
        </TabsList>

        <TabsContent value="invoices" className="space-y-3">
          <GenerateInvoicesCard items={items ?? []} classes={classes ?? []} onDone={() => qc.invalidateQueries({ queryKey: ["fee-invoices"] })} />
          <Card>
            <CardHeader><CardTitle className="text-base">All invoices</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Student</TableHead><TableHead>Title</TableHead><TableHead>Term</TableHead>
                    <TableHead className="text-right">Billed</TableHead><TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead><TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {list.map((i) => {
                      const bal = invoiceOutstanding(i);
                      return (
                        <TableRow key={i.id}>
                          <TableCell className="text-sm">{i.students?.first_name} {i.students?.last_name}</TableCell>
                          <TableCell className="text-sm">{i.title}</TableCell>
                          <TableCell className="text-xs capitalize">{i.session} • {i.term}</TableCell>
                          <TableCell className="text-right text-sm">₦{Number(i.amount_due).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm">
                            {Number(i.discount_amount) > 0
                              ? <span title={i.discount_reason ?? ""}>₦{Number(i.discount_amount).toLocaleString()}</span>
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm">₦{Number(i.amount_paid).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm font-medium">₦{bal.toLocaleString()}</TableCell>
                          <TableCell><Badge variant={i.status === "paid" ? "secondary" : i.status === "overdue" ? "destructive" : "outline"} className="capitalize">{i.status}</Badge></TableCell>
                          <TableCell className="whitespace-nowrap">
                            <RecordPaymentDialog invoice={i} onDone={() => qc.invalidateQueries({ queryKey: ["fee-invoices"] })} />
                            <DiscountDialog invoice={i} onDone={() => qc.invalidateQueries({ queryKey: ["fee-invoices"] })} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!list.length && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No invoices</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items">
          <FeeItemsCard items={items ?? []} onDone={() => qc.invalidateQueries({ queryKey: ["fee-items"] })} />
        </TabsContent>

        <TabsContent value="scholarships"><ScholarshipManager /></TabsContent>
        <TabsContent value="expenses"><ExpenseManager /></TabsContent>
        {canPayroll && <TabsContent value="payroll"><PayrollManager /></TabsContent>}
        {canPayroll && <TabsContent value="reports"><FinanceReports /></TabsContent>}
      </Tabs>
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Fee items</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />New</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New fee item</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-3">
              <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Amount</Label><Input type="number" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                <div><Label>Session</Label><Input required placeholder="2025/2026" value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value })} /></div>
              </div>
              <div>
                <Label>Term</Label>
                <Select value={form.term} onValueChange={(v: any) => setForm({ ...form, term: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="first">First</SelectItem><SelectItem value="second">Second</SelectItem><SelectItem value="third">Third</SelectItem></SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Amount</TableHead><TableHead>Term</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((i: any) => (<TableRow key={i.id}><TableCell>{i.name}</TableCell><TableCell>₦{Number(i.amount).toLocaleString()}</TableCell><TableCell className="capitalize">{i.session} • {i.term}</TableCell></TableRow>))}
            {items.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No items yet</TableCell></TableRow>}
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
      toast.success(`Created ${r.created} invoices`); onDone();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Generate invoices for a class</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-4">
          <div>
            <Label>Class</Label>
            <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
              <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
              <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fee item</Label>
            <Select value={form.fee_item_id} onValueChange={(v) => setForm({ ...form, fee_item_id: v })}>
              <SelectTrigger><SelectValue placeholder="Fee" /></SelectTrigger>
              <SelectContent>{items.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name} (₦{Number(i.amount).toLocaleString()})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
          <div className="flex items-end"><Button type="submit" className="w-full" disabled={!form.class_id || !form.fee_item_id || busy}>{busy ? "…" : "Generate"}</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

function RecordPaymentDialog({ invoice, onDone }: { invoice: Invoice; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: "", method: "cash", reference: "", notes: "" });
  const balance = invoiceOutstanding(invoice);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await recordPayment({ data: { invoice_id: invoice.id, amount: Number(form.amount), method: form.method, reference: form.reference || undefined, notes: form.notes || undefined } });
      toast.success("Payment recorded"); setOpen(false); onDone();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline" disabled={balance <= 0}>Pay</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-muted-foreground">Balance: <b>₦{balance.toLocaleString()}</b></p>
          <div><Label>Amount</Label><Input type="number" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div><Label>Method</Label>
            <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem><SelectItem value="bank_transfer">Bank transfer</SelectItem><SelectItem value="pos">POS</SelectItem><SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Reference</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
          <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <Button type="submit" className="w-full">Save payment</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const DISCOUNT_KINDS = [
  { id: "scholarship", name: "Scholarship / bursary" },
  { id: "sibling", name: "Sibling discount" },
  { id: "staff_child", name: "Staff child" },
  { id: "early_payment", name: "Early payment" },
  { id: "waiver", name: "Hardship waiver" },
  { id: "other", name: "Other" },
];

function DiscountDialog({ invoice, onDone }: { invoice: Invoice; onDone: () => void }) {
  const [open, setOpen] = useState(false);
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
      await setInvoiceDiscount({ data: {
        invoice_id: invoice.id,
        discount_amount: Number(form.discount_amount || 0),
        discount_kind: form.discount_kind,
        discount_reason: form.discount_reason,
      } });
      toast.success("Discount saved"); setOpen(false); onDone();
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" aria-label="Discount this invoice"><Percent className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Discount or waiver</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {invoice.students?.first_name} {invoice.students?.last_name} — unpaid balance ₦{unpaid.toLocaleString()}
          </p>
          <div><Label htmlFor="inv_discount">Discount amount (₦)</Label>
            <Input id="inv_discount" type="number" min="0" max={unpaid} required value={form.discount_amount}
              onChange={(e) => setForm({ ...form, discount_amount: e.target.value })} /></div>
          <div><Label htmlFor="inv_discount_kind">Reason type</Label>
            <Select value={form.discount_kind} onValueChange={(v) => setForm({ ...form, discount_kind: v })}>
              <SelectTrigger id="inv_discount_kind"><SelectValue /></SelectTrigger>
              <SelectContent>{DISCOUNT_KINDS.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label htmlFor="inv_discount_reason">Reason (required)</Label>
            <Input id="inv_discount_reason" required value={form.discount_reason} placeholder="e.g. Second child — 50% sibling discount"
              onChange={(e) => setForm({ ...form, discount_reason: e.target.value })} /></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save discount"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
