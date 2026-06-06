import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasRole } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileDown, Send } from "lucide-react";
import { publishReportCards } from "@/lib/api/results.functions";

export const Route = createFileRoute("/_authenticated/results")({
  head: () => ({ meta: [{ title: "Results — EduERP" }] }),
  component: ResultsPage,
});

function ResultsPage() {
  const { roles, schoolId } = useAuth();
  const qc = useQueryClient();
  const isStaff = hasRole(roles, "super_admin", "school_admin", "teacher");

  const [filters, setFilters] = useState({
    class_id: "", subject_id: "", session: "2025/2026", term: "first" as "first"|"second"|"third",
  });
  const [scores, setScores] = useState<Record<string, { ca1: number; ca2: number; exam: number }>>({});

  const { data: classes } = useQuery({
    queryKey: ["res-classes"],
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });
  const { data: subjects } = useQuery({
    queryKey: ["res-subjects", filters.class_id],
    queryFn: async () => {
      let q = supabase.from("subjects").select("id, name");
      if (filters.class_id) q = q.or(`class_id.eq.${filters.class_id},class_id.is.null`);
      return (await q.order("name")).data ?? [];
    },
  });

  const { data: students } = useQuery({
    queryKey: ["res-students", filters.class_id],
    enabled: !!filters.class_id,
    queryFn: async () => {
      const { data } = await supabase.from("students").select("id, admission_no, first_name, last_name").eq("class_id", filters.class_id).order("last_name");
      return data ?? [];
    },
  });

  const { data: existing } = useQuery({
    queryKey: ["assessments", filters],
    enabled: !!(filters.class_id && filters.subject_id),
    queryFn: async () => {
      const { data } = await supabase.from("assessments").select("*")
        .eq("class_id", filters.class_id).eq("subject_id", filters.subject_id)
        .eq("session", filters.session).eq("term", filters.term);
      const m: Record<string, any> = {};
      (data ?? []).forEach((a: any) => { m[a.student_id] = a; });
      return m;
    },
  });

  const saveScore = async (studentId: string) => {
    if (!schoolId) return toast.error("No school");
    const s = scores[studentId] ?? { ca1: 0, ca2: 0, exam: 0 };
    const { error } = await supabase.from("assessments").upsert({
      school_id: schoolId,
      student_id: studentId,
      subject_id: filters.subject_id,
      class_id: filters.class_id,
      session: filters.session,
      term: filters.term,
      ca1: s.ca1, ca2: s.ca2, exam: s.exam,
      status: "submitted",
    }, { onConflict: "student_id,subject_id,session,term" });
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["assessments"] });
  };

  // Student/parent view
  const { data: myResults } = useQuery({
    queryKey: ["my-results", filters.session, filters.term],
    enabled: !isStaff,
    queryFn: async () => {
      const { data } = await supabase.from("assessments")
        .select("*, subjects(name), students(first_name, last_name, admission_no)")
        .eq("session", filters.session).eq("term", filters.term)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const publish = useServerFn(publishReportCards);
  const publishMutation = useMutation({
    mutationFn: () =>
      publish({
        data: {
          class_id: filters.class_id,
          session: filters.session,
          term: filters.term,
        },
      }),
    onSuccess: (r) => {
      toast.success(`Published ${r.published} report card(s) for ${r.class_name}`);
      qc.invalidateQueries({ queryKey: ["report-cards-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isStaff) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Results</h1>
          <p className="text-sm text-muted-foreground">View your results per session and term.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Filter</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><Label>Session</Label><Input value={filters.session} onChange={(e) => setFilters({ ...filters, session: e.target.value })} /></div>
            <div>
              <Label>Term</Label>
              <Select value={filters.term} onValueChange={(v: any) => setFilters({ ...filters, term: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="first">First Term</SelectItem>
                  <SelectItem value="second">Second Term</SelectItem>
                  <SelectItem value="third">Third Term</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>My results</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Student</TableHead><TableHead>Subject</TableHead>
                <TableHead>CA1</TableHead><TableHead>CA2</TableHead><TableHead>Exam</TableHead>
                <TableHead>Total</TableHead><TableHead>Grade</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {myResults?.length ? myResults.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.students?.first_name} {r.students?.last_name}</TableCell>
                    <TableCell>{r.subjects?.name}</TableCell>
                    <TableCell>{r.ca1}</TableCell><TableCell>{r.ca2}</TableCell><TableCell>{r.exam}</TableCell>
                    <TableCell className="font-semibold">{r.total}</TableCell>
                    <TableCell><Badge>{r.grade}</Badge></TableCell>
                  </TableRow>
                )) : <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No results published yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  const publish = useServerFn(publishReportCards);
  const publishMutation = useMutation({
    mutationFn: () =>
      publish({
        data: {
          class_id: filters.class_id,
          session: filters.session,
          term: filters.term,
        },
      }),
    onSuccess: (r) => {
      toast.success(`Published ${r.published} report card(s) for ${r.class_name}`);
      qc.invalidateQueries({ queryKey: ["report-cards-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Results Entry</h1>
          <p className="text-sm text-muted-foreground">CA1 (max 20) · CA2 (max 20) · Exam (max 60). Grading is automatic.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/report-cards"><FileDown className="mr-2 h-4 w-4" /> Report cards</Link></Button>
          <Button
            disabled={!filters.class_id || publishMutation.isPending}
            onClick={() => publishMutation.mutate()}
          >
            <Send className="mr-2 h-4 w-4" /> {publishMutation.isPending ? "Publishing…" : "Publish class report cards"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Select</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <Label>Class</Label>
            <Select value={filters.class_id} onValueChange={(v) => setFilters({ ...filters, class_id: v })}>
              <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>{classes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Subject</Label>
            <Select value={filters.subject_id} onValueChange={(v) => setFilters({ ...filters, subject_id: v })}>
              <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>{subjects?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Session</Label><Input value={filters.session} onChange={(e) => setFilters({ ...filters, session: e.target.value })} /></div>
          <div>
            <Label>Term</Label>
            <Select value={filters.term} onValueChange={(v: any) => setFilters({ ...filters, term: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="first">First</SelectItem>
                <SelectItem value="second">Second</SelectItem>
                <SelectItem value="third">Third</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {filters.class_id && filters.subject_id && (
        <Card>
          <CardHeader><CardTitle>Scoresheet</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Adm. No.</TableHead><TableHead>Student</TableHead>
                <TableHead>CA1</TableHead><TableHead>CA2</TableHead><TableHead>Exam</TableHead>
                <TableHead>Total</TableHead><TableHead>Grade</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {students?.length ? students.map((st) => {
                  const ex = existing?.[st.id];
                  const cur = scores[st.id] ?? { ca1: ex?.ca1 ?? 0, ca2: ex?.ca2 ?? 0, exam: ex?.exam ?? 0 };
                  return (
                    <TableRow key={st.id}>
                      <TableCell className="font-mono text-xs">{st.admission_no}</TableCell>
                      <TableCell>{st.first_name} {st.last_name}</TableCell>
                      <TableCell><Input type="number" min={0} max={20} className="w-20" value={cur.ca1} onChange={(e) => setScores({ ...scores, [st.id]: { ...cur, ca1: +e.target.value } })} /></TableCell>
                      <TableCell><Input type="number" min={0} max={20} className="w-20" value={cur.ca2} onChange={(e) => setScores({ ...scores, [st.id]: { ...cur, ca2: +e.target.value } })} /></TableCell>
                      <TableCell><Input type="number" min={0} max={60} className="w-20" value={cur.exam} onChange={(e) => setScores({ ...scores, [st.id]: { ...cur, exam: +e.target.value } })} /></TableCell>
                      <TableCell className="font-semibold">{(cur.ca1 || 0) + (cur.ca2 || 0) + (cur.exam || 0)}</TableCell>
                      <TableCell>{ex?.grade ? <Badge>{ex.grade}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell><Button size="sm" onClick={() => saveScore(st.id)}>Save</Button></TableCell>
                    </TableRow>
                  );
                }) : <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No students in this class</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
