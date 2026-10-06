import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { BulkImportDialog } from "@/components/BulkImportDialog";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({ meta: [{ title: "Students — EduERP" }] }),
  component: StudentsPage,
});

function StudentsPage() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    admission_no: "", first_name: "", last_name: "", middle_name: "",
    gender: "male" as "male" | "female", dob: "", class_id: "",
    parent_name: "", parent_phone: "", parent_email: "",
  });

  const { data: students } = useQuery({
    queryKey: ["students", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, admission_no, first_name, last_name, gender, classes(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: classes } = useQuery({
    queryKey: ["classes-for-students", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return toast.error("Set up your school first");

    // Insert student
    const { data: student, error: sErr } = await supabase.from("students").insert({
      school_id: schoolId,
      admission_no: form.admission_no,
      first_name: form.first_name,
      last_name: form.last_name,
      middle_name: form.middle_name || null,
      gender: form.gender,
      dob: form.dob || null,
      class_id: form.class_id || null,
    }).select().single();
    if (sErr) return toast.error(sErr.message);

    // Auto-create + link parent
    if (form.parent_name && student) {
      const { data: parent, error: pErr } = await supabase.from("parents").insert({
        school_id: schoolId,
        full_name: form.parent_name,
        phone: form.parent_phone || null,
        email: form.parent_email || null,
      }).select().single();
      if (!pErr && parent) {
        await supabase.from("student_parents").insert({
          student_id: student.id,
          parent_id: parent.id,
          is_primary: true,
        });
      }
    }

    toast.success("Student admitted");
    setOpen(false);
    setForm({ admission_no: "", first_name: "", last_name: "", middle_name: "", gender: "male", dob: "", class_id: "", parent_name: "", parent_phone: "", parent_email: "" });
    qc.invalidateQueries({ queryKey: ["students"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="text-sm text-muted-foreground">Admit and manage students. Parents are auto-linked.</p>
        </div>
        <div className="flex flex-wrap gap-2">
        <BulkImportDialog schoolId={schoolId} classes={classes ?? []} onDone={() => qc.invalidateQueries({ queryKey: ["students"] })} />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><UserPlus className="mr-2 h-4 w-4" /> Admit student</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New student admission</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Admission No.</Label><Input required value={form.admission_no} onChange={(e) => setForm({ ...form, admission_no: e.target.value })} /></div>
                <div>
                  <Label>Gender</Label>
                  <Select value={form.gender} onValueChange={(v: any) => setForm({ ...form, gender: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>First name</Label><Input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
                <div><Label>Last name</Label><Input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
                <div><Label>Middle name</Label><Input value={form.middle_name} onChange={(e) => setForm({ ...form, middle_name: e.target.value })} /></div>
                <div><Label>Date of birth</Label><Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></div>
                <div className="col-span-2">
                  <Label>Class</Label>
                  <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Choose class" /></SelectTrigger>
                    <SelectContent>
                      {classes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted/40 p-3">
                <p className="mb-2 text-sm font-medium">Parent / Guardian</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label>Full name</Label><Input value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} /></div>
                  <div><Label>Phone</Label><Input value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} /></div>
                  <div><Label>Email</Label><Input type="email" value={form.parent_email} onChange={(e) => setForm({ ...form, parent_email: e.target.value })} /></div>
                </div>
              </div>
              <Button type="submit" className="w-full">Admit student</Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>All students</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Adm. No.</TableHead><TableHead>Name</TableHead>
                <TableHead>Gender</TableHead><TableHead>Class</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students?.length ? students.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-sm">{s.admission_no}</TableCell>
                  <TableCell className="font-medium">{s.first_name} {s.last_name}</TableCell>
                  <TableCell className="capitalize">{s.gender ?? "—"}</TableCell>
                  <TableCell>{s.classes?.name ?? "—"}</TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No students yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
