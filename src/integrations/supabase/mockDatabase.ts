// In-browser persistent mock database for Result Arena School ERP
// Emulates Supabase PostgREST and Storage when remote Supabase credentials are not supplied.

const STORAGE_PREFIX = "eduerp_db_v2_";

export interface MockStore {
  [table: string]: Record<string, any>[];
}

const DEFAULT_SCHOOL_ID = "22222222-2222-2222-2222-222222222222";
const ADMIN_USER_ID = "00000000-0000-0000-0000-000000000001";

export const SEED_DATA: MockStore = {
  schools: [
    {
      id: DEFAULT_SCHOOL_ID,
      name: "Result Arena Academy, Daura",
      code: "RAA-101",
      address: "No. 14 Katsina Road, Daura, Katsina State, Nigeria",
      phone: "+234 803 123 4567",
      email: "info@resultarena.sch.ng",
      motto: "Excellence in Knowledge & Character",
      current_session: "2025/2026",
      current_term: "first",
      theme_color: "#0a6d3b",
      principal_name: "Mustapha Dauda Adamu",
      website: "https://resultarena.sch.ng",
      branch_name: "Main Campus (Daura)",
      created_at: "2026-01-01T08:00:00.000Z",
      updated_at: "2026-01-01T08:00:00.000Z",
    },
  ],
  profiles: [
    {
      id: "10000000-0000-0000-0000-000000000001",
      user_id: ADMIN_USER_ID,
      school_id: DEFAULT_SCHOOL_ID,
      full_name: "Mustapha Dauda Adamu",
      phone: "+234 803 123 4567",
      created_at: "2026-01-01T08:00:00.000Z",
      updated_at: "2026-01-01T08:00:00.000Z",
    },
  ],
  user_roles: [
    {
      id: "20000000-0000-0000-0000-000000000001",
      user_id: ADMIN_USER_ID,
      role: "super_admin",
      school_id: DEFAULT_SCHOOL_ID,
      created_at: "2026-01-01T08:00:00.000Z",
    },
    {
      id: "20000000-0000-0000-0000-000000000002",
      user_id: ADMIN_USER_ID,
      role: "school_admin",
      school_id: DEFAULT_SCHOOL_ID,
      created_at: "2026-01-01T08:00:00.000Z",
    },
  ],
  classes: [
    { id: "c1", school_id: DEFAULT_SCHOOL_ID, name: "JSS 1 Gold", level: "JSS 1", arm: "Gold", section: "secondary", created_at: "2026-01-01T08:00:00.000Z" },
    { id: "c2", school_id: DEFAULT_SCHOOL_ID, name: "JSS 2 Diamond", level: "JSS 2", arm: "Diamond", section: "secondary", created_at: "2026-01-01T08:00:00.000Z" },
    { id: "c3", school_id: DEFAULT_SCHOOL_ID, name: "JSS 3 Platinum", level: "JSS 3", arm: "Platinum", section: "secondary", created_at: "2026-01-01T08:00:00.000Z" },
    { id: "c4", school_id: DEFAULT_SCHOOL_ID, name: "SS 1 Science", level: "SS 1", arm: "Science", section: "secondary", created_at: "2026-01-01T08:00:00.000Z" },
    { id: "c5", school_id: DEFAULT_SCHOOL_ID, name: "SS 2 Commercial", level: "SS 2", arm: "Commercial", section: "secondary", created_at: "2026-01-01T08:00:00.000Z" },
    { id: "c6", school_id: DEFAULT_SCHOOL_ID, name: "SS 3 Arts", level: "SS 3", arm: "Arts", section: "secondary", created_at: "2026-01-01T08:00:00.000Z" },
  ],
  subjects: [
    { id: "sub1", school_id: DEFAULT_SCHOOL_ID, name: "English Language", code: "ENG", class_id: "c1", created_at: "2026-01-01T08:00:00.000Z" },
    { id: "sub2", school_id: DEFAULT_SCHOOL_ID, name: "Mathematics", code: "MTH", class_id: "c1", created_at: "2026-01-01T08:00:00.000Z" },
    { id: "sub3", school_id: DEFAULT_SCHOOL_ID, name: "Basic Science", code: "BSC", class_id: "c1", created_at: "2026-01-01T08:00:00.000Z" },
    { id: "sub4", school_id: DEFAULT_SCHOOL_ID, name: "Islamic Religious Studies", code: "IRS", class_id: "c1", created_at: "2026-01-01T08:00:00.000Z" },
    { id: "sub5", school_id: DEFAULT_SCHOOL_ID, name: "Civic Education", code: "CIV", class_id: "c1", created_at: "2026-01-01T08:00:00.000Z" },
    { id: "sub6", school_id: DEFAULT_SCHOOL_ID, name: "Agricultural Science", code: "AGR", class_id: "c1", created_at: "2026-01-01T08:00:00.000Z" },
  ],
  students: [
    {
      id: "st1",
      school_id: DEFAULT_SCHOOL_ID,
      admission_no: "ADM/2025/001",
      first_name: "Fatima",
      last_name: "Mustapha",
      middle_name: "Zahra",
      gender: "female",
      dob: "2011-04-12",
      class_id: "c1",
      state_of_origin: "Katsina",
      address: "Sabon Gari, Daura",
      created_at: "2026-01-05T09:00:00.000Z",
    },
    {
      id: "st2",
      school_id: DEFAULT_SCHOOL_ID,
      admission_no: "ADM/2025/002",
      first_name: "Ibrahim",
      last_name: "Dauda",
      middle_name: "Adamu",
      gender: "male",
      dob: "2010-08-23",
      class_id: "c1",
      state_of_origin: "Katsina",
      address: "Kusugu Area, Daura",
      created_at: "2026-01-06T09:00:00.000Z",
    },
    {
      id: "st3",
      school_id: DEFAULT_SCHOOL_ID,
      admission_no: "ADM/2025/003",
      first_name: "Aisha",
      last_name: "Bello",
      middle_name: "Khadija",
      gender: "female",
      dob: "2009-11-05",
      class_id: "c4",
      state_of_origin: "Kaduna",
      address: "GRA, Daura",
      created_at: "2026-01-07T09:00:00.000Z",
    },
    {
      id: "st4",
      school_id: DEFAULT_SCHOOL_ID,
      admission_no: "ADM/2025/004",
      first_name: "Usman",
      last_name: "Sani",
      middle_name: "Kabir",
      gender: "male",
      dob: "2008-02-18",
      class_id: "c4",
      state_of_origin: "Kano",
      address: "Kano Road, Daura",
      created_at: "2026-01-08T09:00:00.000Z",
    },
  ],
  parents: [
    {
      id: "p1",
      school_id: DEFAULT_SCHOOL_ID,
      full_name: "Alhaji Mustapha Adamu",
      phone: "08031000001",
      email: "mustapha.adamu@example.ng",
      occupation: "Civil Servant",
      address: "Sabon Gari, Daura",
      created_at: "2026-01-05T09:00:00.000Z",
    },
  ],
  student_parents: [
    { id: "sp1", student_id: "st1", parent_id: "p1", is_primary: true },
    { id: "sp2", student_id: "st2", parent_id: "p1", is_primary: true },
  ],
  announcements: [
    {
      id: "ann1",
      school_id: DEFAULT_SCHOOL_ID,
      title: "First Term Resumption & Academic Calendar",
      content: "All students and teachers are warmly welcomed to the 2025/2026 academic year. Mid-term assessments begin next month.",
      target_role: "all",
      created_at: "2026-01-10T10:00:00.000Z",
    },
  ],
};

// Memory fallback for SSR/server environments
const serverMemoryStore: MockStore = {};

function getStoreTable(table: string): Record<string, any>[] {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + table);
      if (stored) {
        return JSON.parse(stored);
      }
      // If table has initial seed data, seed it into localStorage now
      if (SEED_DATA[table]) {
        localStorage.setItem(STORAGE_PREFIX + table, JSON.stringify(SEED_DATA[table]));
        return [...SEED_DATA[table]];
      }
      return [];
    } catch {
      return SEED_DATA[table] ? [...SEED_DATA[table]] : [];
    }
  }

  // Server memory
  if (!serverMemoryStore[table]) {
    serverMemoryStore[table] = SEED_DATA[table] ? JSON.parse(JSON.stringify(SEED_DATA[table])) : [];
  }
  return serverMemoryStore[table];
}

function saveStoreTable(table: string, items: Record<string, any>[]) {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.setItem(STORAGE_PREFIX + table, JSON.stringify(items));
      // Dispatch a storage event so sibling components or windows react immediately
      window.dispatchEvent(new CustomEvent("eduerp-db-change", { detail: { table } }));
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }
  } else {
    serverMemoryStore[table] = items;
  }
}

// Generate random UUID
function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Match single filter expression against a record
function matchesFilter(record: Record<string, any>, key: string, val: string): boolean {
  if (!val) return true;

  // Handle logical OR
  if (key === "or") {
    // format: (col1.eq.val1,col2.eq.val2)
    const clean = val.replace(/^\(|\)$/g, "");
    const parts = clean.split(",");
    return parts.some((p) => {
      const dot1 = p.indexOf(".");
      if (dot1 < 0) return false;
      const col = p.slice(0, dot1);
      const rest = p.slice(dot1 + 1);
      return matchesFilter(record, col, rest);
    });
  }

  const recVal = record[key];

  // eq.
  if (val.startsWith("eq.")) {
    const target = val.slice(3);
    if (target === "null") return recVal === null || recVal === undefined;
    if (target === "true") return recVal === true || recVal === "true";
    if (target === "false") return recVal === false || recVal === "false";
    return String(recVal ?? "").toLowerCase() === target.toLowerCase();
  }

  // neq.
  if (val.startsWith("neq.")) {
    const target = val.slice(4);
    if (target === "null") return recVal !== null && recVal !== undefined;
    return String(recVal ?? "").toLowerCase() !== target.toLowerCase();
  }

  // is.
  if (val.startsWith("is.")) {
    const target = val.slice(3);
    if (target === "null") return recVal === null || recVal === undefined;
    if (target === "not.null") return recVal !== null && recVal !== undefined;
    if (target === "true") return Boolean(recVal) === true;
    if (target === "false") return Boolean(recVal) === false;
    return String(recVal) === target;
  }

  // in.
  if (val.startsWith("in.")) {
    const raw = val.slice(3).replace(/^\(|\)$/g, "");
    const list = raw.split(",").map((s) => s.trim().replace(/^"|"$/g, "").toLowerCase());
    return list.includes(String(recVal ?? "").toLowerCase());
  }

  // ilike.
  if (val.startsWith("ilike.")) {
    const raw = val.slice(6).replace(/%/g, "").toLowerCase();
    return String(recVal ?? "").toLowerCase().includes(raw);
  }

  // like.
  if (val.startsWith("like.")) {
    const raw = val.slice(5).replace(/%/g, "");
    return String(recVal ?? "").includes(raw);
  }

  // gte, lte, gt, lt
  if (val.startsWith("gte.")) return Number(recVal) >= Number(val.slice(4));
  if (val.startsWith("lte.")) return Number(recVal) <= Number(val.slice(4));
  if (val.startsWith("gt.")) return Number(recVal) > Number(val.slice(3));
  if (val.startsWith("lt.")) return Number(recVal) < Number(val.slice(3));

  return true;
}

// Attach embedded foreign records (like classes(name), students(admission_no), etc.)
function attachRelations(table: string, records: Record<string, any>[], selectParam: string): Record<string, any>[] {
  if (!selectParam) return records;

  return records.map((rec) => {
    const cloned = { ...rec };

    // Joins for students: classes(name)
    if (table === "students" || table === "subjects") {
      if (selectParam.includes("classes")) {
        const classTable = getStoreTable("classes");
        const match = classTable.find((c) => c.id === rec.class_id);
        cloned.classes = match ? { name: match.name, level: match.level, arm: match.arm } : null;
      }
    }

    // Joins for assessments / report_cards: students(...)
    if (table === "assessments" || table === "report_cards") {
      if (selectParam.includes("students")) {
        const studentTable = getStoreTable("students");
        const match = studentTable.find((s) => s.id === rec.student_id);
        cloned.students = match || null;
      }
      if (selectParam.includes("subjects")) {
        const subjectTable = getStoreTable("subjects");
        const match = subjectTable.find((s) => s.id === rec.subject_id);
        cloned.subjects = match || null;
      }
      if (selectParam.includes("schools")) {
        const schoolTable = getStoreTable("schools");
        const match = schoolTable.find((s) => s.id === rec.school_id);
        cloned.schools = match || null;
      }
    }

    return cloned;
  });
}

/**
 * Intercepts Supabase requests and executes them against the in-browser mock database.
 */
export async function mockPostgrestFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const parsed = new URL(urlStr, "https://placeholder.supabase.co");
  const pathname = parsed.pathname;
  const method = (init?.method || "GET").toUpperCase();

  const headers = new Headers(init?.headers);
  const accept = headers.get("Accept") || "";
  const wantsSingleObject = accept.includes("application/vnd.pgrst.object+json");

  // 1. Storage uploads
  if (pathname.startsWith("/storage/v1/object/")) {
    const path = pathname.replace("/storage/v1/object/", "");
    return new Response(
      JSON.stringify({ Key: path, Id: path }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // 2. Storage public URL or assets
  if (pathname.startsWith("/storage/v1/object/public/")) {
    return new Response(new Blob([]), { status: 200, headers: { "Content-Type": "image/png" } });
  }

  // 3. Auth calls
  if (pathname.startsWith("/auth/v1/")) {
    if (pathname.includes("/user") || pathname.includes("/token")) {
      const user = {
        id: ADMIN_USER_ID,
        email: "mustydawuddaura@gmail.com",
        user_metadata: { full_name: "Mustapha Dauda Adamu", role: "super_admin" },
        role: "authenticated",
        aud: "authenticated",
        created_at: "2026-01-01T00:00:00.000Z",
      };
      return new Response(
        JSON.stringify({ user, access_token: "mock-token", token_type: "bearer" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  }

  // 4. RPC Functions
  if (pathname.startsWith("/rest/v1/rpc/")) {
    const funcName = pathname.replace("/rest/v1/rpc/", "");
    if (funcName === "school_permission" || funcName === "has_role" || funcName === "is_super_admin" || funcName === "is_school_staff") {
      return new Response(JSON.stringify(true), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (funcName === "get_user_school") {
      return new Response(JSON.stringify(DEFAULT_SCHOOL_ID), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (funcName === "compute_grade") {
      return new Response(JSON.stringify({ grade: "A", remark: "Excellent" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (funcName === "find_parent_by_phone") {
      const parents = getStoreTable("parents");
      return new Response(JSON.stringify(parents[0] || null), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (funcName === "verify_report_card") {
      return new Response(
        JSON.stringify([
          {
            student_name: "Fatima Mustapha",
            admission_no: "ADM/2025/001",
            class_name: "JSS 1 Gold",
            session: "2025/2026",
            term: "first",
            total_score: 85,
            average: 85.0,
            position: 1,
            school_name: "Result Arena Academy, Daura",
            published: true,
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response("true", { status: 200, headers: { "Content-Type": "application/json" } });
  }

  // 5. REST Tables
  if (!pathname.startsWith("/rest/v1/")) {
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const table = pathname.replace("/rest/v1/", "").trim();
  if (!table) {
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  }

  let tableRows = getStoreTable(table);

  // Filter params
  const filterEntries: [string, string][] = [];
  let orderParam: string | null = null;
  let selectParam: string = "*";
  let limitParam: number | null = null;
  let offsetParam: number = 0;

  for (const [key, val] of parsed.searchParams.entries()) {
    if (key === "select") {
      selectParam = val;
    } else if (key === "order") {
      orderParam = val;
    } else if (key === "limit") {
      limitParam = parseInt(val, 10);
    } else if (key === "offset") {
      offsetParam = parseInt(val, 10);
    } else if (key !== "columns") {
      filterEntries.push([key, val]);
    }
  }

  // Handle HEAD request (e.g. { count: "exact", head: true })
  if (method === "HEAD") {
    const matched = tableRows.filter((r) => filterEntries.every(([k, v]) => matchesFilter(r, k, v)));
    return new Response(null, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "content-range": `*/${matched.length}`,
      },
    });
  }

  // Handle GET request
  if (method === "GET") {
    let results = tableRows.filter((r) => filterEntries.every(([k, v]) => matchesFilter(r, k, v)));

    // Order
    if (orderParam) {
      const [col, dir] = orderParam.split(".");
      const desc = dir === "desc";
      results.sort((a, b) => {
        const valA = a[col];
        const valB = b[col];
        if (valA === valB) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;
        if (valA < valB) return desc ? 1 : -1;
        return desc ? -1 : 1;
      });
    }

    // Offset / Limit
    if (offsetParam > 0) results = results.slice(offsetParam);
    if (limitParam !== null && !isNaN(limitParam)) results = results.slice(0, limitParam);

    // Attach relational embeddings (e.g. classes(name))
    results = attachRelations(table, results, selectParam);

    // If single object requested via .single() or .maybeSingle()
    if (wantsSingleObject) {
      if (results.length === 0) {
        return new Response(
          JSON.stringify({
            code: "PGRST116",
            message: "JSON object requested, multiple (or no) rows returned",
            details: "The result contains 0 rows",
          }),
          {
            status: 406,
            headers: {
              "Content-Type": "application/json",
              "content-range": `*/0`,
            },
          }
        );
      }
      return new Response(JSON.stringify(results[0]), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "content-range": `0-0/1`,
        },
      });
    }

    const rangeHeader = results.length > 0 ? `0-${results.length - 1}/${results.length}` : "*/0";
    return new Response(JSON.stringify(results), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "content-range": rangeHeader,
      },
    });
  }

  // Handle POST (insert)
  if (method === "POST") {
    let bodyData: any = {};
    try {
      if (typeof init?.body === "string") {
        bodyData = JSON.parse(init.body);
      }
    } catch (e) {
      console.warn("Could not parse POST body:", e);
    }

    const itemsToInsert: Record<string, any>[] = Array.isArray(bodyData) ? bodyData : [bodyData];
    const now = new Date().toISOString();

    const inserted: Record<string, any>[] = itemsToInsert.map((item) => ({
      ...item,
      id: item.id || generateUUID(),
      created_at: item.created_at || now,
      updated_at: item.updated_at || now,
    }));

    tableRows.unshift(...inserted);
    saveStoreTable(table, tableRows);

    if (wantsSingleObject && inserted.length > 0) {
      return new Response(JSON.stringify(inserted[0]), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(inserted), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Handle PATCH (update)
  if (method === "PATCH") {
    let updateData: any = {};
    try {
      if (typeof init?.body === "string") {
        updateData = JSON.parse(init.body);
      }
    } catch (e) {
      console.warn("Could not parse PATCH body:", e);
    }

    const now = new Date().toISOString();
    const updated: Record<string, any>[] = [];

    tableRows = tableRows.map((row) => {
      if (filterEntries.every(([k, v]) => matchesFilter(row, k, v))) {
        const merged = { ...row, ...updateData, updated_at: now };
        updated.push(merged);
        return merged;
      }
      return row;
    });

    saveStoreTable(table, tableRows);

    if (wantsSingleObject && updated.length > 0) {
      return new Response(JSON.stringify(updated[0]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Handle DELETE
  if (method === "DELETE") {
    const deleted: Record<string, any>[] = [];
    tableRows = tableRows.filter((row) => {
      const match = filterEntries.every(([k, v]) => matchesFilter(row, k, v));
      if (match) deleted.push(row);
      return !match;
    });

    saveStoreTable(table, tableRows);

    return new Response(JSON.stringify(deleted), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
}
