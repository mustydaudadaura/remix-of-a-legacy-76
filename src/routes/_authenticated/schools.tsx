import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/schools")({
  head: () => ({ meta: [{ title: "Schools — EduERP" }] }),
  component: SchoolsPage,
});

function SchoolsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", address: "", phone: "", email: "", motto: "", current_session: "2025/2026" });

  const { data: schools, isLoading } = useQuery({
    queryKey: ["schools"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("schools").insert(form);
    if (error) return toast.error(error.message);
    toast.success("School created");
    setOpen(false);
    setForm({ name: "", code: "", address: "", phone: "", email: "", motto: "", current_session: "2025/2026" });
    qc.invalidateQueries({ queryKey: ["schools"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schools</h1>
          <p className="text-sm text-muted-foreground">Manage all schools on the platform.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New school</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create school</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Code</Label><Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>
                <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                <div className="col-span-2"><Label>Motto</Label><Input value={form.motto} onChange={(e) => setForm({ ...form, motto: e.target.value })} /></div>
                <div><Label>Session</Label><Input value={form.current_session} onChange={(e) => setForm({ ...form, current_session: e.target.value })} /></div>
              </div>
              <Button type="submit" className="w-full">Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>All schools</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Loading…</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Code</TableHead>
                  <TableHead>Session</TableHead><TableHead>Phone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schools?.length ? schools.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.code}</TableCell>
                    <TableCell>{s.current_session ?? "—"}</TableCell>
                    <TableCell>{s.phone ?? "—"}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No schools yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
