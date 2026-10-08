import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchool } from "@/hooks/useSchool";
import { saveScholarship, applyScholarships } from "@/lib/api/finance.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Wand2, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Award = {
  id: string; student_id: string; label: string; discount_type: string;
  discount_value: number; session: string; term: string | null; status: string;
};

const ANY_TERM = "any";

export function ScholarshipManager() {
  const { schoolId } = useAuth();
  const { school } = useSchool();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    student_id: "", label: "", discount_type: "percent", discount_value: "",
    session: "", term: ANY_TERM,
  });
  useEffect(() => {
    const current = school?.current_session;
    if (current) setForm((f) => (f.session ? f : { ...f, session: current }));
  }, [school?.current_session]);

  const { data: students = [] } = useQuery({
    queryKey: ["scholarship-students", schoolId],
    queryFn: async () => (await supabase.from("students")
      .select("id, first_name, last_name, admission_no, status")
      .eq("school_id", schoolId!).eq("status", "active")
      .order("first_name")).data ?? [],
    enabled: !!schoolId,
  });

  const { data: awards = [] } = useQuery({
    queryKey: ["student-scholarships", schoolId],
    queryFn: async () => (await supabase.from("student_scholarships")
      .select("id, student_id, label, discount_type, discount_value, session, term, status")
      .eq("school_id", schoolId!)
      .order("created_at", { ascending: false })).data ?? [],
    enabled: !!schoolId,
  });

  const studentName = useMemo(() => {
    const m = new Map(students.map((s: any) => [s.id, `${s.first_name} ${s.last_name} (${s.admission_no})`]));
    return (id: string) => m.get(id) ?? "Student";
  }, [students]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return;
    const session = form.session.trim() || school?.current_session || "";
    if (session.length < 3) return toast.error("Enter the session, e.g. 2025/2026");
    setBusy(true);
    try {
      const r = await saveScholarship({ data: {
        school_id: schoolId,
        student_id: form.student_id,
        label: form.label,
        discount_type: form.discount_type as "percent" | "flat",
        discount_value: Number(form.discount_value),
        session,
        term: form.term === ANY_TERM ? null : form.term as any,
      } });
      toast.success(r.applied.applied
        ? `Scholarship saved and applied to ${r.applied.applied} invoice(s)`
        : "Scholarship saved. It will apply to new invoices.");
      setOpen(false);
      setForm({ ...form, student_id: "", label: "", discount_value: "" });
      qc.invalidateQueries({ queryKey: ["student-scholarships"] });
      qc.invalidateQueries({ queryKey: ["fee-invoices"] });
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };

  const applyNow = async () => {
    setBusy(true);
    try {
      const r = await applyScholarships({ data: {
        school_id: schoolId,
        session: form.session || school?.current_session || "",
        term: form.term === ANY_TERM ? null : form.term as any,
      } });
      toast.success(r.applied ? `Discount added to ${r.applied} invoice(s)` : "No new invoices needed a discount");
      qc.invalidateQueries({ queryKey: ["fee-invoices"] });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const stop = async (row: Award) => {
    const next = row.status === "active" ? "stopped" : "active";
    const { error } = await supabase.from("student_scholarships").update({ status: next } as never).eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success(next === "active" ? "Scholarship resumed" : "Scholarship stopped");
    qc.invalidateQueries({ queryKey: ["student-scholarships"] });
  };

  const remove = async (row: Award) => {
    if (!window.confirm(`Remove "${row.label}"? Invoices already discounted stay as they are.`)) return;
    const { error } = await supabase.from("student_scholarships").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Scholarship removed");
    qc.invalidateQueries({ queryKey: ["student-scholarships"] });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          A standing discount for a student — scholarship, bursary, staff child or sibling waiver.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={applyNow} disabled={busy || !awards.length}>
            <Wand2 className="mr-2 h-4 w-4" />Apply to current invoices
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />New scholarship</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Give a student a scholarship</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                <div><Label>Student</Label>
                  <Select value={form.student_id} onValueChange={(v) => setForm({ ...form, student_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Choose a student" /></SelectTrigger>
                    <SelectContent>{students.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.admission_no})</SelectItem>
                    ))}</SelectContent>
                  </Select></div>
                <div><Label>Name of the award</Label>
                  <Input required placeholder="e.g. Staff child discount" value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Discount type</Label>
                    <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">Percentage of fee</SelectItem>
                        <SelectItem value="flat">Fixed amount (₦)</SelectItem>
                      </SelectContent>
                    </Select></div>
                  <div><Label>{form.discount_type === "percent" ? "Percent (%)" : "Amount (₦)"}</Label>
                    <Input type="number" min="1" required value={form.discount_value}
                      onChange={(e) => setForm({ ...form, discount_value: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Session</Label>
                    <Input required placeholder="2025/2026" value={form.session}
                      onChange={(e) => setForm({ ...form, session: e.target.value })} /></div>
                  <div><Label>Term</Label>
                    <Select value={form.term} onValueChange={(v) => setForm({ ...form, term: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ANY_TERM}>All terms</SelectItem>
                        <SelectItem value="first">First term</SelectItem>
                        <SelectItem value="second">Second term</SelectItem>
                        <SelectItem value="third">Third term</SelectItem>
                      </SelectContent>
                    </Select></div>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save scholarship"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Scholarships on file</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Student</TableHead><TableHead>Award</TableHead><TableHead>Discount</TableHead>
                <TableHead>Session / term</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {awards.map((a: Award) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm">{studentName(a.student_id)}</TableCell>
                    <TableCell className="text-sm">{a.label}</TableCell>
                    <TableCell className="text-sm">{a.discount_type === "percent" ? `${a.discount_value}%` : `₦${Number(a.discount_value).toLocaleString()}`}</TableCell>
                    <TableCell className="text-xs capitalize">{a.session} • {a.term ?? "all terms"}</TableCell>
                    <TableCell><Badge variant={a.status === "active" ? "secondary" : "outline"} className="capitalize">{a.status}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => stop(a)}>{a.status === "active" ? "Stop" : "Resume"}</Button>
                      <Button size="icon" variant="ghost" aria-label="Remove scholarship" onClick={() => remove(a)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!awards.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No scholarships yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
