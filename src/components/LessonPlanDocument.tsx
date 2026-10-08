import { marked } from "marked";
import type { LessonHeader, LessonPlan } from "@/lib/lesson-plan";

const esc = (t: unknown) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const lines = (a?: string[]) => (a ?? []).map((x) => esc(x)).join("<br/>");

/** Builds the government-format lesson plan as standalone HTML (used on screen and for printing). */
export function lessonPlanHtml(h: LessonHeader, p: LessonPlan) {
  const row = (k: string, v: string) => `<tr><th>${k}</th><td colspan="3">${v}</td></tr>`;
  const steps = p.presentation.map((s) => `<tr><th>${esc(s.stage)}</th><td>${esc(s.teacher_activities)}</td><td>${esc(s.learning_activities)}</td><td>${esc(s.learning_point)}</td></tr>`).join("");
  return `<div class="lp">
<table>
<tr><td colspan="4" class="c b">${esc(h.term)} TERM ${esc(h.subject).toUpperCase()} LESSON PLAN FOR WEEK ${esc(h.week)}</td></tr>
<tr><td colspan="4" class="c b">${esc(h.school_name).toUpperCase()}${h.school_address ? ", " + esc(h.school_address).toUpperCase() : ""}</td></tr>
<tr><td colspan="4" class="c b">${esc(h.class_name)} ${esc(h.term)} TERM ${esc(h.subject).toUpperCase()} LESSON PLAN ${esc(h.session)} SESSION</td></tr>
${row("CLASS", esc(h.class_name))}${row("SUBJECT", esc(h.subject))}${row("TOPIC", `<b>${esc(h.topic).toUpperCase()}</b>`)}
${row("SUB-TOPICS", lines(p.sub_topics))}${row("DATE", esc(h.date))}${row("PERIOD", esc(h.period))}${row("DURATION", esc(h.duration))}
${row("TIME", esc(h.time))}${row("NO IN CLASS", esc(h.no_in_class || ""))}${row("AVERAGE AGE", esc(h.average_age))}${row("SEX", esc(h.sex))}
${row("SPECIFIC OBJECTIVE", "At the end of the lesson, students should be able to:<br/>" + lines(p.specific_objectives))}
${row("RATIONALE", esc(p.rationale))}${row("PREVIOUS KNOWLEDGE", esc(p.previous_knowledge))}
${row("INSTRUCTIONAL MATERIALS", lines(p.instructional_materials))}
${p.reference_materials?.length ? row("REFERENCE MATERIALS", lines(p.reference_materials)) : ""}
<tr class="hd"><th>PRESENTATION</th><th>TEACHER'S ACTIVITIES</th><th>LEARNING ACTIVITIES</th><th>LEARNING POINT</th></tr>
${steps}
${row("EVALUATION", (p.evaluation ?? []).map((q, i) => `${i + 1}. ${esc(q)}`).join("<br/>"))}
${row("SUMMARY", esc(p.summary))}${row("ASSIGNMENT", (p.assignment ?? []).map((q, i) => `${i + 1}. ${esc(q)}`).join("<br/>"))}
</table>
${h.teacher ? `<p class="c sig">${esc(h.teacher).toUpperCase()}</p>` : ""}
${p.lesson_note ? `<h2>LESSON NOTE</h2><div class="note">${marked.parse(esc(p.lesson_note), { async: false })}</div>` : ""}
</div>`;
}

export const LESSON_PLAN_CSS = `.lp{font-family:"Times New Roman",serif;font-size:14px;color:#000;background:#fff}
.lp table{border-collapse:collapse;width:100%}.lp td,.lp th{border:1px solid #000;padding:4px 6px;vertical-align:top;text-align:left}
.lp th{font-weight:700;width:22%}.lp .hd th{text-align:center;width:auto}.lp .c{text-align:center}.lp .b{font-weight:700}
.lp .sig{margin-top:16px;font-weight:600}.lp h2{font-size:16px;margin:20px 0 6px;border-bottom:1px solid #000}
.lp .note ul,.lp .note ol{padding-left:20px}.lp .note ul{list-style:disc}.lp .note ol{list-style:decimal}.lp .note h3{font-weight:700;margin-top:8px}`;

export function LessonPlanDocument({ header, plan }: { header: LessonHeader; plan: LessonPlan }) {
  return (
    <div className="overflow-x-auto rounded-md border bg-card p-2">
      <style>{LESSON_PLAN_CSS}</style>
      <div className="min-w-[640px]" dangerouslySetInnerHTML={{ __html: lessonPlanHtml(header, plan) }} />
    </div>
  );
}

export function printLessonPlan(header: LessonHeader, plan: LessonPlan) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(`<html><head><title>${esc(header.topic)} – Lesson Plan</title><style>${LESSON_PLAN_CSS} body{margin:20px} @page{size:A4;margin:12mm}</style></head><body>${lessonPlanHtml(header, plan)}</body></html>`);
  w.document.close(); w.focus(); w.print();
  return true;
}
