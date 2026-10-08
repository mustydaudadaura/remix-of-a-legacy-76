import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  school_id: z.string().uuid(),
  class_id: z.string().uuid().nullable(),
  subject_id: z.string().uuid().nullable(),
  topic: z.string().trim().min(2).max(200),
  term: z.enum(["first", "second", "third"]),
  week: z.number().int().min(1).max(15),
  duration_minutes: z.number().int().min(10).max(240),
  extra: z.string().max(1000).optional(),
});

const INSTRUCTIONS = `You are an experienced Nigerian teacher and curriculum expert. Write a complete lesson plan and lesson note that follows the NERDC (Nigerian Educational Research and Development Council) curriculum and the format used in Nigerian primary/secondary schools and inspected by State Ministries of Education.
Use these headings in this order, in Markdown:
## Lesson Plan
A table with: Subject, Class, Term, Week, Topic, Sub-topic, Duration, Date (leave blank), Age of learners, Number of learners (leave blank).
### Behavioural / Performance Objectives — "By the end of the lesson, pupils/students should be able to:" 3–5 measurable objectives (use action verbs: state, list, explain, identify, solve).
### Instructional Materials
### Reference Materials (NERDC scheme of work and common Nigerian textbooks)
### Previous Knowledge / Entry Behaviour
### Set Induction (Introduction)
### Presentation — Step I, Step II, Step III ... each with Teacher's Activities and Learners' Activities (use a table with columns Step | Teacher's Activities | Learners' Activities).
### Evaluation — 4–5 questions.
### Summary / Conclusion
### Assignment
## Lesson Note
Detailed, simple explanatory content the teacher will write on the board, with Nigerian everyday examples, local names and Naira where relevant, worked examples where appropriate.
Match the language level to the class. Do not include anything outside these sections.`;

export const generateLessonNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: allowed } = await supabase.rpc("school_permission", { _user_id: userId, _school_id: data.school_id, _permission: "academics.view" });
    if (!allowed) throw new Error("You don't have access to lesson planning for this school");
    const [{ data: cls }, { data: subj }] = await Promise.all([
      data.class_id ? supabase.from("classes").select("name,section").eq("id", data.class_id).eq("school_id", data.school_id).maybeSingle() : Promise.resolve({ data: null }),
      data.subject_id ? supabase.from("subjects").select("name").eq("id", data.subject_id).eq("school_id", data.school_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const prompt = `Subject: ${subj?.name ?? "General"}
Class: ${cls?.name ?? "Not specified"}${cls?.section ? ` (${cls.section} section)` : ""}
Term: ${data.term} term, Week ${data.week}
Topic: ${data.topic}
Duration: ${data.duration_minutes} minutes
${data.extra ? `Teacher's extra notes: ${data.extra}` : ""}`;
    let failure: unknown = null;
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      instructions: INSTRUCTIONS,
      prompt,
      onError: ({ error }) => { failure = error; },
      providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] } },
    });
    let content = "";
    try { content = await result.text; } catch (e) { failure = e; }
    if (failure || !content.trim()) {
      const status = (failure as any)?.statusCode ?? (failure as any)?.status;
      if (status === 429) throw new Error("The AI is busy right now. Please wait a minute and try again.");
      if (status === 402 || status === 403) throw new Error("AI credits have run out. The workspace owner needs to add credits.");
      throw new Error("The AI could not write this lesson note. Please try again later.");
    }
    return { content };
  });
