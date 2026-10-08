import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { marked } from "marked";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolAccess } from "@/hooks/useSchoolAccess";
import { generateLessonNote } from "@/lib/api/lesson-notes.functions";
import { LessonPlanDocument, printLessonPlan } from "@/components/LessonPlanDocument";
import { LessonPlanEditor } from "@/components/LessonPlanEditor";
import type { LessonHeader, LessonPlan } from "@/lib/lesson-plan";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Printer, Trash2, Pencil, Eye, MessageSquare } from "lucide-react";
import { toast } from "sonner";

type Item = { id: string; name: string; class_id?: string | null };
type Review = { status: string; created_by: string; teacher: string; review_score: number | null; review_remark: string | null; reviewed_at: string | null; teacher_reply: string | null; acknowledged_at: string | null; class_id: string | null; subject_id: string | null; lesson_date: string | null };
type Doc = { id?: string; header: LessonHeader; plan: LessonPlan; meta?: Review };
const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "outline" }, submitted: { label: "Awaiting review", variant: "secondary" },
  needs_revision: { label: "Returned for correction", variant: "destructive" }, approved: { label: "Approved", variant: "default" },
};

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
  const [editing, setEditing] = useState(false);
  const [rv, setRv] = useState({ score: "", remark: "", reply: "" });
  const open = (d: Doc | null) => { setDoc(d); setEditing(false); setRv({ score: d?.meta?.review_score?.toString() ?? "", remark: d?.meta?.review_remark ?? "", reply: d?.meta?.teacher_reply ?? "" }); };
  const refresh = () => qc.invalidateQueries({ queryKey: ["lesson-notes"] });

  const { data: saved } = useQuery({
    queryKey: ["lesson-notes", schoolId],
    queryFn: async () => {
      const rows = (await supabase.from("lesson_notes").select("id,topic,week,term,content,plan,header,status,created_by,class_id,subject_id,created_at,lesson_date,review_score,review_remark,reviewed_at,teacher_reply,acknowledged_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100)).data ?? [];
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
      open(r); setEditing(true); setLegacy(""); toast.success("Lesson plan ready — edit anything you want, then submit");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const save = async (status: "draft" | "submitted") => {
    if (!doc) return;
    const body = { topic: doc.header.topic, content: doc.plan.lesson_note || doc.header.topic, plan: doc.plan as any, header: doc.header as any, status };
    const { data: row, error } = doc.id
      ? await supabase.from("lesson_notes").update(body).eq("id", doc.id).select("id").single()
      : await supabase.from("lesson_notes").insert({ ...body, school_id: schoolId, class_id: f.cls, subject_id: f.subject, week: doc.header.week,
          term: ({ "1ST": "first", "2ND": "second", "3RD": "third" } as const)[doc.header.term as "1ST"] ?? null, lesson_date: f.weekStart, created_by: user!.id }).select("id").single();
    if (error) return toast.error(error.message);
    setDoc({ ...doc, id: row.id, meta: { ...(doc.meta ?? { created_by: user!.id, teacher: "", review_score: null, review_remark: null, reviewed_at: null, teacher_reply: null, acknowledged_at: null, class_id: f.cls, subject_id: f.subject, lesson_date: f.weekStart }), status } });
    setEditing(false);
    toast.success(status === "submitted" ? "Lesson plan submitted to the school admin" : "Draft saved"); refresh();
  };
  const review = async (status: "approved" | "needs_revision") => {
    if (!doc?.id) return;
    const score = rv.score === "" ? null : Number(rv.score);
    if (score !== null && (isNaN(score) || score < 0 || score > 100)) return toast.error("Score must be between 0 and 100");
    if (status === "needs_revision" && !rv.remark.trim()) return toast.error("Write a remark telling the teacher what to correct");
    const { error } = await supabase.from("lesson_notes").update({ status, review_score: score, review_remark: rv.remark.trim() || null }).eq("id", doc.id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Lesson plan approved" : "Returned to the teacher"); setDoc(null); refresh();
  };
  const acknowledge = async () => {
    if (!doc?.id) return;
    const { error } = await supabase.from("lesson_notes").update({ teacher_reply: rv.reply.trim() || null, acknowledged_at: new Date().toISOString() }).eq("id", doc.id);
    if (error) return toast.error(error.message);
    toast.success("Remark acknowledged"); setDoc({ ...doc, meta: { ...doc.meta!, teacher_reply: rv.reply.trim() || null, acknowledged_at: new Date().toISOString() } }); refresh();
  };
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

      {doc && (() => {
        const m = doc.meta; const mine = !m || m.created_by === user?.id; const st = m?.status ?? "new";
        const canEditDoc = mine && st !== "approved";
        return (
        <Card><CardContent className="space-y-3 p-4">
          {m && <div className="flex flex-wrap items-center gap-2 text-sm"><Badge variant={STATUS[st]?.variant ?? "secondary"}>{STATUS[st]?.label ?? st}</Badge>{!mine && <span className="text-muted-foreground">by {m.teacher}</span>}{m.review_score != null && <span className="font-medium">Score: {m.review_score}/100</span>}</div>}
          <div className="flex flex-wrap gap-2">
            {canEditDoc && <Button variant="outline" onClick={() => setEditing(!editing)}>{editing ? <><Eye className="mr-2 h-4 w-4" />Preview</> : <><Pencil className="mr-2 h-4 w-4" />Edit plan & note</>}</Button>}
            {canEditDoc && <Button variant="outline" onClick={() => save("draft")}>Save draft</Button>}
            {canEditDoc && <Button onClick={() => save("submitted")}>{st === "needs_revision" || st === "submitted" ? "Resubmit for review" : "Submit for review"}</Button>}
            <Button variant="outline" onClick={() => print(doc)}><Printer className="mr-2 h-4 w-4" />Print / PDF</Button>
          </div>
          {m?.review_remark && (
            <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
              <p className="flex items-center gap-1 font-semibold"><MessageSquare className="h-4 w-4" />Administrator's remark</p>
              <p className="whitespace-pre-wrap">{m.review_remark}</p>
              {m.acknowledged_at ? <p className="text-muted-foreground">Acknowledged by teacher {new Date(m.acknowledged_at).toLocaleDateString("en-GB")}{m.teacher_reply ? ` — "${m.teacher_reply}"` : ""}</p>
                : mine ? (
                  <div className="space-y-2"><Label>Your reply (optional)</Label><Textarea value={rv.reply} maxLength={1000} onChange={(e) => setRv({ ...rv, reply: e.target.value })} placeholder="e.g. Noted, I have added more evaluation questions" />
                    <Button size="sm" onClick={acknowledge}>Acknowledge remark</Button></div>
                ) : <p className="text-muted-foreground">Teacher has not acknowledged yet.</p>}
            </div>
          )}
          {isAdmin && !mine && m && st !== "draft" && (
            <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-4">
              <p className="font-semibold sm:col-span-4">Assess this lesson plan</p>
              <div><Label>Score (out of 100)</Label><Input type="number" min={0} max={100} value={rv.score} onChange={(e) => setRv({ ...rv, score: e.target.value })} /></div>
              <div className="sm:col-span-3"><Label>Remark / comment to teacher</Label><Textarea value={rv.remark} maxLength={2000} onChange={(e) => setRv({ ...rv, remark: e.target.value })} /></div>
              <div className="flex flex-wrap gap-2 sm:col-span-4"><Button onClick={() => review("approved")}>Approve</Button><Button variant="outline" onClick={() => review("needs_revision")}>Return for correction</Button></div>
            </div>
          )}
          {editing && canEditDoc ? <LessonPlanEditor header={doc.header} plan={doc.plan} onChange={(header, plan) => setDoc({ ...doc, header, plan })} /> : <LessonPlanDocument header={doc.header} plan={doc.plan} />}
        </CardContent></Card>
        );
      })()}
      {legacy && <Card><CardContent className="lesson-note p-4 text-sm" dangerouslySetInnerHTML={{ __html: marked.parse(legacy.replace(/</g, "&lt;"), { async: false }) as string }} /></Card>}

      <Card><CardHeader className="pb-2"><CardTitle className="text-base">{isAdmin ? "All teachers' lesson plans" : "My lesson plans"}</CardTitle></CardHeader>
        <CardContent className="divide-y p-0">
          {!saved?.length && <p className="p-4 text-sm text-muted-foreground">No saved lesson plans yet.</p>}
          {saved?.map((n) => {
            const d: Doc | null = n.plan && n.header ? { id: n.id, header: n.header as unknown as LessonHeader, plan: n.plan as unknown as LessonPlan, meta: n as unknown as Review } : null;
            return (
              <div key={n.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <button className="min-w-0 text-left" onClick={() => { if (d) { open(d); setLegacy(""); if (d.meta?.class_id) setF((x) => ({ ...x, cls: d.meta!.class_id!, subject: d.meta!.subject_id ?? x.subject })); } else { open(null); setLegacy(n.content); } window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                  <p className="truncate font-medium">{n.topic} <Badge variant={STATUS[n.status]?.variant ?? "secondary"} className="ml-1">{STATUS[n.status]?.label ?? n.status}</Badge>{n.review_score != null && <span className="ml-1 text-xs text-muted-foreground">{n.review_score}/100</span>}{n.review_remark && !n.acknowledged_at && <span className="ml-1 text-xs text-destructive">• remark</span>}</p>
                  <p className="truncate text-muted-foreground">{n.teacher} · {classes.find((c) => c.id === n.class_id)?.name ?? ""} {subjects.find((s) => s.id === n.subject_id)?.name ?? ""} · week {n.week}</p>
                </button>
                <div className="flex shrink-0">
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
