import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { evaluateRange, localParts, normaliseSettings } from "@/lib/staff-attendance";

export type StaffMember = { user_id: string; name: string; role: string; staff_no: string | null; department: string | null; category: string; photo_url: string | null; active: boolean; attendance_exempt: boolean; has_profile: boolean };

export function useStaffList(schoolId: string) {
  return useQuery({ queryKey: ["sa-staff", schoolId], queryFn: async () => {
    const [roles, sp] = await Promise.all([
      supabase.from("user_roles").select("user_id,role").eq("school_id", schoolId).in("role", ["school_admin", "teacher", "accountant"]),
      supabase.from("staff_profiles").select("user_id,staff_no,department,category,photo_url,active,attendance_exempt").eq("school_id", schoolId),
    ]);
    if (roles.error) throw roles.error;
    const ids = [...new Set((roles.data ?? []).map((r) => r.user_id))];
    const { data: profs } = ids.length ? await supabase.from("profiles").select("user_id,full_name").in("user_id", ids) : { data: [] };
    const pmap = new Map((sp.data ?? []).map((p) => [p.user_id, p]));
    const names = new Map((profs ?? []).map((p) => [p.user_id, p.full_name]));
    return ids.map<StaffMember>((id) => {
      const p = pmap.get(id);
      return { user_id: id, name: names.get(id) ?? "Staff", role: (roles.data ?? []).filter((r) => r.user_id === id).map((r) => r.role).join(", "), staff_no: p?.staff_no ?? null, department: p?.department ?? null, category: p?.category ?? "teaching", photo_url: p?.photo_url ?? null, active: p?.active ?? true, attendance_exempt: p?.attendance_exempt ?? false, has_profile: Boolean(p) };
    }).sort((a, b) => a.name.localeCompare(b.name));
  } });
}

export function useSettings(schoolId: string) {
  return useQuery({ queryKey: ["sa-settings", schoolId], queryFn: async () => {
    const { data, error } = await supabase.from("attendance_settings").select("*").eq("school_id", schoolId).maybeSingle();
    if (error) throw error;
    return { exists: Boolean(data), settings: normaliseSettings(data as never) };
  } });
}

/** Loads records, holidays, leave and exemptions for a range and evaluates every staff/day with the shared rules. */
export function useRange(schoolId: string, from: string, to: string, staff: StaffMember[] | undefined, settings: ReturnType<typeof normaliseSettings> | undefined) {
  return useQuery({
    queryKey: ["sa-range", schoolId, from, to, staff?.length, settings],
    enabled: Boolean(staff && settings && from && to && from <= to),
    queryFn: async () => {
      const [rec, hol, lv, types, ex, pen] = await Promise.all([
        supabase.from("staff_attendance").select("id,user_id,date,check_in_at,check_out_at,late_minutes,worked_minutes,in_verified,out_verified,in_method,out_method,in_distance_m,correction_reason").eq("school_id", schoolId).gte("date", from).lte("date", to),
        supabase.from("staff_holidays").select("title,start_date,end_date,kind").eq("school_id", schoolId).lte("start_date", to).gte("end_date", from),
        supabase.from("leave_requests").select("user_id,start_date,end_date,leave_type_id").eq("school_id", schoolId).eq("status", "approved").lte("start_date", to).gte("end_date", from),
        supabase.from("leave_types").select("id,name").eq("school_id", schoolId),
        supabase.from("attendance_exemptions").select("user_id,start_date,end_date,reason").eq("school_id", schoolId).lte("start_date", to).gte("end_date", from),
        supabase.from("staff_penalties").select("id,user_id,date,kind,amount,status,minutes,waive_reason").eq("school_id", schoolId).gte("date", from).lte("date", to),
      ]);
      const err = [rec, hol, lv, ex, pen].find((r) => r.error)?.error; if (err) throw err;
      const tmap = new Map((types.data ?? []).map((t) => [t.id, t.name]));
      const now = localParts(new Date());
      const active = staff!.filter((s) => s.active);
      const rows = evaluateRange({
        from, to, today: now.date, nowMinutes: now.minutes, settings: settings!,
        staff: active.map((s) => ({ user_id: s.user_id, attendance_exempt: s.attendance_exempt })),
        records: (rec.data ?? []) as never, holidays: hol.data ?? [],
        leaves: (lv.data ?? []).map((l) => ({ ...l, label: `Leave: ${tmap.get(l.leave_type_id ?? "") ?? "Approved leave"}` })),
        exemptions: ex.data ?? [],
      });
      return { rows, records: rec.data ?? [], penalties: pen.data ?? [] };
    },
  });
}

export const naira = (n: number) => `₦${Number(n || 0).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
export const todayStr = () => localParts(new Date()).date;
export function shiftDate(d: string, days: number) { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + days); return x.toISOString().slice(0, 10); }
