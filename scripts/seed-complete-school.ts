import { supabaseAdmin } from "../src/integrations/supabase/client.server";

const SCHOOL_ID = "af91ff67-95eb-4b62-93a0-5617d23a2f1d";
const DEMO_EMAIL = "demo.admin@eduerp-demo.ng";
const DEMO_PASSWORD = "DemoSchool#2026";
const SESSION = "2025/2026";
const TERMS = ["first", "second", "third"] as const;

async function seedCompleteSchool() {
  console.log("Starting complete Alegacy school database seeding...");

  // 1. Authenticate demo admin to get an authorized JWT
  const { data: authData, error: authErr } = await supabaseAdmin.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (authErr || !authData.session) {
    throw new Error("Failed to sign in demo admin: " + authErr?.message);
  }
  const token = authData.session.access_token;
  const adminUserId = authData.user.id;

  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  // 2. Ensure School Profile is complete with Alegacy details
  await client
    .from("schools")
    .update({
      name: "Alegacy International College",
      code: "ALEGACY",
      address: "Plot 104, Independence Avenue, Central Business District, Abuja, FCT",
      phone: "+234 803 555 0199",
      email: "info@alegacy.sch.ng",
      motto: "Excellence, Character and Innovation",
      website: "https://alegacy.sch.ng",
      principal_name: "Dr. Aliyu Mohammed Bello (Ph.D)",
      current_session: SESSION,
      current_term: "third",
      branch_name: "Main Campus (Abuja)",
      theme_color: "#0a6d3b",
    })
    .eq("id", SCHOOL_ID);

  console.log("✓ School profile updated to Alegacy International College");

  // 3. Classes across Primary, Junior Secondary (JSS), and Senior Secondary (SSS)
  const classesData = [
    { name: "Primary 1 Gold", level: "Primary", arm: "Gold", section: "primary" },
    { name: "Primary 2 Gold", level: "Primary", arm: "Gold", section: "primary" },
    { name: "Primary 3 Gold", level: "Primary", arm: "Gold", section: "primary" },
    { name: "Primary 4 Gold", level: "Primary", arm: "Gold", section: "primary" },
    { name: "Primary 5 Gold", level: "Primary", arm: "Gold", section: "primary" },
    { name: "Primary 6 Gold", level: "Primary", arm: "Gold", section: "primary" },
    { name: "JSS 1 Diamond", level: "JSS 1", arm: "Diamond", section: "junior_secondary" },
    { name: "JSS 2 Diamond", level: "JSS 2", arm: "Diamond", section: "junior_secondary" },
    { name: "JSS 3 Diamond", level: "JSS 3", arm: "Diamond", section: "junior_secondary" },
    { name: "SS 1 Science", level: "SSS 1", arm: "Science", section: "senior_secondary" },
    { name: "SS 2 Science", level: "SSS 2", arm: "Science", section: "senior_secondary" },
    { name: "SS 3 Science", level: "SSS 3", arm: "Science", section: "senior_secondary" },
  ];

  const classMap = new Map<string, string>();
  for (const c of classesData) {
    const { data: existing } = await client
      .from("classes")
      .select("id")
      .eq("school_id", SCHOOL_ID)
      .eq("name", c.name)
      .maybeSingle();

    if (existing) {
      classMap.set(c.name, existing.id);
    } else {
      const { data: inserted } = await client
        .from("classes")
        .insert({ school_id: SCHOOL_ID, ...c })
        .select()
        .single();
      if (inserted) classMap.set(c.name, inserted.id);
    }
  }
  console.log(`✓ Seeded ${classMap.size} classes`);

  // 4. Subjects
  const subjectsData = [
    { name: "Mathematics", code: "MTH" },
    { name: "English Language", code: "ENG" },
    { name: "Basic Science & Technology", code: "BST" },
    { name: "Civic Education & National Values", code: "CIV" },
    { name: "Islamic Studies / CRK", code: "IRS" },
    { name: "Computer Studies / ICT", code: "ICT" },
    { name: "Physics", code: "PHY" },
    { name: "Chemistry", code: "CHM" },
    { name: "Biology", code: "BIO" },
    { name: "Agricultural Science", code: "AGR" },
    { name: "Economics", code: "ECO" },
    { name: "Literature in English", code: "LIT" },
  ];

  const subjectMap = new Map<string, string>();
  for (const s of subjectsData) {
    const { data: existing } = await client
      .from("subjects")
      .select("id")
      .eq("school_id", SCHOOL_ID)
      .eq("name", s.name)
      .maybeSingle();

    if (existing) {
      subjectMap.set(s.name, existing.id);
    } else {
      const { data: inserted } = await client
        .from("subjects")
        .insert({ school_id: SCHOOL_ID, name: s.name, code: s.code })
        .select()
        .single();
      if (inserted) subjectMap.set(s.name, inserted.id);
    }
  }
  console.log(`✓ Seeded ${subjectMap.size} core subjects`);

  // 5. Parents (including Hauwa Bello for Parent Portal login)
  const parentsData = [
    { full_name: "Mrs. Hauwa Bello", phone: "08031000001", email: "hauwa.bello@example.com", occupation: "Senior Civil Servant", address: "Gwarinpa Estate, Abuja" },
    { full_name: "Alhaji Ibrahim Adeleke", phone: "08031234567", email: "adeleke.ibrahim@example.com", occupation: "Architect", address: "Maitama District, Abuja" },
    { full_name: "Dr. Ngozi Okonjo-Eze", phone: "08039876543", email: "ngozi.eze@example.com", occupation: "Physician", address: "Asokoro Extension, Abuja" },
    { full_name: "Barrister Babatunde Fashola", phone: "08023456789", email: "babatunde@example.com", occupation: "Legal Practitioner", address: "Wuse 2, Abuja" },
    { full_name: "Engr. Musa Danladi", phone: "08055512345", email: "musa.danladi@example.com", occupation: "Petroleum Engineer", address: "Jabi Lake, Abuja" },
  ];

  const parentMap = new Map<string, string>();
  for (const p of parentsData) {
    const { data: existing } = await client
      .from("parents")
      .select("id")
      .eq("school_id", SCHOOL_ID)
      .eq("phone", p.phone)
      .maybeSingle();

    if (existing) {
      parentMap.set(p.phone, existing.id);
    } else {
      const { data: inserted } = await client
        .from("parents")
        .insert({ school_id: SCHOOL_ID, ...p })
        .select()
        .single();
      if (inserted) parentMap.set(p.phone, inserted.id);
    }
  }
  console.log(`✓ Seeded ${parentMap.size} parents with phone authentication`);

  // 6. Students across classes
  const jss1Id = classMap.get("JSS 1 Diamond")!;
  const pri5Id = classMap.get("Primary 5 Gold")!;
  const ss1Id = classMap.get("SS 1 Science")!;
  const ss2Id = classMap.get("SS 2 Science")!;

  const studentsData = [
    {
      admission_no: "ALG/2025/001",
      first_name: "Zainab",
      middle_name: "Khadija",
      last_name: "Bello",
      gender: "female" as const,
      dob: "2014-06-12",
      class_id: pri5Id,
      parentPhone: "08031000001",
      house: "Emerald House",
    },
    {
      admission_no: "ALG/2025/002",
      first_name: "Farouk",
      middle_name: "Ahmed",
      last_name: "Bello",
      gender: "male" as const,
      dob: "2012-09-20",
      class_id: jss1Id,
      parentPhone: "08031000001",
      house: "Emerald House",
    },
    {
      admission_no: "ALG/2025/003",
      first_name: "Chukwudi",
      middle_name: "Ibrahim",
      last_name: "Adeleke",
      gender: "male" as const,
      dob: "2010-04-15",
      class_id: ss1Id,
      parentPhone: "08031234567",
      house: "Ruby House",
    },
    {
      admission_no: "ALG/2025/004",
      first_name: "Chiamaka",
      middle_name: "Grace",
      last_name: "Eze",
      gender: "female" as const,
      dob: "2011-08-25",
      class_id: jss1Id,
      parentPhone: "08039876543",
      house: "Sapphire House",
    },
    {
      admission_no: "ALG/2025/005",
      first_name: "Aisha",
      middle_name: "Fatima",
      last_name: "Danladi",
      gender: "female" as const,
      dob: "2009-11-03",
      class_id: ss2Id,
      parentPhone: "08055512345",
      house: "Diamond House",
    },
  ];

  const studentList: any[] = [];
  for (const s of studentsData) {
    const { parentPhone, ...stInfo } = s;
    const { data: existing } = await client
      .from("students")
      .select("id, admission_no, first_name, last_name, class_id")
      .eq("school_id", SCHOOL_ID)
      .eq("admission_no", s.admission_no)
      .maybeSingle();

    let studentId = existing?.id;
    if (!studentId) {
      const { data: inserted } = await client
        .from("students")
        .insert({ school_id: SCHOOL_ID, ...stInfo })
        .select()
        .single();
      studentId = inserted?.id;
      studentList.push(inserted);
    } else {
      studentList.push(existing);
    }

    // Link parent
    const parentId = parentMap.get(parentPhone);
    if (studentId && parentId) {
      await client
        .from("student_parents")
        .upsert(
          { student_id: studentId, parent_id: parentId, is_primary: true, relationship: "Mother / Father" },
          { onConflict: "student_id,parent_id" }
        );
    }
  }
  console.log(`✓ Seeded ${studentList.length} students with family linkages`);

  // 7. Attendance Registers (Past 30 School Days across terms)
  const today = new Date();
  const attendanceInserts: any[] = [];
  for (let i = 0; i < 40; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekends

    const dateStr = d.toISOString().slice(0, 10);
    for (const st of studentList) {
      const isLate = (i % 7 === 0);
      const isAbsent = (i % 17 === 0);
      attendanceInserts.push({
        school_id: SCHOOL_ID,
        student_id: st.id,
        class_id: st.class_id,
        date: dateStr,
        status: isAbsent ? "absent" : isLate ? "late" : "present",
        note: isAbsent ? "Medical excuse on file" : isLate ? "Heavy traffic along Express" : "Punctual",
        marked_by: adminUserId,
      });
    }
  }

  // Batch insert attendance with upsert
  for (let chunk = 0; chunk < attendanceInserts.length; chunk += 50) {
    await client
      .from("attendance")
      .upsert(attendanceInserts.slice(chunk, chunk + 50), { onConflict: "student_id,date" });
  }
  console.log(`✓ Seeded ${attendanceInserts.length} daily attendance register entries`);

  // 8. Complete 3-Term Continuous Assessments (CA1 20%, CA2 20%, Exam 60%)
  const coreSubjects = Array.from(subjectMap.entries()).slice(0, 8); // 8 subjects per student
  const assessmentInserts: any[] = [];

  for (const term of TERMS) {
    for (const st of studentList) {
      for (const [subjName, subjId] of coreSubjects) {
        // Deterministic realistic high-school Nigerian scores
        const seed = st.first_name.charCodeAt(0) + subjName.length + (term === "first" ? 1 : term === "second" ? 2 : 3);
        const ca1 = 14 + (seed % 6); // 14 - 19 / 20
        const ca2 = 15 + ((seed * 3) % 5); // 15 - 19 / 20
        const exam = 42 + ((seed * 7) % 17); // 42 - 58 / 60
        const total = ca1 + ca2 + exam; // 71 - 96

        const grade = total >= 75 ? "A1" : total >= 70 ? "B2" : total >= 65 ? "B3" : total >= 60 ? "C4" : total >= 55 ? "C5" : "C6";
        const remark = total >= 75 ? "Distinction" : total >= 65 ? "Very Good" : "Credit";

        assessmentInserts.push({
          school_id: SCHOOL_ID,
          student_id: st.id,
          class_id: st.class_id,
          subject_id: subjId,
          session: SESSION,
          term: term,
          ca1,
          ca2,
          exam,
          grade,
          remark,
          status: "approved",
          teacher_id: adminUserId,
        });
      }
    }
  }

  for (let chunk = 0; chunk < assessmentInserts.length; chunk += 50) {
    await client
      .from("assessments")
      .upsert(assessmentInserts.slice(chunk, chunk + 50), {
        onConflict: "student_id,subject_id,session,term",
      });
  }
  console.log(`✓ Seeded ${assessmentInserts.length} subject assessment records across all 3 terms`);

  // 9. Published Terminal Report Cards with Positions & Remarks for 3 Terms
  for (const term of TERMS) {
    for (let idx = 0; idx < studentList.length; idx++) {
      const st = studentList[idx];
      const position = idx + 1;
      const average = Number((86.5 - idx * 2.8 + (term === "third" ? 3.2 : term === "second" ? 1.5 : 0)).toFixed(1));
      const totalScore = Math.round(average * 8);

      await client
        .from("report_cards")
        .upsert(
          {
            school_id: SCHOOL_ID,
            student_id: st.id,
            session: SESSION,
            term: term,
            class_id: st.class_id,
            class_size: studentList.length + 15,
            position,
            total_score: totalScore,
            average,
            gpa: Number((average / 20).toFixed(2)),
            days_present: 58,
            days_absent: 2,
            days_total: 60,
            principal_remark:
              average >= 80
                ? "An outstanding performance this term. Consistently demonstrates disciplined scholarship and leadership."
                : "Good academic progress. Maintain focus and strive for higher distinction next term.",
            teacher_remark: "Diligent, courteous and active in class discussions and practical projects.",
            next_resumption_date: "2026-09-14",
            published: true,
          },
          { onConflict: "student_id,session,term" }
        );
    }
  }
  console.log(`✓ Generated and published all 3-term report cards with averages and class positions`);

  // 10. Nigerian Fee Structure Items & Student Invoices
  const feeItemsData = [
    { name: "Termly Tuition Fee", amount: 85000, term: "third" as const },
    { name: "PTA Development Levy", amount: 10000, term: "third" as const },
    { name: "School Uniforms & Sportswear", amount: 25000, term: "third" as const },
    { name: "Textbooks & Stationery Pack", amount: 30000, term: "third" as const },
    { name: "ICT & Computer Laboratory Levy", amount: 15000, term: "third" as const },
  ];

  for (const fi of feeItemsData) {
    let feeItemId: string | undefined;
    const { data: exFi } = await client
      .from("fee_items")
      .select("id")
      .eq("school_id", SCHOOL_ID)
      .eq("name", fi.name)
      .eq("session", SESSION)
      .eq("term", fi.term)
      .maybeSingle();

    if (exFi) {
      feeItemId = exFi.id;
    } else {
      const { data: newFi } = await client
        .from("fee_items")
        .insert({
          school_id: SCHOOL_ID,
          name: fi.name,
          amount: fi.amount,
          session: SESSION,
          term: fi.term,
          active: true,
        })
        .select()
        .single();
      feeItemId = newFi?.id;
    }

    // Create an invoice for each student
    for (const st of studentList) {
      const { data: exInv } = await client
        .from("fee_invoices")
        .select("id")
        .eq("school_id", SCHOOL_ID)
        .eq("student_id", st.id)
        .eq("title", fi.name)
        .eq("session", SESSION)
        .eq("term", fi.term)
        .maybeSingle();

      if (!exInv && feeItemId) {
        const isPaid = (st.admission_no === "ALG/2025/001" && fi.name.includes("Tuition"));
        const paidAmount = isPaid ? fi.amount : 0;
        await client.from("fee_invoices").insert({
          school_id: SCHOOL_ID,
          student_id: st.id,
          fee_item_id: feeItemId,
          title: fi.name,
          session: SESSION,
          term: fi.term,
          amount_due: fi.amount,
          amount_paid: paidAmount,
          status: isPaid ? "paid" : "unpaid",
          due_date: "2026-06-30",
        });
      }
    }
  }
  console.log(`✓ Seeded fee items, tuition, PTA, uniform invoices and payment statuses`);

  // 11. Parent Notifications
  for (const p of parentsData) {
    const pId = parentMap.get(p.phone);
    if (!pId) continue;

    await client.from("parent_notifications").insert([
      {
        school_id: SCHOOL_ID,
        parent_id: pId,
        title: "Third Term Terminal Report Cards Published",
        body: "Dear Parent, the third term academic results and cumulative broadsheets for 2025/2026 session have been verified and officially published. You can view and download the official report card under the Reports tab.",
        type: "news",
        meta: { session: SESSION, term: "third" },
        visible_from: new Date().toISOString(),
      },
      {
        school_id: SCHOOL_ID,
        parent_id: pId,
        title: "Dedicated Virtual Account Activated",
        body: "Your child has been assigned an automated Wema Bank / Providus NUBAN virtual account for instant fee clearance and automatic receipt generation.",
        type: "general",
        meta: { channel: "whatsapp" },
        visible_from: new Date().toISOString(),
      },
    ]);
  }
  console.log("✓ Dispatched parent notifications and announcements");

  console.log("=================================================");
  console.log("SUCCESS: Complete Alegacy School Database Seeded!");
  console.log("Demo Admin Email: demo.admin@eduerp-demo.ng");
  console.log("Demo Parent Phone: 08031000001 (Mrs. Hauwa Bello - Zainab & Farouk)");
  console.log("=================================================");
}

seedCompleteSchool().catch((err) => {
  console.error("Seeding error:", err);
  process.exit(1);
});
