import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolAccess } from "@/hooks/useSchoolAccess";
import { breakdownCurriculum } from "@/lib/api/curriculum.functions";
import { generateLessonNote } from "@/lib/api/lesson-notes.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpenCheck, FileUp, Sparkles, Send, Check, Undo2, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Item = { id: string; name: string; class_id?: string | null };
const NONE = "__none";
const TERM_LABEL: Record<string, string> = { first: "1st term", second: "2nd term", third: "3rd term" };
const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "outline" }, submitted: { label: "Awaiting approval", variant: "secondary" },
  needs_revision: { label: "Returned", variant: "destructive" }, approved: { label: "Approved", variant: "default" },
};
const MAX = 10 * 1024 * 1024;

function mondayOf(d = new Date()) {
  const x = new Date(d); const day = x.getDay() || 7; x.setDate(x.getDate() - day + 1);
  return x.toISOString().slice(0, 10);
}
const toBase64 = (buf: ArrayBuffer) => {
  let s = ""; const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};

async function readFile(file: File): Promise<{ kind: "pdf" | "image" | "text"; content: string; mime: string }> {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return { kind: "pdf", content: toBase64(await file.arrayBuffer()), mime: "application/pdf" };
  if (file.type.startsWith("image/")) return { kind: "image", content: toBase64(await file.arrayBuffer()), mime: file.type };
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { kind: "text", content: r.value, mime: "text/plain" };
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer());
    return { kind: "text", content: wb.SheetNames.map((n) => `# ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join("\n\n"), mime: "text/plain" };
  }
  if (name.endsWith(".doc") || name.endsWith(".ppt") || name.endsWith(".pptx")) throw new Error("Please save this file as PDF or .docx first, then upload it");
  return { kind: "text", content: await file.text(), mime: "text/plain" };
}

export function CurriculumAssistant({ schoolId, classes, subjects }: { schoolId: string; classes: Item[]; subjects: Item[] }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { can } = useSchoolAccess();
  const isAdmin = can("academics.edit");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const docs = useQuery({
    queryKey: ["curriculum-docs", schoolId],
    queryFn: async () => (await supabase.from("curriculum_documents").select("id,title,file_name,summary,subject_id,created_at").eq("school_id", schoolId).order("created_at", { ascending: false })).data ?? [],
  });
  const activeDoc = docId ?? docs.data?.[0]?.id ?? null;
  const items = useQuery({
    queryKey: ["scheme-items", activeDoc], enabled: !!activeDoc,
    queryFn: async () => (await supabase.from("scheme_items").select("*").eq("document_id", activeDoc!).order("class_label").order("term").order("week")).data ?? [],
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["scheme-items"] }); qc.invalidateQueries({ queryKey: ["curriculum-docs"] }); qc.invalidateQueries({ queryKey: ["lesson-notes"] }); };

  const groups = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const it of items.data ?? []) {
      const key = it.class_id ? classes.find((c) => c.id === it.class_id)?.name ?? it.class_label : it.class_label || "Unassigned class";
      if (filter && key !== filter) continue;
      m.set(key, [...(m.get(key) ?? []), it]);
    }
    return [...m.entries()];
  }, [items.data, classes, filter]);
  const allLabels = useMemo(() => [...new Set((items.data ?? []).map((it) => (it.class_id ? classes.find((c) => c.id === it.class_id)?.name : null) ?? it.class_label ?? "Unassigned class"))], [items.data, classes]);

  const upload = async () => {
    if (!file) return toast.error("Choose a curriculum document first");
    if (file.size > MAX) return toast.error("File is larger than 10 MB");
    setBusy(true);
    try {
      const r = await readFile(file);
      if (r.content.trim().length < 20) throw new Error("No readable text found in this file");
      const res = await breakdownCurriculum({ data: { school_id: schoolId, subject_id: subject || null, title: title.trim() || file.name, file_name: file.name, ...r } });
      setDocId(res.document_id); setFile(null); setTitle(""); refresh();
      toast.success(`Broken into ${res.topics} weekly topics across ${res.classes} class${res.classes === 1 ? "" : "es"}`);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const update = async (id: string, patch: Record<string, any>) => {
    const { error } = await supabase.from("scheme_items").update(patch).eq("id", id);
    if (error) toast.error(error.message); else refresh();
  };

  const writeLesson = async (it: any, submit: boolean) => {
    const subj = it.subject_id ?? subject;
    if (!it.class_id) return toast.error("Pick the school class for this topic first");
    if (!subj) return toast.error("This document has no subject — pick a subject when uploading");
    setWorking(it.id);
    try {
      const weekStart = mondayOf();
      const extra = [it.sub_topics?.length ? `Sub-topics: ${it.sub_topics.join("; ")}` : "", it.objectives?.length ? `Objectives: ${it.objectives.join("; ")}` : ""].filter(Boolean).join("\n").slice(0, 1000);
      const r = await generateLessonNote({ data: { school_id: schoolId, class_id: it.class_id, subject_id: subj, topic: it.topic.slice(0, 200), week: it.week ?? 1, week_start: weekStart, extra: extra || undefined } });
      const { data: note, error } = await supabase.from("lesson_notes").insert({
        school_id: schoolId, class_id: it.class_id, subject_id: subj, week: it.week ?? 1, term: it.term, lesson_date: weekStart,
        topic: r.header.topic, content: r.plan.lesson_note || r.header.topic, plan: r.plan as any, header: r.header as any,
        status: submit ? "submitted" : "draft", created_by: user!.id,
      }).select("id").single();
      if (error) throw new Error(error.message);
      await supabase.from("scheme_items").update({ lesson_note_id: note.id }).eq("id", it.id);
      refresh();
      toast.success(submit ? "Lesson plan & note written and sent to the admin" : "Lesson plan & note saved — open the Lesson Notes tab to edit and submit");
    } catch (e: any) { toast.error(e.message); } finally { setWorking(null); }
  };

  const submitAll = async () => {
    const ids = (items.data ?? []).filter((i) => i.status === "draft" || i.status === "needs_revision").map((i) => i.id);
    if (!ids.length) return toast.info("Nothing left to submit");
    const { error } = await supabase.from("scheme_items").update({ status: "submitted" }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} topics sent for admin approval`); refresh();
  };
  const approveAll = async () => {
    const ids = (items.data ?? []).filter((i) => i.status === "submitted").map((i) => i.id);
    if (!ids.length) return toast.info("No topics awaiting approval");
    const { error } = await supabase.from("scheme_items").update({ status: "approved", review_remark: null }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} topics approved`); refresh();
  };
  const returnItem = async (id: string) => {
    const remark = window.prompt("What should the teacher correct?");
    if (!remark?.trim()) return;
    await update(id, { status: "needs_revision", review_remark: remark.trim() });
  };
  const removeDoc = async (id: string) => {
    if (!window.confirm("Delete this document and its scheme of work? Lesson plans already written are kept.")) return;
    const { error } = await supabase.from("curriculum_documents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setDocId(null); refresh();
  };

  const counts = (items.data ?? []).reduce((a: Record<string, number>, i) => ({ ...a, [i.status]: (a[i.status] ?? 0) + 1 }), {});
  const doc = docs.data?.find((d) => d.id === activeDoc);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Academic assistant — upload a curriculum</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Upload a curriculum, syllabus or scheme of work (PDF, Word, Excel, photo or text). The AI breaks it into classes, terms and weekly topics. From each topic you can write the lesson plan and lesson note in one tap and send everything to the admin for approval.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1"><Label>Document</Label><Input type="file" accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
            <div className="space-y-1"><Label>Title (optional)</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. NERDC Basic Science JSS" /></div>
            <div className="space-y-1"><Label>Subject</Label>
              <Select value={subject || NONE} onValueChange={(v) => setSubject(v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Choose subject" /></SelectTrigger>
                <SelectContent><SelectItem value={NONE}>Choose subject</SelectItem>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={upload} disabled={busy || !file}>{busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading and breaking down… (up to a minute)</> : <><FileUp className="mr-2 h-4 w-4" /> Break down with AI</>}</Button>
        </CardContent>
      </Card>

      {!!docs.data?.length && (
        <div className="flex flex-wrap gap-2">
          {docs.data.map((d) => (
            <Button key={d.id} size="sm" variant={d.id === activeDoc ? "default" : "outline"} onClick={() => { setDocId(d.id); setFilter(""); }}>
              <BookOpenCheck className="mr-1 h-3.5 w-3.5" /> {d.title}
            </Button>
          ))}
        </div>
      )}

      {doc && (
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{doc.title}</CardTitle>
                {doc.summary && <p className="mt-1 text-sm text-muted-foreground">{doc.summary}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{doc.subject_id ? subjects.find((s) => s.id === doc.subject_id)?.name : "No subject"} · {Object.entries(counts).map(([k, v]) => `${v} ${STATUS[k]?.label.toLowerCase() ?? k}`).join(" · ")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={submitAll}><Send className="mr-1 h-3.5 w-3.5" /> Submit scheme for approval</Button>
                {isAdmin && <Button size="sm" variant="secondary" onClick={approveAll}><Check className="mr-1 h-3.5 w-3.5" /> Approve all submitted</Button>}
                <Button size="icon" variant="ghost" onClick={() => removeDoc(doc.id)} aria-label="Delete document"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            {allLabels.length > 1 && (
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant={filter ? "ghost" : "secondary"} onClick={() => setFilter("")}>All classes</Button>
                {allLabels.map((l) => <Button key={l} size="sm" variant={filter === l ? "secondary" : "ghost"} onClick={() => setFilter(l)}>{l}</Button>)}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {items.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {groups.map(([label, list]) => (
              <section key={label} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{label}</h3>
                  {!list[0].class_id && (
                    <Select onValueChange={(v) => Promise.all(list.map((i) => supabase.from("scheme_items").update({ class_id: v }).eq("id", i.id))).then(refresh)}>
                      <SelectTrigger className="h-8 w-48"><SelectValue placeholder="Match to school class" /></SelectTrigger>
                      <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </div>
                <div className="divide-y rounded-md border">
                  {list.map((it) => {
                    const locked = it.status === "approved" && !isAdmin;
                    return (
                      <div key={it.id} className="grid gap-2 p-3 text-sm md:grid-cols-[110px_1fr_auto]">
                        <div className="text-xs text-muted-foreground">{it.term ? TERM_LABEL[it.term] : "Term ?"}<br />Week {it.week ?? "?"}</div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Input className="h-8 font-medium" defaultValue={it.topic} disabled={locked} onBlur={(e) => e.target.value.trim() && e.target.value !== it.topic && update(it.id, { topic: e.target.value.trim() })} />
                            <Badge variant={STATUS[it.status]?.variant ?? "outline"}>{STATUS[it.status]?.label ?? it.status}</Badge>
                            {it.lesson_note_id && <Badge variant="secondary">Lesson plan written</Badge>}
                          </div>
                          {!!it.sub_topics?.length && <p className="text-xs text-muted-foreground">Sub-topics: {it.sub_topics.join(" · ")}</p>}
                          {!!it.objectives?.length && <p className="text-xs text-muted-foreground">Objectives: {it.objectives.join(" · ")}</p>}
                          {it.review_remark && <p className="text-xs text-destructive">Admin remark: {it.review_remark}</p>}
                        </div>
                        <div className="flex flex-wrap items-start gap-1 md:justify-end">
                          {!it.lesson_note_id && <>
                            <Button size="sm" variant="outline" disabled={working === it.id} onClick={() => writeLesson(it, false)}>{working === it.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}Write lesson plan</Button>
                            <Button size="sm" disabled={working === it.id} onClick={() => writeLesson(it, true)}><Send className="mr-1 h-3.5 w-3.5" />Write & submit</Button>
                          </>}
                          {isAdmin && it.status === "submitted" && <>
                            <Button size="sm" variant="secondary" onClick={() => update(it.id, { status: "approved", review_remark: null })}><Check className="mr-1 h-3.5 w-3.5" />Approve</Button>
                            <Button size="sm" variant="ghost" onClick={() => returnItem(it.id)}><Undo2 className="mr-1 h-3.5 w-3.5" />Return</Button>
                          </>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
