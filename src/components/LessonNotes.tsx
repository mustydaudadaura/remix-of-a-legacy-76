import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { marked } from "marked";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { generateLessonNote } from "@/lib/api/lesson-notes.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Item = { id: string; name: string; class_id?: string | null };

const escape = (t: string) => t.replace(/</g, "&lt;");
const toHtml = (md: string) => marked.parse(escape(md), { async: false }) as string;

function printNote(title: string, md: string) {
  const w = window.open("", "_blank");
  if (!w) return toast.error("Allow pop-ups to print");
  w.document.write(`<html><head><title>${escape(title)}</title><style>body{font-family:"Source Sans 3",Arial,sans-serif;padding:24px;line-height:1.5}table{border-collapse:collapse;width:100%;margin:8px 0}td,th{border:1px solid #444;padding:6px;text-align:left;vertical-align:top}h2{border-bottom:2px solid #333}</style></head><body>${toHtml(md)}</body></html>`);
  w.document.close(); w.focus(); w.print();
}

export function LessonNotes({ schoolId, classes, subjects }: { schoolId: string; classes: Item[]; subjects: Item[] }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [f, setF] = useState({ cls: "", subject: "", topic: "", term: "first", week: "1", duration: "40", extra: "" });
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: saved } = useQuery({ queryKey: ["lesson-notes", schoolId], queryFn: async () => (await supabase.from("lesson_notes").select("id,topic,week,term,content,class_id,subject_id,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(50)).data ?? [] });

  const generate = async () => {
    if (f.topic.trim().length < 2) return toast.error("Enter a topic");
    setBusy(true);
    try {
      const r = await generateLessonNote({ data: { school_id: schoolId, class_id: f.cls || null, subject_id: f.subject || null, topic: f.topic, term: f.term as "first", week: Number(f.week), duration_minutes: Number(f.duration), extra: f.extra || undefined } });
      setContent(r.content); setEditing(false); toast.success("Lesson note ready — review before use");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const save = async () => {
    const { error } = await supabase.from("lesson_notes").insert({ school_id: schoolId, class_id: f.cls || null, subject_id: f.subject || null, topic: f.topic.trim(), term: f.term as "first", week: Number(f.week), duration_minutes: Number(f.duration), content, created_by: user!.id });
    if (error) return toast.error(error.message);
    toast.success("Lesson note saved"); qc.invalidateQueries({ queryKey: ["lesson-notes"] });
  };
  const remove = async (id: string) => { await supabase.from("lesson_notes").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["lesson-notes"] }); };
  const sel = (label: string, value: string, key: keyof typeof f, items: { id: string; name: string }[]) => (
    <div><Label>{label}</Label>
      <Select value={value || undefined} onValueChange={(v) => setF({ ...f, [key]: v })}>
        <SelectTrigger><SelectValue placeholder={`Choose ${label.toLowerCase()}`} /></SelectTrigger>
        <SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
      </Select></div>
  );

  return (
    <div className="space-y-4">
      <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> AI lesson plan & note generator</CardTitle>
        <p className="text-sm text-muted-foreground">Follows the NERDC curriculum format: objectives, materials, set induction, step-by-step presentation, evaluation, summary, assignment and full lesson note.</p></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {sel("Class", f.cls, "cls", classes)}
          {sel("Subject", f.subject, "subject", subjects.filter((s) => !s.class_id || !f.cls || s.class_id === f.cls))}
          {sel("Term", f.term, "term", [{ id: "first", name: "First term" }, { id: "second", name: "Second term" }, { id: "third", name: "Third term" }])}
          <div className="sm:col-span-2"><Label>Topic</Label><Input value={f.topic} maxLength={200} placeholder="e.g. Addition of fractions" onChange={(e) => setF({ ...f, topic: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Week</Label><Input type="number" min={1} max={15} value={f.week} onChange={(e) => setF({ ...f, week: e.target.value })} /></div>
            <div><Label>Minutes</Label><Input type="number" min={10} max={240} value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} /></div>
          </div>
          <div className="sm:col-span-3"><Label>Extra notes (optional)</Label><Textarea value={f.extra} maxLength={1000} placeholder="Sub-topic, learners' level, materials available…" onChange={(e) => setF({ ...f, extra: e.target.value })} /></div>
          <div className="sm:col-span-3"><Button onClick={generate} disabled={busy}><Sparkles className="mr-2 h-4 w-4" />{busy ? "Writing lesson note… (up to a minute)" : "Generate lesson note"}</Button></div>
        </CardContent></Card>

      {content && (
        <Card><CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={save}>Save</Button>
            <Button variant="outline" onClick={() => setEditing(!editing)}>{editing ? "Preview" : "Edit"}</Button>
            <Button variant="outline" onClick={() => printNote(f.topic, content)}><Printer className="mr-2 h-4 w-4" />Print / PDF</Button>
          </div>
          {editing ? <Textarea className="min-h-[60vh] font-mono text-xs" value={content} onChange={(e) => setContent(e.target.value)} />
            : <div className="lesson-note overflow-x-auto text-sm" dangerouslySetInnerHTML={{ __html: toHtml(content) }} />}
        </CardContent></Card>
      )}

      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Saved lesson notes</CardTitle></CardHeader>
        <CardContent className="divide-y p-0">
          {!saved?.length && <p className="p-4 text-sm text-muted-foreground">No saved notes yet.</p>}
          {saved?.map((n) => (
            <div key={n.id} className="flex items-center justify-between gap-2 p-3 text-sm">
              <button className="min-w-0 text-left" onClick={() => { setContent(n.content); setEditing(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                <p className="truncate font-medium">{n.topic}</p>
                <p className="text-muted-foreground">{classes.find((c) => c.id === n.class_id)?.name ?? ""} {subjects.find((s) => s.id === n.subject_id)?.name ?? ""} · {n.term} term, week {n.week}</p>
              </button>
              <div className="flex shrink-0">
                <Button size="icon" variant="ghost" aria-label="Print note" onClick={() => printNote(n.topic, n.content)}><Printer className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Delete note" onClick={() => remove(n.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </CardContent></Card>
    </div>
  );
}
