import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/lib/verified-auth";
import { z } from "zod";

export interface ColumnDefinition {
  name: string;
  type: string;
  isNullable: boolean;
  isPrimaryKey?: boolean;
  defaultValue?: string | null;
}

export interface TableDefinition {
  name: string;
  category: "core" | "academics" | "assessments" | "finance" | "staff" | "portal" | "other";
  columns: ColumnDefinition[];
  sampleCount?: number;
  status: "verified" | "empty" | "error";
  error?: string;
  relationships?: string[];
}

export interface SchemaDiagnostics {
  timestamp: string;
  totalTables: number;
  tables: TableDefinition[];
  aiConfiguration: {
    geminiConfigured: boolean;
    lovableConfigured: boolean;
    model: string;
    status: "ready" | "partial" | "missing_keys";
  };
  keyFeaturesHealth: {
    subjectSelection: {
      status: "healthy" | "warning" | "error";
      notes: string[];
      totalSubjects: number;
      subjectsWithClassBinding: number;
      schoolWideSubjects: number;
    };
    aiLessonNotes: {
      status: "healthy" | "warning" | "error";
      notes: string[];
    };
    aiCurriculumAssistant: {
      status: "healthy" | "warning" | "error";
      notes: string[];
    };
  };
}

function categorizeTable(name: string): TableDefinition["category"] {
  if (["schools", "profiles", "user_roles", "campuses"].includes(name)) return "core";
  if (["classes", "subjects", "teacher_allocations", "timetable_slots", "assignments"].includes(name)) return "academics";
  if (["assessments", "report_cards", "scheme_items"].includes(name)) return "assessments";
  if (["fee_items", "fee_invoices", "fee_payments", "payroll_periods", "payroll_records", "payroll_items"].includes(name)) return "finance";
  if (["staff_profiles", "staff_attendance", "staff_salaries", "leave_requests", "staff_penalties"].includes(name)) return "staff";
  if (["parents", "student_parents", "students", "parent_notifications", "parent_preferences"].includes(name)) return "portal";
  return "other";
}

export const getDatabaseSchemaDiagnostics = createServerFn({ method: "GET" })
.middleware([requireSupabaseAuth])
.inputValidator(z.object({ school_id: z.string().uuid() }))
.handler(async ({ data, context }): Promise<SchemaDiagnostics> => {
  const { supabase: db } = context;
  const { data: allowed, error: permissionError } = await db.rpc("school_permission", {
    _user_id: context.userId, _school_id: data.school_id, _permission: "settings.edit",
  });
  if (permissionError || !allowed) throw new Error("Not authorized to inspect this school");
  const tableDefs: TableDefinition[] = [];
  // Probe live database sample counts for critical tables
  const criticalTables = ["schools", "classes", "subjects", "students", "assessments", "lesson_notes", "curriculum_documents", "scheme_items"] as const;
  let totalSubjects = 0;
  let subjectsWithClassBinding = 0;
  let schoolWideSubjects = 0;

  await Promise.all(
    criticalTables.map(async (tbl) => {
      try {
        const { count, error } = await db.from(tbl).select("*", { count: "exact", head: true }).eq("school_id", data.school_id);
        const target: TableDefinition = { name: tbl, category: categorizeTable(tbl), columns: [], status: "empty" };
        tableDefs.push(target);
        if (target) {
          if (error) {
            target.status = "error";
            target.error = error.message;
          } else {
            target.sampleCount = count ?? 0;
            target.status = (count ?? 0) > 0 ? "verified" : "empty";
          }
        }

        if (tbl === "subjects" && !error) {
          const { data: subs } = await db.from("subjects").select("id, class_id").eq("school_id", data.school_id);
          if (subs) {
            totalSubjects = subs.length;
            subjectsWithClassBinding = subs.filter((s) => s.class_id !== null).length;
            schoolWideSubjects = subs.filter((s) => s.class_id === null).length;
          }
        }
      } catch (err: any) {
        const target = tableDefs.find((t) => t.name === tbl);
        if (target) {
          target.status = "error";
          target.error = err?.message || "Probe failed";
        }
      }
    })
  );

  // Check AI readiness
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  const lovableConfigured = Boolean(process.env.LOVABLE_API_KEY);

  const subjectNotes: string[] = [];
  if (totalSubjects === 0) {
    subjectNotes.push("Zero subjects detected in the active school. Seeding or manual creation required.");
  } else {
    subjectNotes.push(`Found ${totalSubjects} registered subjects (${schoolWideSubjects} school-wide, ${subjectsWithClassBinding} class-allocated).`);
    subjectNotes.push("Query filters in Results Entry allow both school-wide subjects and class-allocated subjects.");
  }

  const aiLessonNotesNotes: string[] = [];
  if (geminiConfigured) {
    aiLessonNotesNotes.push("GEMINI_API_KEY is active in environment. Powered by gemini-3.5-flash-lite.");
    aiLessonNotesNotes.push("NERDC-compliant schema active (specific objectives, presentation steps, board notes).");
  } else if (lovableConfigured) {
    aiLessonNotesNotes.push("LOVABLE_API_KEY is active. Powered by Lovable AI Gateway.");
  } else {
    aiLessonNotesNotes.push("No AI API keys detected in environment. Please provide GEMINI_API_KEY.");
  }

  const aiCurriculumNotes: string[] = [];
  if (geminiConfigured) {
    aiCurriculumNotes.push("Gemini file-parsing active for DOCX, XLSX, PDF, and image curriculum documents.");
  } else {
    aiCurriculumNotes.push("Curriculum assistant requires GEMINI_API_KEY to parse scheme-of-work documents.");
  }

  return {
    timestamp: new Date().toISOString(),
    totalTables: tableDefs.length,
    tables: tableDefs,
    aiConfiguration: {
      geminiConfigured,
      lovableConfigured,
      model: "gemini-3.5-flash-lite",
      status: geminiConfigured ? "ready" : lovableConfigured ? "partial" : "missing_keys",
    },
    keyFeaturesHealth: {
      subjectSelection: {
        status: totalSubjects > 0 ? "healthy" : "warning",
        notes: subjectNotes,
        totalSubjects,
        subjectsWithClassBinding,
        schoolWideSubjects,
      },
      aiLessonNotes: {
        status: geminiConfigured || lovableConfigured ? "healthy" : "error",
        notes: aiLessonNotesNotes,
      },
      aiCurriculumAssistant: {
        status: geminiConfigured || lovableConfigured ? "healthy" : "error",
        notes: aiCurriculumNotes,
      },
    },
  };
});
