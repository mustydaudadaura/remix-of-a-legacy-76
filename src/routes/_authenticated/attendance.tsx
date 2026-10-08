import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { markAttendance } from "@/lib/api/attendance.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "Attendance — EduERP" }, { name: "description", content: "Attendance for authorized school accounts and families in EduERP." }, { property: "og:title", content: "Attendance — EduERP" }, { property: "og:description", content: "Attendance for authorized school accounts and families in EduERP." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

const STATUSES = ["present", "absent", "late", "excused"] as const;

function Page() {
  const [classId, setClassId] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<Record<string, (typeof STATUSES)[number]>>({});
  const [saving, setSaving] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ["att-classes"],
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });
  const { data: students } = useQuery({
    queryKey: ["att-students", classId],
    queryFn: async () => (await supabase.from("students").select("id, first_name, last_name, admission_no").eq("class_id", classId).order("first_name")).data ?? [],
    enabled: !!classId,
  });
  const { data: existing } = useQuery({
    queryKey: ["att-existing", classId, date],
    queryFn: async () => (await supabase.from("attendance").select("student_id, status").eq("class_id", classId).eq("date", date)).data ?? [],
    enabled: !!classId,
  });

  const getStatus = (sid: string): (typeof STATUSES)[number] => entries[sid] ?? (existing?.find((e: any) => e.student_id === sid)?.status as any) ?? "present";

  const save = async () => {
    if (!classId || !students?.length) return;
    setSaving(true);
    try {
      const payload = students.map((s: any) => ({ student_id: s.id, status: getStatus(s.id) }));
      const res = await markAttendance({ data: { class_id: classId, date, entries: payload } });
      toast.success(`Saved ${res.count} entries`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Attendance</h1>
        <p className="text-sm text-muted-foreground">Mark daily attendance per class.</p>
      </div>
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          <div>
            <Label>Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="Choose class" /></SelectTrigger>
              <SelectContent>{(classes ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button className="w-full" disabled={!classId || !students?.length || saving} onClick={save}>{saving ? "Saving…" : "Save attendance"}</Button>
          </div>
        </CardContent>
      </Card>

      {classId && (
        <Card>
          <CardHeader><CardTitle className="text-base">Roster</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(students ?? []).length === 0 && <p className="text-sm text-muted-foreground">No students in this class.</p>}
            {(students ?? []).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between gap-2 border-b py-2 last:border-0">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{s.first_name} {s.last_name}</div>
                  <div className="text-xs text-muted-foreground">{s.admission_no}</div>
                </div>
                <Select value={getStatus(s.id)} onValueChange={(v: any) => setEntries((p) => ({ ...p, [s.id]: v }))}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((st) => <SelectItem key={st} value={st} className="capitalize">{st}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
