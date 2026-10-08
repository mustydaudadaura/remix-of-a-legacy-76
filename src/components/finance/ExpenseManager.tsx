import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { addExpense } from "@/lib/api/finance.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  { id: "classroom_supplies", name: "Classroom supplies" },
  { id: "electricity", name: "Electricity / generator" },
  { id: "fuel", name: "Fuel" },
  { id: "maintenance", name: "Repairs & maintenance" },
  { id: "transport", name: "Transport" },
  { id: "meals", name: "Meals & feeding" },
  { id: "salaries", name: "Salaries & wages" },
  { id: "rent", name: "Rent & rates" },
  { id: "events", name: "Events & functions" },
  { id: "other", name: "Other" },
];
const catName = (c: string) => CATEGORIES.find((x) => x.id === c)?.name ?? c;

type Expense = {
  id: string; expense_no: string; title: string; category: string;
  amount: number; spent_on: string; paid_to: string | null; method: string;
  reference: string | null; notes: string | null;
};

export function ExpenseManager() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [form, setForm] = useState({
    title: "", category: "classroom_supplies", amount: "", spent_on: new Date().toISOString().slice(0, 10),
    paid_to: "", method: "cash", reference: "", notes: "",
  });

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["school-expenses", schoolId],
    queryFn: async () => (await supabase.from("school_expenses")
      .select("id, expense_no, title, category, amount, spent_on, paid_to, method, reference, notes")
      .eq("school_id", schoolId!)
      .order("spent_on", { ascending: false }).limit(300)).data ?? [],
    enabled: !!schoolId,
  });

  const total = useMemo(() => expenses.reduce((s: number, e: Expense) => s + Number(e.amount), 0), [expenses]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return;
    try {
      const r = await addExpense({ data: {
        school_id: schoolId, title: form.title, category: form.category,
        amount: Number(form.amount), spent_on: form.spent_on,
        paid_to: form.paid_to || undefined, method: form.method,
        reference: form.reference || undefined, notes: form.notes || undefined,
      } });
      toast.success(`Expense ${r.expense.expense_no} recorded`);
      setOpen(false);
      setForm({ ...form, title: "", amount: "", paid_to: "", reference: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["school-expenses"] });
    } catch (err: any) { toast.error(err.message); }
  };

  const remove = async (row: Expense) => {
    if (!window.confirm(`Delete expense ${row.expense_no} (${row.title})?`)) return;
    const { error } = await supabase.from("school_expenses").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Expense deleted");
    qc.invalidateQueries({ queryKey: ["school-expenses"] });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Every naira the school spent. <b className="text-foreground">₦{total.toLocaleString()}</b> recorded.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPrinting(true)} disabled={!expenses.length}>
            <Printer className="mr-2 h-4 w-4" />Print expense book
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />New expense</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Record an expense</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                <div><Label>What was it for</Label>
                  <Input required value={form.title} placeholder="e.g. Purchase of chalk and duster"
                    onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Category</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div><Label>Amount (₦)</Label>
                    <Input type="number" min="1" required value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Date spent</Label>
                    <Input type="date" required value={form.spent_on}
                      onChange={(e) => setForm({ ...form, spent_on: e.target.value })} /></div>
                  <div><Label>Paid to</Label>
                    <Input value={form.paid_to} placeholder="Vendor or staff name"
                      onChange={(e) => setForm({ ...form, paid_to: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Method</Label>
                    <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="pos">POS</SelectItem>
                      </SelectContent>
                    </Select></div>
                  <div><Label>Reference</Label>
                    <Input value={form.reference} placeholder="Receipt or teller no"
                      onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
                </div>
                <div><Label>Notes</Label>
                  <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <Button type="submit" className="w-full">Save expense</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Expense book</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>No</TableHead><TableHead>Date</TableHead><TableHead>Title</TableHead>
                <TableHead>Category</TableHead><TableHead>Paid to</TableHead>
                <TableHead className="text-right">Amount</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {expenses.map((e: Expense) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.expense_no}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(e.spent_on).toLocaleDateString("en-NG")}</TableCell>
                    <TableCell className="text-sm">{e.title}</TableCell>
                    <TableCell className="text-xs">{catName(e.category)}</TableCell>
                    <TableCell className="text-xs">{e.paid_to ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm">₦{Number(e.amount).toLocaleString()}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" aria-label={`Delete ${e.expense_no}`} onClick={() => remove(e)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
                {!isLoading && !expenses.length && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No expenses recorded yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {printing && <ExpensePrintSheet expenses={expenses} total={total} onClose={() => setPrinting(false)} />}
    </div>
  );
}

function ExpensePrintSheet({ expenses, total, onClose }: { expenses: Expense[]; total: number; onClose: () => void }) {
  const { schoolId } = useAuth();
  const { data: school } = useQuery({
    queryKey: ["expense-school", schoolId],
    queryFn: async () => (await supabase.from("schools").select("name, address, current_session").eq("id", schoolId!).maybeSingle()).data,
    enabled: !!schoolId,
  });
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) m.set(e.category, (m.get(e.category) ?? 0) + Number(e.amount));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/95 p-4">
      <div className="mb-3 flex justify-end gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={() => window.print()}>Print / save PDF</Button>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>
      <div className="print-doc mx-auto max-w-3xl border p-6 text-sm">
        <div className="text-center">
          <h2 className="text-lg font-bold uppercase">{school?.name ?? "School"}</h2>
          <p className="text-xs">{school?.address}</p>
          <p className="mt-1 text-xs font-semibold uppercase">Expense book — {school?.current_session}</p>
        </div>
        <table className="mt-4 w-full border-collapse text-xs">
          <thead><tr className="border-b">
            <th className="py-1 text-left">Date</th><th className="py-1 text-left">No</th>
            <th className="py-1 text-left">Title</th><th className="py-1 text-left">Category</th>
            <th className="py-1 text-right">Amount</th>
          </tr></thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-b">
                <td className="py-1">{new Date(e.spent_on).toLocaleDateString("en-NG")}</td>
                <td className="py-1 font-mono">{e.expense_no}</td>
                <td className="py-1">{e.title}</td>
                <td className="py-1">{catName(e.category)}</td>
                <td className="py-1 text-right">₦{Number(e.amount).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2"><td colSpan={4} className="py-2 text-right font-bold">Total spent</td>
              <td className="py-2 text-right font-bold">₦{total.toLocaleString()}</td></tr>
          </tfoot>
        </table>
        <div className="mt-4 border-t pt-2">
          <p className="text-xs font-semibold uppercase">By category</p>
          {byCategory.map(([c, t]) => <p key={c} className="text-xs">{catName(c)}: ₦{t.toLocaleString()}</p>)}
        </div>
      </div>
    </div>
  );
}
