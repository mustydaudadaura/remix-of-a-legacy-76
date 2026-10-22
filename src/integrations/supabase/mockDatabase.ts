// In-memory & browser-persistent mock data provider for Supabase Auth and PostgREST.
// Ensures Super Admin, Demo Admin, school administrators, and students/parents can authenticate
// and interact with the platform seamlessly even when remote Supabase credentials are not configured.

function safeBtoa(str: string): string {
  if (typeof btoa !== "undefined") {
    return btoa(unescape(encodeURIComponent(str)));
  }
  return Buffer.from(str, "utf8").toString("base64");
}

function safeAtob(b64: string): string {
  if (typeof atob !== "undefined") {
    return decodeURIComponent(escape(atob(b64)));
  }
  return Buffer.from(b64, "base64").toString("utf8");
}

function makeBase64Url(obj: any): string {
  return safeBtoa(JSON.stringify(obj))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeBase64Url(str: string): any {
  try {
    let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    return JSON.parse(safeAtob(b64));
  } catch {
    return {};
  }
}

function generateMockJwt(userId: string, email: string, roles: string[], fullName: string) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600 * 24 * 365; // 1 year validity
  const header = makeBase64Url({ alg: "HS256", typ: "JWT" });
  const payload = makeBase64Url({
    sub: userId,
    email,
    role: "authenticated",
    exp,
    app_metadata: { provider: "email", roles },
    user_metadata: { full_name: fullName },
  });
  const sig = makeBase64Url({ s: "mock-sig" });
  return { token: `${header}.${payload}.${sig}`, exp };
}

// Initial mock dataset
const DEFAULT_SCHOOLS = [
  {
    id: "af91ff67-95eb-4b62-93a0-5617d23a2f1d",
    name: "Al-Huda International Academy",
    code: "HGA-001",
    address: "Plot 12, Education Zone, Katsina",
    phone: "08031234567",
    email: "admin@alhuda.edu.ng",
    motto: "Excellence in Knowledge & Character",
    current_session: "2025/2026",
    created_at: "2025-01-10T00:00:00Z",
    logo_url: null,
    stamp_url: null,
    website: "https://alhuda.edu.ng",
    principal_name: "Hajiya Maryam Sani",
    branch_name: "Main Campus",
  },
];

const DEFAULT_PROFILES = [
  {
    id: "p-super-admin",
    user_id: "super-admin-musty-daura",
    email: "mustydawuddaura@gmail.com",
    full_name: "Musty Dawud Daura",
    school_id: "af91ff67-95eb-4b62-93a0-5617d23a2f1d",
    created_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "p-demo-admin",
    user_id: "00000000-0000-0000-0000-000000000001",
    email: "demo.admin@eduerp-demo.ng",
    full_name: "Hajiya Maryam Sani",
    school_id: "af91ff67-95eb-4b62-93a0-5617d23a2f1d",
    created_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "p-teacher-ibrahim",
    user_id: "teacher-user-ibrahim",
    email: "ibrahim.lawal@alhuda.edu.ng",
    full_name: "Mallam Ibrahim Lawal",
    school_id: "af91ff67-95eb-4b62-93a0-5617d23a2f1d",
    created_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "p-accountant-aisha",
    user_id: "accountant-user-aisha",
    email: "bursar.aisha@alhuda.edu.ng",
    full_name: "Aisha Bello",
    school_id: "af91ff67-95eb-4b62-93a0-5617d23a2f1d",
    created_at: "2025-01-01T00:00:00Z",
  },
];

const DEFAULT_USER_ROLES = [
  {
    id: "ur-super-admin",
    user_id: "super-admin-musty-daura",
    role: "super_admin",
    school_id: null,
  },
  {
    id: "ur-demo-admin",
    user_id: "00000000-0000-0000-0000-000000000001",
    role: "school_admin",
    school_id: "af91ff67-95eb-4b62-93a0-5617d23a2f1d",
  },
  {
    id: "ur-teacher-ibrahim",
    user_id: "teacher-user-ibrahim",
    role: "teacher",
    school_id: "af91ff67-95eb-4b62-93a0-5617d23a2f1d",
  },
  {
    id: "ur-accountant-aisha",
    user_id: "accountant-user-aisha",
    role: "accountant",
    school_id: "af91ff67-95eb-4b62-93a0-5617d23a2f1d",
  },
];

function getStoredData<T>(key: string, fallback: T): T {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(`eduerp_db_${key}`);
      if (stored) return JSON.parse(stored);
    } catch {
      void 0;
    }
  }
  return fallback;
}

function setStoredData<T>(key: string, val: T): void {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(`eduerp_db_${key}`, JSON.stringify(val));
    } catch {
      void 0;
    }
  }
}

export async function mockPostgrestFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const urlStr = typeof input === "string" ? input : input.toString();
  const method = (init?.method || "GET").toUpperCase();

  // 1. Supabase Auth Token (Sign In with Password)
  if (urlStr.includes("/auth/v1/token")) {
    let body: any = {};
    try {
      body = init?.body ? JSON.parse(init.body as string) : {};
    } catch {
      void 0;
    }

    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    // Super Admin platform owner credentials
    if (email === "mustydawuddaura@gmail.com" && password === "Mustydawud@1994") {
      const { token, exp } = generateMockJwt(
        "super-admin-musty-daura",
        "mustydawuddaura@gmail.com",
        ["super_admin"],
        "Musty Dawud Daura"
      );

      return new Response(
        JSON.stringify({
          access_token: token,
          token_type: "bearer",
          expires_in: 31536000,
          expires_at: exp,
          refresh_token: "super-admin-refresh-token",
          user: {
            id: "super-admin-musty-daura",
            aud: "authenticated",
            role: "authenticated",
            email: "mustydawuddaura@gmail.com",
            email_confirmed_at: "2025-01-01T00:00:00Z",
            phone: "",
            user_metadata: { full_name: "Musty Dawud Daura" },
            app_metadata: { provider: "email", roles: ["super_admin"] },
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        code: "BACKEND_NOT_CONFIGURED",
        message: "The school service is not configured. No records were saved. Please contact the administrator.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  // 2. Supabase Auth Get User
  if (urlStr.includes("/auth/v1/user")) {
    const authHeader = (init?.headers as any)?.Authorization || (init?.headers as any)?.authorization || "";
    let email = "mustydawuddaura@gmail.com";
    let sub = "super-admin-musty-daura";
    let fullName = "Musty Dawud Daura";
    let roles = ["super_admin"];

    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = decodeBase64Url(parts[1]);
        if (payload.sub) sub = payload.sub;
        if (payload.email) email = payload.email;
        if (payload.user_metadata?.full_name) fullName = payload.user_metadata.full_name;
        if (payload.app_metadata?.roles) roles = payload.app_metadata.roles;
      }
    }

    return new Response(
      JSON.stringify({
        id: sub,
        aud: "authenticated",
        role: "authenticated",
        email,
        email_confirmed_at: "2025-01-01T00:00:00Z",
        phone: "",
        user_metadata: { full_name: fullName },
        app_metadata: { provider: "email", roles },
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // 3. Supabase Auth Logout
  if (urlStr.includes("/auth/v1/logout")) {
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  }

  // 4. Supabase RPC calls
  if (urlStr.includes("/rest/v1/rpc/")) {
    const authHeader = (init?.headers as any)?.Authorization || (init?.headers as any)?.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          code: "BACKEND_NOT_CONFIGURED",
          message: "The school service is not configured. No records were saved. Please contact the administrator.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response("true", { status: 200, headers: { "Content-Type": "application/json" } });
  }

  // 5. PostgREST Schools
  if (urlStr.includes("/rest/v1/schools")) {
    const schools = getStoredData("schools", DEFAULT_SCHOOLS);

    if (method === "POST") {
      const authHeader = (init?.headers as any)?.Authorization || (init?.headers as any)?.authorization || "";
      if (!authHeader.startsWith("Bearer ") && !init?.body) {
        return new Response(
          JSON.stringify({
            code: "BACKEND_NOT_CONFIGURED",
            message: "The school service is not configured. No records were saved. Please contact the administrator.",
          }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }
      let body: any = {};
      try {
        body = init?.body ? JSON.parse(init.body as string) : {};
      } catch {
        void 0;
      }
      const newSchool = {
        id: body.id || `school-${Date.now()}`,
        name: body.name || "New School",
        code: body.code || `SCH-${Math.floor(100 + Math.random() * 900)}`,
        address: body.address || null,
        phone: body.phone || null,
        email: body.email || null,
        motto: body.motto || null,
        current_session: body.current_session || "2025/2026",
        created_at: new Date().toISOString(),
        logo_url: body.logo_url || null,
        stamp_url: body.stamp_url || null,
        website: body.website || null,
        principal_name: body.principal_name || null,
        branch_name: body.branch_name || null,
      };
      schools.unshift(newSchool);
      setStoredData("schools", schools);
      return new Response(JSON.stringify(newSchool), {
        status: 201,
        headers: { "Content-Type": "application/json", "Content-Range": `0-0/${schools.length}` },
      });
    }

    if (method === "PATCH") {
      return new Response(JSON.stringify(schools[0]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Filter by id or code if in query
    let filtered = [...schools];
    const urlObj = new URL(urlStr, "https://placeholder.supabase.co");
    const codeEq = urlObj.searchParams.get("code");
    if (codeEq && codeEq.startsWith("eq.")) {
      const codeVal = codeEq.replace("eq.", "");
      filtered = filtered.filter((s) => s.code === codeVal);
    }
    const idEq = urlObj.searchParams.get("id");
    if (idEq && idEq.startsWith("eq.")) {
      const idVal = idEq.replace("eq.", "");
      filtered = filtered.filter((s) => s.id === idVal);
    }

    const isHead = method === "HEAD";
    return new Response(isHead ? null : JSON.stringify(filtered), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Range": `0-${Math.max(0, filtered.length - 1)}/${filtered.length}`,
      },
    });
  }

  // 6. PostgREST Profiles
  if (urlStr.includes("/rest/v1/profiles")) {
    const profiles = getStoredData("profiles", DEFAULT_PROFILES);
    let filtered = [...profiles];
    const urlObj = new URL(urlStr, "https://placeholder.supabase.co");
    const userEq = urlObj.searchParams.get("user_id");
    if (userEq && userEq.startsWith("eq.")) {
      const uVal = userEq.replace("eq.", "");
      filtered = filtered.filter((p) => p.user_id === uVal);
    }

    return new Response(JSON.stringify(filtered), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Range": `0-${Math.max(0, filtered.length - 1)}/${filtered.length}`,
      },
    });
  }

  // 7. PostgREST User Roles
  if (urlStr.includes("/rest/v1/user_roles")) {
    const roles = getStoredData("user_roles", DEFAULT_USER_ROLES);
    let filtered = [...roles];
    const urlObj = new URL(urlStr, "https://placeholder.supabase.co");
    const userEq = urlObj.searchParams.get("user_id");
    if (userEq && userEq.startsWith("eq.")) {
      const uVal = userEq.replace("eq.", "");
      filtered = filtered.filter((r) => r.user_id === uVal);
    }

    return new Response(JSON.stringify(filtered), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Range": `0-${Math.max(0, filtered.length - 1)}/${filtered.length}`,
      },
    });
  }

  // 8. PostgREST Stats queries (students, classes, assessments, etc.)
  if (
    urlStr.includes("/rest/v1/students") ||
    urlStr.includes("/rest/v1/classes") ||
    urlStr.includes("/rest/v1/assessments") ||
    urlStr.includes("/rest/v1/enrollments")
  ) {
    if (method === "POST") {
      return new Response(
        JSON.stringify({
          code: "BACKEND_NOT_CONFIGURED",
          message: "The school service is not configured. No records were saved. Please contact the administrator.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }
    const count = urlStr.includes("students") ? 48 : urlStr.includes("classes") ? 8 : 124;
    return new Response(method === "HEAD" ? null : JSON.stringify([]), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Range": `0-0/${count}`,
      },
    });
  }

  // Default empty JSON array with valid headers
  return new Response("[]", {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Range": "0-0/0",
    },
  });
}
