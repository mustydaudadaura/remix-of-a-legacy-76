import { createServerFn } from "@tanstack/react-start";

const DEMO_EMAIL = "demo.admin@eduerp-demo.ng";
const DEMO_PASSWORD = "DemoSchool#2026";

export const startDemo = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

  let { data: school } = await db.from("schools").select("id").eq("code", "DEMO001").maybeSingle();
  if (!school) {
    const { data, error } = await db.from("schools").insert({
      name: "Bright Future Demo Academy", code: "DEMO001", motto: "Knowledge and Character",
      address: "12 Ahmadu Bello Way, Kaduna", phone: "08030000000", principal_name: "Mrs. Fatima Yusuf",
      current_session: "2025/2026", current_term: "first",
    }).select("id").single();
    if (error) throw new Error(error.message);
    school = data;
    const sid = school.id;
    const { data: classes } = await db.from("classes").insert([
      { school_id: sid, name: "Nursery 2", section: "nursery" },
      { school_id: sid, name: "Primary 4A", section: "primary", arm: "A" },
      { school_id: sid, name: "JSS 1A", section: "secondary", arm: "A" },
    ]).select("id, name");
    const subjNames = ["Mathematics", "English Language", "Basic Science", "Civic Education"];
    const names = [["Aisha", "Bello"], ["Chinedu", "Okafor"], ["Tunde", "Adeyemi"], ["Zainab", "Musa"], ["Emeka", "Eze"], ["Halima", "Sani"]];
    let n = 1;
    for (const c of classes ?? []) {
      const { data: subs } = await db.from("subjects").insert(subjNames.map((s) => ({ school_id: sid, class_id: c.id, name: s }))).select("id");
      await db.from("fee_items").insert({ school_id: sid, class_id: c.id, name: "School Fees", amount: 45000, session: "2025/2026", term: "first" });
      for (const [f, l] of names) {
        const { data: st } = await db.from("students").insert({
          school_id: sid, class_id: c.id, admission_no: `DEMO/${String(n).padStart(3, "0")}`,
          first_name: f, last_name: l, gender: n % 2 ? "female" : "male",
        }).select("id").single();
        const { data: p } = await db.from("parents").insert({ school_id: sid, full_name: `Mr/Mrs ${l}`, phone: `0809000${String(n).padStart(4, "0")}` }).select("id").single();
        if (st && p) await db.from("student_parents").insert({ student_id: st.id, parent_id: p.id, is_primary: true });
        if (st) {
          await db.from("assessments").insert((subs ?? []).map((s) => ({
            school_id: sid, class_id: c.id, student_id: st.id, subject_id: s.id, session: "2025/2026", term: "first" as const,
            ca1: 10 + Math.floor(Math.random() * 10), ca2: 10 + Math.floor(Math.random() * 10), exam: 25 + Math.floor(Math.random() * 35),
          })));
          await db.from("attendance").insert({ school_id: sid, class_id: c.id, student_id: st.id, date: new Date().toISOString().slice(0, 10), status: n % 5 ? "present" : "absent" });
        }
        n++;
      }
    }
  }

  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  let user = list?.users.find((u) => u.email === DEMO_EMAIL);
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({ email: DEMO_EMAIL, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { full_name: "Demo Administrator" } });
    if (error) throw new Error(error.message);
    user = data.user;
  }
  await db.from("profiles").upsert({ user_id: user.id, full_name: "Demo Administrator", school_id: school.id }, { onConflict: "user_id" });
  const { data: role } = await db.from("user_roles").select("id").eq("user_id", user.id).eq("role", "school_admin").maybeSingle();
  if (!role) await db.from("user_roles").insert({ user_id: user.id, role: "school_admin", school_id: school.id });

  return { email: DEMO_EMAIL, password: DEMO_PASSWORD };
});
