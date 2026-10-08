import type { LessonHeader, LessonPlan, LessonStep } from "@/lib/lesson-plan";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

const toLines = (a?: string[]) => (a ?? []).join("\n");
const fromLines = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);

/** Lets a teacher personalise every part of a generated lesson plan before submitting. */
export function LessonPlanEditor({ header, plan, onChange }: { header: LessonHeader; plan: LessonPlan; onChange: (h: LessonHeader, p: LessonPlan) => void }) {
  const H = (k: keyof LessonHeader, v: string) => onChange({ ...header, [k]: k === "no_in_class" || k === "week" ? Number(v) || 0 : v }, plan);
  const P = (k: keyof LessonPlan, v: unknown) => onChange(header, { ...plan, [k]: v });
  const step = (i: number, k: keyof LessonStep, v: string) => P("presentation", plan.presentation.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const field = (label: string, value: string | number, set: (v: string) => void) => (
    <div><Label>{label}</Label><Input value={value ?? ""} onChange={(e) => set(e.target.value)} /></div>
  );
  const area = (label: string, value: string, set: (v: string) => void, rows = 3, hint?: string) => (
    <div className="sm:col-span-2"><Label>{label}{hint && <span className="ml-1 text-xs font-normal text-muted-foreground">({hint})</span>}</Label>
      <Textarea rows={rows} value={value} onChange={(e) => set(e.target.value)} /></div>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {field("Topic", header.topic, (v) => H("topic", v))}
      {field("Date", header.date, (v) => H("date", v))}
      {field("Period", header.period, (v) => H("period", v))}
      {field("Duration", header.duration, (v) => H("duration", v))}
      {field("Time", header.time, (v) => H("time", v))}
      {field("No in class", header.no_in_class, (v) => H("no_in_class", v))}
      {field("Average age", header.average_age, (v) => H("average_age", v))}
      {field("Sex", header.sex, (v) => H("sex", v))}
      {area("Sub-topics", toLines(plan.sub_topics), (v) => P("sub_topics", fromLines(v)), 4, "one per line")}
      {area("Specific objectives", toLines(plan.specific_objectives), (v) => P("specific_objectives", fromLines(v)), 4, "one per line")}
      {area("Rationale", plan.rationale, (v) => P("rationale", v))}
      {area("Previous knowledge", plan.previous_knowledge, (v) => P("previous_knowledge", v), 2)}
      {area("Instructional materials", toLines(plan.instructional_materials), (v) => P("instructional_materials", fromLines(v)), 4, "one per line")}
      {area("Reference materials", toLines(plan.reference_materials), (v) => P("reference_materials", fromLines(v)), 3, "one per line")}
      <div className="space-y-3 sm:col-span-2">
        <Label>Presentation steps</Label>
        {plan.presentation.map((s, i) => (
          <div key={i} className="space-y-2 rounded-md border p-3">
            <div className="flex gap-2"><Input value={s.stage} onChange={(e) => step(i, "stage", e.target.value)} />
              <Button size="icon" variant="ghost" aria-label="Remove step" onClick={() => P("presentation", plan.presentation.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div><Label className="text-xs">Teacher's activities</Label><Textarea rows={4} value={s.teacher_activities} onChange={(e) => step(i, "teacher_activities", e.target.value)} /></div>
              <div><Label className="text-xs">Learning activities</Label><Textarea rows={4} value={s.learning_activities} onChange={(e) => step(i, "learning_activities", e.target.value)} /></div>
              <div><Label className="text-xs">Learning point</Label><Textarea rows={4} value={s.learning_point} onChange={(e) => step(i, "learning_point", e.target.value)} /></div>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => P("presentation", [...plan.presentation, { stage: `STEP ${plan.presentation.length}`, teacher_activities: "", learning_activities: "", learning_point: "" }])}><Plus className="mr-1 h-4 w-4" />Add step</Button>
      </div>
      {area("Evaluation questions", toLines(plan.evaluation), (v) => P("evaluation", fromLines(v)), 4, "one per line")}
      {area("Summary", plan.summary, (v) => P("summary", v))}
      {area("Assignment", toLines(plan.assignment), (v) => P("assignment", fromLines(v)), 3, "one per line")}
      {area("Lesson note", plan.lesson_note, (v) => P("lesson_note", v), 14, "headings with #, lists with -")}
    </div>
  );
}
