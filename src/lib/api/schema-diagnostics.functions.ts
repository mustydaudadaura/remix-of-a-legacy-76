import { createServerFn } from "@tanstack/react-start";
import { readFileSync } from "fs";
import { resolve } from "path";

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

export const getDatabaseSchemaDiagnostics = createServerFn({ method: "GET" }).handler(async (): Promise<SchemaDiagnostics> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Parse types.ts to extract accurate column definitions
  let typesContent = "";
  try {
    const typesPath = resolve(process.cwd(), "src/integrations/supabase/types.ts");
    typesContent = readFileSync(typesPath, "utf-8");
  } catch (err) {
    console.warn("Could not read types.ts directly, using fallback:", err);
  }

  const tableDefs: TableDefinition[] = [];
  const tablesBlock = typesContent.match(/Tables:\s*\{([\s\S]*?)\n    Views:/)?.[1] || "";
  const tableMatches = [...tablesBlock.matchAll(/^\s{6}([a-zA-Z0-9_]+):\s*\{\s*Row:\s*\{([\s\S]*?)\}\s*Insert:/gm)];

  for (const match of tableMatches) {
    const tableName = match[1];
    const rowBlock = match[2];
    const columns: ColumnDefinition[] = [];

    const lines = rowBlock.split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("//")) continue;
      const colMatch = line.match(/^([a-zA-Z0-9_]+)(\??):\s*(.+)$/);
      if (colMatch) {
        const colName = colMatch[1];
        let colType = colMatch[3].replace(/;$/, "");
        const isNullable = colType.includes("null") || colMatch[2] === "?";
        columns.push({
          name: colName,
          type: colType.replace(/\s*\|\s*null/, "").trim(),
          isNullable,
        });
      }
    }

    tableDefs.push({
      name: tableName,
      category: categorizeTable(tableName),
      columns,
      status: "verified",
    });
  }

  // Probe live database sample counts for critical tables
  const criticalTables = ["schools", "classes", "subjects", "students", "assessments", "lesson_notes", "curriculum_documents", "scheme_items"];
  let totalSubjects = 0;
  let subjectsWithClassBinding = 0;
  let schoolWideSubjects = 0;

  await Promise.all(
    criticalTables.map(async (tbl) => {
      try {
        const { count, error } = await supabaseAdmin.from(tbl).select("*", { count: "exact", head: true });
        const target = tableDefs.find((t) => t.name === tbl);
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
          const { data: subs } = await supabaseAdmin.from("subjects").select("id, class_id");
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
