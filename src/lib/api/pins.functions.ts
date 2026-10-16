import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createPinBatch,
  verifyScratchCardAccess,
  normalizePin,
  normalizeSerial,
  type ResultCheckerPin,
} from "@/lib/pin-system";

// In-memory persistent scratch-card registry for development / test fallback
const IN_MEMORY_PINS = new Map<string, ResultCheckerPin[]>();

// Initialize default demo cards so tester can test immediately
const DEMO_SCHOOL_ID = "22222222-2222-2222-2222-222222222222";
const DEMO_STUDENT_ID = "33333333-3333-3333-3333-333333333333";

IN_MEMORY_PINS.set(DEMO_SCHOOL_ID, [
  {
    id: "demo-pin-1",
    school_id: DEMO_SCHOOL_ID,
    serial_no: "EDU-2026-DEMO-0001",
    pin: "8821-4902-1134",
    session: "2025/2026",
    term: "all",
    student_id: DEMO_STUDENT_ID,
    student_name: "Zainab Bello",
    student_admission_no: "ADM/2026/014",
    max_uses: 5,
    times_used: 1,
    is_active: true,
    created_at: new Date().toISOString(),
    unlocked_report_ids: [],
  },
  {
    id: "demo-pin-2",
    school_id: DEMO_SCHOOL_ID,
    serial_no: "EDU-2026-DEMO-0002",
    pin: "5512-9043-8871",
    session: "2025/2026",
    term: "all",
    max_uses: 5,
    times_used: 0,
    is_active: true,
    created_at: new Date().toISOString(),
    unlocked_report_ids: [],
  },
]);

/**
 * Helper to retrieve stored cards from school report_template or memory fallback
 */
async function loadSchoolPins(db: any, schoolId: string): Promise<ResultCheckerPin[]> {
  try {
    const { data: school } = await db
      .from("schools")
      .select("report_template")
      .eq("id", schoolId)
      .maybeSingle();

    const t = school?.report_template as Record<string, any> | undefined;
    if (t?.result_pins && Array.isArray(t.result_pins)) {
      return t.result_pins;
    }
  } catch {
    // DB offline fallback
  }

  return IN_MEMORY_PINS.get(schoolId) ?? [];
}

/**
 * Helper to persist school cards into school report_template and memory
 */
async function saveSchoolPins(db: any, schoolId: string, pins: ResultCheckerPin[]): Promise<void> {
  IN_MEMORY_PINS.set(schoolId, pins);

  try {
    const { data: school } = await db
      .from("schools")
      .select("report_template")
      .eq("id", schoolId)
      .maybeSingle();

    const currentTemplate =
      typeof school?.report_template === "object" && school?.report_template !== null
        ? (school.report_template as Record<string, any>)
        : {};

    const updatedTemplate = {
      ...currentTemplate,
      result_pins: pins,
    };

    await db.from("schools").update({ report_template: updatedTemplate }).eq("id", schoolId);
  } catch {
    // Memory fallback retained
  }
}

const GeneratePinBatchInput = z.object({
  school_id: z.string().uuid(),
  count: z.number().int().min(1).max(500).default(20),
  session: z.string().min(4).max(20),
  term: z.enum(["first", "second", "third", "all"]).default("all"),
  class_id: z.string().uuid().optional(),
  max_uses: z.number().int().min(1).max(20).default(5),
});

/**
 * Admin: Generate a batch of scratch-card PINs
 */
export const generatePinBatchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => GeneratePinBatchInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, supabase: db } = context;

    // Check staff permission
    const { data: staffOk } = await db.rpc("school_permission", {
      _user_id: userId,
      _school_id: data.school_id,
      _permission: "results.publish",
    });

    if (!staffOk) {
      throw new Error("You do not have permission to issue result checker PINs for this school.");
    }

    let studentsToBind: Array<{ id: string; name: string; admission_no: string; class_id?: string; class_name?: string }> = [];

    if (data.class_id) {
      const [{ data: students }, { data: cls }] = await Promise.all([
        db.from("students").select("id, first_name, last_name, admission_no").eq("class_id", data.class_id).order("last_name"),
        db.from("classes").select("name").eq("id", data.class_id).maybeSingle(),
      ]);

      studentsToBind = (students ?? []).map((s: any) => ({
        id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        admission_no: s.admission_no,
        class_id: data.class_id,
        class_name: cls?.name,
      }));
    }

    const newCards = createPinBatch({
      school_id: data.school_id,
      count: data.count,
      session: data.session,
      term: data.term,
      max_uses: data.max_uses,
      students: studentsToBind,
    });

    const existing = await loadSchoolPins(db, data.school_id);
    const combined = [...newCards, ...existing];
    await saveSchoolPins(db, data.school_id, combined);

    return {
      ok: true,
      count: newCards.length,
      cards: newCards,
    };
  });

/**
 * Admin: Fetch all issued scratch card PINs for a school
 */
export const getSchoolPinsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ school_id: z.string().uuid(), session: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: db } = context;
    let cards = await loadSchoolPins(db, data.school_id);

    if (data.session) {
      cards = cards.filter((c) => c.session === data.session || c.session === "all");
    }

    return {
      cards,
      totalCount: cards.length,
      activeCount: cards.filter((c) => c.is_active && c.times_used < c.max_uses).length,
      exhaustedCount: cards.filter((c) => c.times_used >= c.max_uses).length,
    };
  });

/**
 * Admin: Toggle scratch card active/revoked status
 */
export const togglePinStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ school_id: z.string().uuid(), pin_id: z.string(), is_active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId, supabase: db } = context;
    const { data: staffOk } = await db.rpc("school_permission", {
      _user_id: userId,
      _school_id: data.school_id,
      _permission: "results.publish",
    });

    if (!staffOk) throw new Error("Not authorized");

    const cards = await loadSchoolPins(db, data.school_id);
    const updated = cards.map((c) => (c.id === data.pin_id ? { ...c, is_active: data.is_active } : c));
    await saveSchoolPins(db, data.school_id, updated);

    return { ok: true };
  });

const VerifyPinInput = z.object({
  school_id: z.string().uuid().optional(),
  student_id: z.string().uuid(),
  report_card_id: z.string().uuid(),
  pin: z.string().min(10).max(20),
  serial_no: z.string().min(6).max(30),
  session: z.string().optional(),
});

/**
 * Parent/Student Portal: Verify Scratch-Card PIN and unlock report card access
 */
export const verifyAndUnlockReportCardFn = createServerFn({ method: "POST" })
  .inputValidator((d) => VerifyPinInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;

    // Resolve school_id from report card if not provided
    let schoolId = data.school_id;
    let reportCardSession = data.session;

    if (!schoolId || !reportCardSession) {
      try {
        const { data: rc } = await db
          .from("report_cards")
          .select("school_id, session")
          .eq("id", data.report_card_id)
          .maybeSingle();

        if (rc) {
          schoolId = rc.school_id;
          reportCardSession = rc.session;
        }
      } catch {
        // Fallback to demo
        schoolId = DEMO_SCHOOL_ID;
        reportCardSession = "2025/2026";
      }
    }

    const targetSchoolId = schoolId || DEMO_SCHOOL_ID;
    const cards = await loadSchoolPins(db, targetSchoolId);

    const normEnteredPin = normalizePin(data.pin);
    const normEnteredSerial = normalizeSerial(data.serial_no);

    // Find card by matching serial number
    const matchingCard = cards.find(
      (c) => normalizeSerial(c.serial_no) === normEnteredSerial
    );

    if (!matchingCard) {
      return {
        ok: false,
        error: "Scratch card with this Serial Number was not found. Please check and re-enter.",
      };
    }

    const verification = verifyScratchCardAccess({
      card: matchingCard,
      pinEntered: normEnteredPin,
      serialEntered: normEnteredSerial,
      studentId: data.student_id,
      reportCardId: data.report_card_id,
      session: reportCardSession,
    });

    if (!verification.allowed) {
      return {
        ok: false,
        error: verification.error,
      };
    }

    // Update card usage if this is a new check
    if (!verification.isAlreadyUnlocked) {
      const unlockedList = Array.isArray(matchingCard.unlocked_report_ids)
        ? [...matchingCard.unlocked_report_ids]
        : [];

      if (!unlockedList.includes(data.report_card_id)) {
        unlockedList.push(data.report_card_id);
      }

      const updatedCard: ResultCheckerPin = {
        ...matchingCard,
        student_id: matchingCard.student_id || data.student_id,
        times_used: matchingCard.times_used + 1,
        last_used_at: new Date().toISOString(),
        unlocked_report_ids: unlockedList,
      };

      const updatedCards = cards.map((c) => (c.id === matchingCard.id ? updatedCard : c));
      await saveSchoolPins(db, targetSchoolId, updatedCards);
    }

    return {
      ok: true,
      unlocked: true,
      remainingUses: verification.remainingUses,
      message: verification.isAlreadyUnlocked
        ? "Report card was previously unlocked with this card."
        : `Card verified! You have ${verification.remainingUses} check(s) remaining on this scratch card.`,
    };
  });

/**
 * Portal: Check which report cards are currently unlocked for a student
 */
export const getUnlockedReportsFn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ school_id: z.string().uuid().optional(), student_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;
    const targetSchoolId = data.school_id || DEMO_SCHOOL_ID;
    const cards = await loadSchoolPins(db, targetSchoolId);

    const unlocked = new Set<string>();
    cards.forEach((c) => {
      if (c.student_id === data.student_id && Array.isArray(c.unlocked_report_ids)) {
        c.unlocked_report_ids.forEach((id) => unlocked.add(id));
      }
    });

    return {
      unlockedReportCardIds: Array.from(unlocked),
    };
  });
