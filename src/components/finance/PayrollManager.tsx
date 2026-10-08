import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { runPayroll, saveStaffSalary, markSalaryPaid, setSalaryDeduction } from "@/lib/api/finance.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Play, Printer, Wallet } from "lucide-react";
import { toast } from "sonner";

type Staff = { user_id: string; name: string; role: string };
type Salary = {
  id: string; user_id: string; month: string; payslip_no: string; basic: number;
  allowances: number; deductions: number; net: number; status: string;
  method: string | null; reference: string | null; notes: string | null;
};

const roleLabel = (r: string) => r === "school_admin" ? "Administrator" : r === "teacher" ? "Teacher" : r === "accountant" ? "Accountant" : r;

export function PayrollManager() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [editing, setEditing] = useState<Salary | null>(null);

  const { data: staff = [] } = useQuery({
    queryKey: ["payroll-staff", schoolId],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles")
        .select("user_id, role").eq("school_id", schoolId!)
        .in("role", ["school_admin", "teacher", "accountant"]);
      if (!roles?.length) return [] as Staff[];
      const ids = [...new Set(roles.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase.from("profiles")
        .select("user_id, full_name").in("user_id", ids);
      const names = new Map((profiles ?? []).map((p: any) => [p.user_id, p.full_name]));
      return roles.reduce((acc: Staff[], r: any) => {
        if (!acc.some((s) => s.user_id === r.user_id)) {
          acc.push({ user_id: r.user_id, name: names.get(r.user_id) ?? "Staff member", role: r.role });
        }
        return acc;
      }, []);
    },
    enabled: !!schoolId,
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["salary-settings", schoolId],
    queryFn: async () => (await supabase.from("staff_salary_settings")
      .select("user_id, basic, allowances").eq("school_id", schoolId!)).data ?? [],
    enabled: !!schoolId,
  });

  const { data: salaries = [] } = useQuery({
    queryKey: ["staff-salaries", schoolId, month],
    queryFn: async () => (await supabase.from("staff_salaries")
      .select("id, user_id, month, payslip_no, basic, allowances, deductions, net, status, method, reference, notes")
      .eq("school_id", schoolId!).eq("month", `${month}-01`)
      .order("net", { ascending: false })).data ?? [],
    enabled: !!schoolId && !!month,
  });

  const names = useMemo(() => new Map(staff.map((s: Staff) => [s.user_id, s])), [staff]);
  const monthTotal = useMemo(() => salaries.reduce((s: number, r: Salary) => s + Number(r.net), 0), [salaries]);
  const paidTotal = useMemo(() => salaries.filter((r: Salary) => r.status === "paid").reduce((s: number, r) => s + Number(r.net), 0), [salaries]);

  const run = async () => {
    setBusy(true);
    try {
      const r = await runPayroll({ data: { school_id: schoolId!, month } });
      toast.success(r.created ? `Prepared ${r.created} salary record(s) for ${month}` : "Payroll already prepared for this month");
      qc.invalidateQueries({ queryKey: ["staff-salaries"] });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const release = async (row: Salary) => {
    try {
      await markSalaryPaid({ data: { salary_id: row.id, method: "bank_transfer" } });
      toast.success(`Salary released: ${row.payslip_no}`);
      qc.invalidateQueries({ queryKey: ["staff-salaries"] });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Monthly payroll</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" aria-label="Payroll month" />
            <Button size="sm" onClick={run} disabled={busy || !staff.length}><Play className="mr-2 h-4 w-4" />{busy ? "Working…" : "Run payroll"}</Button>
            <Button size="sm" variant="outline" onClick={() => setPrinting(true)} disabled={!salaries.length}><Printer className="mr-2 h-4 w-4" />Print paysheet</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Staff on payroll</p><p className="text-lg font-semibold">{salaries.length}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Total for {month}</p><p className="text-lg font-semibold">₦{monthTotal.toLocaleString()}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Already released</p><p className="text-lg font-semibold">₦{paidTotal.toLocaleString()}</p></div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Staff</TableHead><TableHead>Payslip</TableHead>
                <TableHead className="text-right">Basic</TableHead><TableHead className="text-right">Allowances</TableHead>
                <TableHead className="text-right">Deductions</TableHead><TableHead className="text-right">Net pay</TableHead>
                <TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {salaries.map((r: Salary) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{names.get(r.user_id)?.name ?? "Staff"} <span className="text-xs text-muted-foreground">({roleLabel(names.get(r.user_id)?.role ?? "")})</span></TableCell>
                    <TableCell className="font-mono text-xs">{r.payslip_no}</TableCell>
                    <TableCell className="text-right text-sm">₦{Number(r.basic).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm">₦{Number(r.allowances).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm">₦{Number(r.deductions).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">₦{Number(r.net).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={r.status === "paid" ? "secondary" : "outline"} className="capitalize">{r.status}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>Adjust</Button>
                      {r.status !== "paid" && <Button size="sm" variant="outline" onClick={() => release(r)}><Wallet className="mr-1 h-3 w-3" />Release</Button>}
                    </TableCell>
                  </TableRow>
                ))}
                {!salaries.length && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">
                    No salary records for {month}. Set each staff member's pay below, then press Run payroll.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <SalarySettings staff={staff} settings={settings} onSaved={() => qc.invalidateQueries({ queryKey: ["salary-settings"] })} />
      {editing && <DeductionDialog row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["staff-salaries"] }); }} />}
      {printing && <PaysheetPrint month={month} rows={salaries} names={names} total={monthTotal} onClose={() => setPrinting(false)} />}
    </div>
  );
}

function SalarySettings({ staff, settings, onSaved }: { staff: Staff[]; settings: { user_id: string; basic: number; allowances: number }[]; onSaved: () => void }) {
  const byUser = useMemo(() => new Map(settings.map((s) => [s.user_id, s])), [settings]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ user_id: "", basic: "", allowances: "" });
  const [busy, setBusy] = useState(false);
  const { schoolId } = useAuth();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveStaffSalary({ data: { school_id: schoolId!, user_id: form.user_id, basic: Number(form.basic), allowances: Number(form.allowances || 0) } });
      toast.success("Monthly pay saved");
      setOpen(false); setForm({ user_id: "", basic: "", allowances: "" }); onSaved();
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Staff monthly pay</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm">Set pay</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Monthly pay for a staff member</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div><Label htmlFor="pay_user">Staff member</Label>
                <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                  <SelectTrigger id="pay_user"><SelectValue placeholder="Choose staff" /></SelectTrigger>
                  <SelectContent>{staff.map((s) => <SelectItem key={s.user_id} value={s.user_id}>{s.name} ({roleLabel(s.role)})</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label htmlFor="pay_basic">Basic pay (₦)</Label><Input id="pay_basic" type="number" min="0" required value={form.basic} onChange={(e) => setForm({ ...form, basic: e.target.value })} /></div>
                <div><Label htmlFor="pay_allowances">Allowances (₦)</Label><Input id="pay_allowances" type="number" min="0" value={form.allowances} onChange={(e) => setForm({ ...form, allowances: e.target.value })} /></div>
              </div>
              <Button type="submit" className="w-full" disabled={!form.user_id || busy}>{busy ? "Saving…" : "Save"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Basic</TableHead><TableHead className="text-right">Allowances</TableHead><TableHead className="text-right">Monthly gross</TableHead></TableRow></TableHeader>
          <TableBody>
            {staff.map((s) => {
              const set = byUser.get(s.user_id);
              return (
                <TableRow key={s.user_id}>
                  <TableCell className="text-sm">{s.name}</TableCell>
                  <TableCell className="text-xs">{roleLabel(s.role)}</TableCell>
                  <TableCell className="text-right text-sm">{set ? `₦${Number(set.basic).toLocaleString()}` : <span className="text-muted-foreground">Not set</span>}</TableCell>
                  <TableCell className="text-right text-sm">{set ? `₦${Number(set.allowances).toLocaleString()}` : "—"}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{set ? `₦${(Number(set.basic) + Number(set.allowances)).toLocaleString()}` : "—"}</TableCell>
                </TableRow>
              );
            })}
            {!staff.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No staff accounts yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DeductionDialog({ row, onClose, onSaved }: { row: Salary; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ deductions: String(row.deductions), notes: row.notes ?? "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await setSalaryDeduction({ data: { salary_id: row.id, deductions: Number(form.deductions || 0), notes: form.notes || undefined } });
      toast.success("Salary adjusted"); onSaved();
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Adjust {row.payslip_no}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-muted-foreground">Gross: ₦{(Number(row.basic) + Number(row.allowances)).toLocaleString()}</p>
          <div><Label htmlFor="ded_amount">Deduction (₦)</Label><Input id="ded_amount" type="number" min="0" value={form.deductions} onChange={(e) => setForm({ ...form, deductions: e.target.value })} /></div>
          <div><Label htmlFor="ded_note">Reason / note</Label><Input id="ded_note" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save adjustment"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaysheetPrint({ month, rows, names, total, onClose }: { month: string; rows: Salary[]; names: Map<string, Staff>; total: number; onClose: () => void }) {
  const { schoolId } = useAuth();
  const { data: school } = useQuery({
    queryKey: ["paysheet-school", schoolId],
    queryFn: async () => (await supabase.from("schools").select("name, address").eq("id", schoolId!).maybeSingle()).data,
    enabled: !!schoolId,
  });
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
          <p className="mt-1 text-xs font-semibold uppercase">Salary paysheet — {month}</p>
        </div>
        <table className="mt-4 w-full border-collapse text-xs">
          <thead><tr className="border-b">
            <th className="py-1 text-left">Staff</th><th className="py-1 text-left">Payslip</th>
            <th className="py-1 text-right">Basic</th><th className="py-1 text-right">Allow.</th>
            <th className="py-1 text-right">Deduct.</th><th className="py-1 text-right">Net pay</th><th className="py-1 text-left">Status</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-1">{names.get(r.user_id)?.name ?? "Staff"}</td>
                <td className="py-1 font-mono">{r.payslip_no}</td>
                <td className="py-1 text-right">₦{Number(r.basic).toLocaleString()}</td>
                <td className="py-1 text-right">₦{Number(r.allowances).toLocaleString()}</td>
                <td className="py-1 text-right">₦{Number(r.deductions).toLocaleString()}</td>
                <td className="py-1 text-right font-semibold">₦{Number(r.net).toLocaleString()}</td>
                <td className="py-1 capitalize">{r.status}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="border-t-2"><td colSpan={5} className="py-2 text-right font-bold">Total payable</td>
            <td className="py-2 text-right font-bold">₦{total.toLocaleString()}</td><td></td></tr></tfoot>
        </table>
      </div>
    </div>
  );
}
