import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { generateInvoicesForClass, recordPayment, notifyDefaulters } from "@/lib/api/fees.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, BellRing } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/fees")({
  head: () => ({ meta: [{ title: "Fees — EduERP" }, { name: "description", content: "Fees for authorized school accounts and families in EduERP." }, { property: "og:title", content: "Fees — EduERP" }, { property: "og:description", content: "Fees for authorized school accounts and families in EduERP." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

function Page() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();

  const { data: items } = useQuery({
    queryKey: ["fee-items", schoolId],
    queryFn: async () => (await supabase.from("fee_items").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: invoices } = useQuery({
    queryKey: ["fee-invoices", schoolId],
    queryFn: async () => (await supabase.from("fee_invoices").select("id, title, session, term, amount_due, amount_paid, status, due_date, students(first_name, last_name, admission_no)").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const { data: classes } = useQuery({
    queryKey: ["classes-fees"],
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Fees</h1>
          <p className="text-sm text-muted-foreground">Manage fee items, invoices and payments.</p>
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

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="items">Fee items</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-3">
          <GenerateInvoicesCard items={items ?? []} classes={classes ?? []} onDone={() => qc.invalidateQueries({ queryKey: ["fee-invoices"] })} />
          <Card>
            <CardHeader><CardTitle className="text-base">All invoices</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Title</TableHead><TableHead>Term</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(invoices ?? []).map((i: any) => {
                      const bal = Number(i.amount_due) - Number(i.amount_paid);
                      return (
                        <TableRow key={i.id}>
                          <TableCell className="text-sm">{i.students?.first_name} {i.students?.last_name}</TableCell>
                          <TableCell className="text-sm">{i.title}</TableCell>
                          <TableCell className="text-xs capitalize">{i.session} • {i.term}</TableCell>
                          <TableCell className="text-sm">₦{bal.toLocaleString()}</TableCell>
                          <TableCell><Badge variant={i.status === "paid" ? "secondary" : i.status === "overdue" ? "destructive" : "outline"} className="capitalize">{i.status}</Badge></TableCell>
                          <TableCell><RecordPaymentDialog invoice={i} onDone={() => qc.invalidateQueries({ queryKey: ["fee-invoices"] })} /></TableCell>
                        </TableRow>
                      );
                    })}
                    {(invoices ?? []).length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No invoices</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items">
          <FeeItemsCard items={items ?? []} onDone={() => qc.invalidateQueries({ queryKey: ["fee-items"] })} />
        </TabsContent>
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

function RecordPaymentDialog({ invoice, onDone }: any) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: "", method: "cash", reference: "", notes: "" });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await recordPayment({ data: { invoice_id: invoice.id, amount: Number(form.amount), method: form.method, reference: form.reference || undefined, notes: form.notes || undefined } });
      toast.success("Payment recorded"); setOpen(false); onDone();
    } catch (e: any) { toast.error(e.message); }
  };
  const balance = Number(invoice.amount_due) - Number(invoice.amount_paid);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline" disabled={invoice.status === "paid"}>Pay</Button></DialogTrigger>
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
