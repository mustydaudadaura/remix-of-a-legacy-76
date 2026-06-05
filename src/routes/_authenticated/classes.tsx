import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/classes")({
  head: () => ({ meta: [{ title: "Classes & Subjects — EduERP" }] }),
  component: ClassesPage,
});

function ClassesPage() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const [cls, setCls] = useState<{ name: string; level: string; arm: string; section: "nursery" | "primary" | "secondary" | "" }>({ name: "", level: "", arm: "", section: "" });
  const [sub, setSub] = useState({ name: "", code: "", class_id: "" });

  const { data: classes } = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: subjects } = useQuery({
    queryKey: ["subjects", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("*, classes(name)").order("name");
      if (error) throw error;
      return data;
    },
  });

  const addClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return toast.error("Set up your school first");
    const { error } = await supabase.from("classes").insert({
      name: cls.name, level: cls.level || null, arm: cls.arm || null,
      section: cls.section || null, school_id: schoolId,
    });
    if (error) return toast.error(error.message);
    toast.success("Class created");
    setCls({ name: "", level: "", arm: "", section: "" });
    qc.invalidateQueries({ queryKey: ["classes"] });
  };

  const addSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return toast.error("Set up your school first");
    const { error } = await supabase.from("subjects").insert({
      school_id: schoolId, name: sub.name, code: sub.code || null,
      class_id: sub.class_id || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Subject added");
    setSub({ name: "", code: "", class_id: "" });
    qc.invalidateQueries({ queryKey: ["subjects"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Classes & Subjects</h1>
        <p className="text-sm text-muted-foreground">Organize your school structure.</p>
      </div>

      <Tabs defaultValue="classes">
        <TabsList>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
        </TabsList>

        <TabsContent value="classes" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Add class</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={addClass} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div><Label>Name</Label><Input required placeholder="JSS 1A" value={cls.name} onChange={(e) => setCls({ ...cls, name: e.target.value })} /></div>
                <div><Label>Level</Label><Input placeholder="JSS" value={cls.level} onChange={(e) => setCls({ ...cls, level: e.target.value })} /></div>
                <div><Label>Arm</Label><Input placeholder="A" value={cls.arm} onChange={(e) => setCls({ ...cls, arm: e.target.value })} /></div>
                <div className="flex items-end"><Button type="submit" className="w-full">Add</Button></div>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Level</TableHead><TableHead>Arm</TableHead></TableRow></TableHeader>
                <TableBody>
                  {classes?.length ? classes.map((c) => (
                    <TableRow key={c.id}><TableCell className="font-medium">{c.name}</TableCell><TableCell>{c.level ?? "—"}</TableCell><TableCell>{c.arm ?? "—"}</TableCell></TableRow>
                  )) : <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No classes yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subjects" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Add subject</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={addSubject} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div><Label>Name</Label><Input required placeholder="Mathematics" value={sub.name} onChange={(e) => setSub({ ...sub, name: e.target.value })} /></div>
                <div><Label>Code</Label><Input placeholder="MTH" value={sub.code} onChange={(e) => setSub({ ...sub, code: e.target.value })} /></div>
                <div>
                  <Label>Class (optional)</Label>
                  <Select value={sub.class_id} onValueChange={(v) => setSub({ ...sub, class_id: v })}>
                    <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
                    <SelectContent>
                      {classes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end"><Button type="submit" className="w-full">Add</Button></div>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Class</TableHead></TableRow></TableHeader>
                <TableBody>
                  {subjects?.length ? subjects.map((s: any) => (
                    <TableRow key={s.id}><TableCell className="font-medium">{s.name}</TableCell><TableCell>{s.code ?? "—"}</TableCell><TableCell>{s.classes?.name ?? "All"}</TableCell></TableRow>
                  )) : <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No subjects yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
