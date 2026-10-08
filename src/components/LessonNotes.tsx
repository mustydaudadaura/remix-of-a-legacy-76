import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { marked } from "marked";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolAccess } from "@/hooks/useSchoolAccess";
import { generateLessonNote } from "@/lib/api/lesson-notes.functions";
import { LessonPlanDocument, printLessonPlan } from "@/components/LessonPlanDocument";
import type { LessonHeader, LessonPlan } from "@/lib/lesson-plan";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Printer, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Item = { id: string; name: string; class_id?: string | null };
type Doc = { id?: string; header: LessonHeader; plan: LessonPlan };

function mondayOf(d = new Date()) {
  const x = new Date(d); const day = x.getDay() || 7; x.setDate(x.getDate() - day + 1);
  return x.toISOString().slice(0, 10);
}

export function LessonNotes({ schoolId, classes, subjects }: { schoolId: string; classes: Item[]; subjects: Item[] }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { can } = useSchoolAccess();
  const isAdmin = can("academics.edit");
  const [f, setF] = useState({ cls: "", subject: "", topic: "", week: "1", weekStart: mondayOf(), extra: "" });
  const [doc, setDoc] = useState<Doc | null>(null);
  const [legacy, setLegacy] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const { data: saved } = useQuery({
    queryKey: ["lesson-notes", schoolId],
    queryFn: async () => {
      const rows = (await supabase.from("lesson_notes").select("id,topic,week,term,content,plan,header,status,created_by,class_id,subject_id,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100)).data ?? [];
      const ids = [...new Set(rows.map((r) => r.created_by))];
      const profs = ids.length ? (await supabase.from("profiles").select("user_id,full_name").in("user_id", ids)).data ?? [] : [];
      return rows.map((r) => ({ ...r, teacher: profs.find((p) => p.user_id === r.created_by)?.full_name ?? "Teacher" }));
    },
  });

  const generate = async () => {
    if (!f.cls || !f.subject) return toast.error("Choose class and subject");
    if (f.topic.trim().length < 2) return toast.error("Enter a topic");
    setBusy(true);
    try {
      const r = await generateLessonNote({ data: { school_id: schoolId, class_id: f.cls, subject_id: f.subject, topic: f.topic, week: Number(f.week), week_start: f.weekStart, extra: f.extra || undefined } });
      setDoc(r); setLegacy(""); toast.success("Lesson plan ready — review before use");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const save = async () => {
    if (!doc) return;
    const { error } = await supabase.from("lesson_notes").insert({
      school_id: schoolId, class_id: f.cls, subject_id: f.subject, topic: doc.header.topic, week: doc.header.week,
      term: ({ "1ST": "first", "2ND": "second", "3RD": "third" } as const)[doc.header.term as "1ST"] ?? null,
      lesson_date: f.weekStart, content: doc.plan.lesson_note || doc.header.topic, plan: doc.plan as any, header: doc.header as any,
      status: "submitted", created_by: user!.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Lesson plan submitted to the school admin"); qc.invalidateQueries({ queryKey: ["lesson-notes"] });
  };
  const approve = async (id: string) => { const { error } = await supabase.from("lesson_notes").update({ status: "approved" }).eq("id", id); if (error) toast.error(error.message); else { toast.success("Approved"); qc.invalidateQueries({ queryKey: ["lesson-notes"] }); } };
  const remove = async (id: string) => { await supabase.from("lesson_notes").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["lesson-notes"] }); };
  const print = (d: Doc) => { if (!printLessonPlan(d.header, d.plan)) toast.error("Allow pop-ups to print"); };

  const sel = (label: string, value: string, key: keyof typeof f, items: { id: string; name: string }[]) => (
    <div><Label>{label}</Label>
      <Select value={value || undefined} onValueChange={(v) => setF({ ...f, [key]: v })}>
        <SelectTrigger><SelectValue placeholder={`Choose ${label.toLowerCase()}`} /></SelectTrigger>
        <SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
      </Select></div>
  );

  return (
    <div className="space-y-4">
      <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> AI lesson plan generator</CardTitle>
        <p className="text-sm text-muted-foreground">Just pick the class and subject and type the topic. School name, session, term, timetable periods and time, class size, ages and sex are filled in automatically.</p></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {sel("Class", f.cls, "cls", classes)}
          {sel("Subject", f.subject, "subject", subjects.filter((s) => !s.class_id || !f.cls || s.class_id === f.cls))}
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Week</Label><Input type="number" min={1} max={15} value={f.week} onChange={(e) => setF({ ...f, week: e.target.value })} /></div>
            <div><Label>Week starts</Label><Input type="date" value={f.weekStart} onChange={(e) => setF({ ...f, weekStart: e.target.value })} /></div>
          </div>
          <div className="sm:col-span-3"><Label>Topic</Label><Input value={f.topic} maxLength={200} placeholder="e.g. Electoral crisis in Nigeria" onChange={(e) => setF({ ...f, topic: e.target.value })} /></div>
          <div className="sm:col-span-3"><Label>Extra notes (optional)</Label><Textarea value={f.extra} maxLength={1000} placeholder="Sub-topics you want covered, materials available…" onChange={(e) => setF({ ...f, extra: e.target.value })} /></div>
          <div className="sm:col-span-3"><Button onClick={generate} disabled={busy}><Sparkles className="mr-2 h-4 w-4" />{busy ? "Writing lesson plan… (up to a minute)" : "Generate lesson plan"}</Button></div>
        </CardContent></Card>

      {doc && (
        <Card><CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            {!doc.id && <Button onClick={save}>Save & submit</Button>}
            <Button variant="outline" onClick={() => print(doc)}><Printer className="mr-2 h-4 w-4" />Print / PDF</Button>
          </div>
          <LessonPlanDocument header={doc.header} plan={doc.plan} />
        </CardContent></Card>
      )}
      {legacy && <Card><CardContent className="lesson-note p-4 text-sm" dangerouslySetInnerHTML={{ __html: marked.parse(legacy.replace(/</g, "&lt;"), { async: false }) as string }} /></Card>}

      <Card><CardHeader className="pb-2"><CardTitle className="text-base">{isAdmin ? "All teachers' lesson plans" : "My lesson plans"}</CardTitle></CardHeader>
        <CardContent className="divide-y p-0">
          {!saved?.length && <p className="p-4 text-sm text-muted-foreground">No saved lesson plans yet.</p>}
          {saved?.map((n) => {
            const d = n.plan && n.header ? { id: n.id, header: n.header as unknown as LessonHeader, plan: n.plan as unknown as LessonPlan } : null;
            return (
              <div key={n.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <button className="min-w-0 text-left" onClick={() => { if (d) { setDoc(d); setLegacy(""); } else { setDoc(null); setLegacy(n.content); } window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                  <p className="truncate font-medium">{n.topic} <Badge variant={n.status === "approved" ? "default" : "secondary"} className="ml-1">{n.status}</Badge></p>
                  <p className="truncate text-muted-foreground">{n.teacher} · {classes.find((c) => c.id === n.class_id)?.name ?? ""} {subjects.find((s) => s.id === n.subject_id)?.name ?? ""} · week {n.week}</p>
                </button>
                <div className="flex shrink-0">
                  {isAdmin && n.status !== "approved" && <Button size="icon" variant="ghost" aria-label="Approve" onClick={() => approve(n.id)}><CheckCircle2 className="h-4 w-4" /></Button>}
                  {d && <Button size="icon" variant="ghost" aria-label="Print" onClick={() => print(d)}><Printer className="h-4 w-4" /></Button>}
                  <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => remove(n.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            );
          })}
        </CardContent></Card>
    </div>
  );
}
