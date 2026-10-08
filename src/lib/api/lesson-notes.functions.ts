import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { LessonHeader, LessonPlan } from "@/lib/lesson-plan";

const Input = z.object({
  school_id: z.string().uuid(),
  class_id: z.string().uuid(),
  subject_id: z.string().uuid(),
  topic: z.string().trim().min(2).max(200),
  week: z.number().int().min(1).max(15),
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  extra: z.string().max(1000).optional(),
});

const TERMS: Record<string, string> = { first: "1ST", second: "2ND", third: "3RD" };
const DAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const mins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

const INSTRUCTIONS = `You are an experienced Nigerian teacher writing an official government-format lesson plan (NERDC curriculum, as inspected by State Ministries of Education).
Return ONLY a JSON object (no code fences) with exactly these keys:
{"sub_topics": string[] (3-6),
 "specific_objectives": string[] (3-5 measurable, action verbs; do not include the lead-in sentence),
 "rationale": string,
 "previous_knowledge": string,
 "instructional_materials": string[],
 "reference_materials": string[],
 "presentation": [{"stage": "INTRODUCTION"|"STEP I"|"STEP II"|..., "teacher_activities": string, "learning_activities": string, "learning_point": string}] (introduction plus one step per sub-topic, then "CONCLUSION"),
 "evaluation": string[] (4-5 questions),
 "summary": string,
 "assignment": string[],
 "lesson_note": string (detailed board note in Markdown with headings per sub-topic, Nigerian examples),
 "video_searches": string[] (3-4 short YouTube search phrases a teacher could use to find good explainer videos on this topic and its sub-topics, e.g. "electoral process in Nigeria explained")}
Match the language level to the class.`;

export const generateLessonNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: allowed } = await supabase.rpc("school_permission", { _user_id: userId, _school_id: data.school_id, _permission: "academics.view" });
    if (!allowed) throw new Error("You don't have access to lesson planning for this school");

    const [school, cls, subj, students, slots, prof] = await Promise.all([
      supabase.from("schools").select("name,address,current_session,current_term").eq("id", data.school_id).maybeSingle(),
      supabase.from("classes").select("name,section").eq("id", data.class_id).eq("school_id", data.school_id).maybeSingle(),
      supabase.from("subjects").select("name").eq("id", data.subject_id).eq("school_id", data.school_id).maybeSingle(),
      supabase.from("students").select("gender,dob").eq("class_id", data.class_id).eq("status", "active"),
      supabase.from("timetable_slots").select("day_of_week,start_time,end_time").eq("class_id", data.class_id).eq("subject_id", data.subject_id).order("day_of_week").order("start_time"),
      supabase.from("profiles").select("full_name").eq("user_id", userId).maybeSingle(),
    ]);
    if (!cls.data || !subj.data) throw new Error("Class or subject not found");

    const st = students.data ?? [];
    const now = new Date(data.week_start);
    const ages = st.filter((s) => s.dob).map((s) => Math.floor((now.getTime() - new Date(s.dob!).getTime()) / 31557600000));
    const male = st.filter((s) => s.gender === "male").length, female = st.filter((s) => s.gender === "female").length;
    const sl = slots.data ?? [];
    const totalMin = sl.reduce((a, s) => a + mins(s.end_time) - mins(s.start_time), 0);
    const start = new Date(data.week_start);
    const end = new Date(start); end.setDate(start.getDate() + 4);
    const term = school.data?.current_term ?? "first";

    const header: LessonHeader = {
      school_name: school.data?.name ?? "", school_address: school.data?.address ?? "",
      session: school.data?.current_session ?? "", term: TERMS[term] ?? "", week: data.week,
      class_name: cls.data.name, subject: subj.data.name, topic: data.topic,
      date: `${fmtDate(start)} – ${fmtDate(end)}`,
      period: sl.length ? `${sl.length} period${sl.length > 1 ? "s" : ""}` : "One period",
      duration: totalMin ? `${totalMin} Minutes` : "40 Minutes",
      time: sl.length ? sl.map((s) => `${DAYS[s.day_of_week].slice(0, 3)} ${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)}`).join(", ") : "As timetabled",
      no_in_class: st.length,
      average_age: ages.length ? `${Math.min(...ages)}-${Math.max(...ages)} years` : "",
      sex: male && female ? "Mixed" : male ? "Male" : female ? "Female" : "Mixed",
      teacher: prof.data?.full_name ?? "",
    };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const provider = createOpenAI({ baseURL: "https://ai.gateway.lovable.dev/v1", apiKey, headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" } });
    let failure: unknown = null;
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      instructions: INSTRUCTIONS,
      prompt: `Return json. Subject: ${header.subject}\nClass: ${header.class_name}${cls.data.section ? ` (${cls.data.section})` : ""}\nTerm: ${header.term} term, Week ${data.week}, ${header.session} session\nTopic: ${data.topic}\nDuration: ${header.duration} (${header.period})\nLearners: ${header.no_in_class || "unknown"}, ages ${header.average_age || "typical for class"}\n${data.extra ? `Teacher notes: ${data.extra}` : ""}`,
      onError: ({ error }) => { failure = error; },
      providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] } },
    });
    let text = "";
    try { text = await result.text; } catch (e) { failure = e; }
    const status = (failure as any)?.statusCode ?? (failure as any)?.status;
    if (status === 429) throw new Error("The AI is busy right now. Please wait a minute and try again.");
    if (status === 402 || status === 403) throw new Error("AI credits have run out. The workspace owner needs to add credits.");
    let plan: LessonPlan;
    try {
      const raw = text.replace(/^```(?:json)?\s*|\s*```$/g, "");
      plan = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
      if (!Array.isArray(plan.presentation)) throw new Error();
    } catch { throw new Error("The AI could not write this lesson plan. Please try again."); }
    return { header, plan };
  });
