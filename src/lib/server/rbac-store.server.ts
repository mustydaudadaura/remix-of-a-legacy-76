import fs from "fs";
import path from "path";

export interface RegistrationCode {
  id: string;
  code: string;
  schoolId: string;
  schoolName: string;
  targetRole: "school_admin" | "teacher" | "accountant";
  isSingleUse: boolean;
  maxUses: number;
  usedCount: number;
  status: "active" | "revoked" | "expired";
  createdAt: string;
  expiresAt: string | null;
  notes: string;
  usedBy: Array<{
    email: string;
    userId: string;
    usedAt: string;
    fullName?: string;
  }>;
}

export interface PlatformUserRecord {
  userId: string;
  email: string;
  fullName: string;
  schoolId: string | null;
  schoolName: string;
  role: "super_admin" | "school_admin" | "teacher" | "accountant" | "student" | "parent";
  status: "active" | "deactivated" | "suspended";
  createdAt: string;
  lastActiveAt?: string;
  isPermanentSuperAdmin?: boolean;
}

export interface SchoolRecord {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  motto?: string | null;
  current_session?: string | null;
  created_at: string;
}

const DATA_DIR = path.resolve(process.cwd(), ".data");
const REG_CODES_FILE = path.join(DATA_DIR, "registration_codes.json");
const PLATFORM_USERS_FILE = path.join(DATA_DIR, "platform_users.json");
const SCHOOLS_FILE = path.join(DATA_DIR, "schools.json");

function ensureDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch {
      // directory might exist or read-only
    }
  }
}

// Initial seed schools
export const DEFAULT_SCHOOLS: SchoolRecord[] = [
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
  },
  {
    id: "school-assalam-tahfizul-001",
    name: "Assalam Tahfizul Qur'an Academy Limited",
    code: "ATQ-756",
    address: "Kano Road, Daura, Katsina State",
    phone: "08039876543",
    email: "admin@assalam.edu.ng",
    motto: "Preserving the Divine Quran & Noble Character",
    current_session: "2025/2026",
    created_at: "2025-02-01T00:00:00Z",
  },
];

// Initial seed codes
const DEFAULT_CODES: RegistrationCode[] = [
  {
    id: "reg-code-seed-atq",
    code: "ATQ-756",
    schoolId: "school-assalam-tahfizul-001",
    schoolName: "Assalam Tahfizul Qur'an Academy Limited",
    targetRole: "school_admin",
    isSingleUse: false,
    maxUses: 10,
    usedCount: 0,
    status: "active",
    createdAt: new Date().toISOString(),
    expiresAt: null,
    notes: "Official School Administrator Registration Code for Assalam Tahfizul Qur'an Academy Limited",
    usedBy: [],
  },
  {
    id: "reg-code-seed-1",
    code: "SCH-REG-84920",
    schoolId: "af91ff67-95eb-4b62-93a0-5617d23a2f1d",
    schoolName: "Al-Huda International Academy",
    targetRole: "school_admin",
    isSingleUse: false,
    maxUses: 5,
    usedCount: 1,
    status: "active",
    createdAt: new Date().toISOString(),
    expiresAt: null,
    notes: "Official School Administrator Onboarding Code for Al-Huda Academy",
    usedBy: [
      {
        email: "demo.admin@eduerp-demo.ng",
        userId: "00000000-0000-0000-0000-000000000001",
        usedAt: new Date().toISOString(),
        fullName: "Demo School Administrator",
      },
    ],
  },
  {
    id: "reg-code-seed-2",
    code: "SCH-TCH-10924",
    schoolId: "af91ff67-95eb-4b62-93a0-5617d23a2f1d",
    schoolName: "Al-Huda International Academy",
    targetRole: "teacher",
    isSingleUse: false,
    maxUses: 20,
    usedCount: 2,
    status: "active",
    createdAt: new Date().toISOString(),
    expiresAt: null,
    notes: "Teacher onboarding batch code for 2025/2026 Academic Session",
    usedBy: [],
  },
  {
    id: "reg-code-seed-3",
    code: "SCH-ACC-33910",
    schoolId: "af91ff67-95eb-4b62-93a0-5617d23a2f1d",
    schoolName: "Al-Huda International Academy",
    targetRole: "accountant",
    isSingleUse: true,
    maxUses: 1,
    usedCount: 0,
    status: "active",
    createdAt: new Date().toISOString(),
    expiresAt: null,
    notes: "School Bursar / Finance Accountant invitation code",
    usedBy: [],
  },
];

// Initial seed users
const DEFAULT_USERS: PlatformUserRecord[] = [
  {
    userId: "super-admin-musty-daura",
    email: "mustydawuddaura@gmail.com",
    fullName: "Musty Dawud Daura",
    schoolId: null,
    schoolName: "All Schools (Platform Owner)",
    role: "super_admin",
    status: "active",
    createdAt: "2025-01-01T00:00:00.000Z",
    lastActiveAt: new Date().toISOString(),
    isPermanentSuperAdmin: true,
  },
  {
    userId: "00000000-0000-0000-0000-000000000001",
    email: "demo.admin@eduerp-demo.ng",
    fullName: "Hajiya Maryam Sani",
    schoolId: "af91ff67-95eb-4b62-93a0-5617d23a2f1d",
    schoolName: "Al-Huda International Academy",
    role: "school_admin",
    status: "active",
    createdAt: "2025-02-10T08:30:00.000Z",
    lastActiveAt: new Date().toISOString(),
    isPermanentSuperAdmin: false,
  },
  {
    userId: "teacher-user-ibrahim",
    email: "ibrahim.lawal@alhuda.edu.ng",
    fullName: "Mallam Ibrahim Lawal",
    schoolId: "af91ff67-95eb-4b62-93a0-5617d23a2f1d",
    schoolName: "Al-Huda International Academy",
    role: "teacher",
    status: "active",
    createdAt: "2025-02-15T09:00:00.000Z",
    lastActiveAt: new Date().toISOString(),
    isPermanentSuperAdmin: false,
  },
  {
    userId: "teacher-user-zainab",
    email: "zainab.abubakar@alhuda.edu.ng",
    fullName: "Ustaza Zainab Abubakar",
    schoolId: "af91ff67-95eb-4b62-93a0-5617d23a2f1d",
    schoolName: "Al-Huda International Academy",
    role: "teacher",
    status: "active",
    createdAt: "2025-02-18T10:15:00.000Z",
    lastActiveAt: new Date().toISOString(),
    isPermanentSuperAdmin: false,
  },
  {
    userId: "accountant-user-usman",
    email: "bursar.usman@alhuda.edu.ng",
    fullName: "Malam Usman Bello",
    schoolId: "af91ff67-95eb-4b62-93a0-5617d23a2f1d",
    schoolName: "Al-Huda International Academy",
    role: "accountant",
    status: "active",
    createdAt: "2025-02-20T11:30:00.000Z",
    lastActiveAt: new Date().toISOString(),
    isPermanentSuperAdmin: false,
  },
  {
    userId: "student-user-ahmad",
    email: "ahmad.ibrahim@alhuda.edu.ng",
    fullName: "Ahmad Ibrahim Lawal",
    schoolId: "af91ff67-95eb-4b62-93a0-5617d23a2f1d",
    schoolName: "Al-Huda International Academy",
    role: "student",
    status: "active",
    createdAt: "2025-03-01T08:00:00.000Z",
    lastActiveAt: new Date().toISOString(),
    isPermanentSuperAdmin: false,
  },
  {
    userId: "parent-user-ibrahim",
    email: "parent.lawal@alhuda.edu.ng",
    fullName: "Alhaji Ibrahim Lawal",
    schoolId: "af91ff67-95eb-4b62-93a0-5617d23a2f1d",
    schoolName: "Al-Huda International Academy",
    role: "parent",
    status: "active",
    createdAt: "2025-03-01T08:30:00.000Z",
    lastActiveAt: new Date().toISOString(),
    isPermanentSuperAdmin: false,
  },
];

export function getStoredSchools(): SchoolRecord[] {
  ensureDirectory();
  try {
    if (fs.existsSync(SCHOOLS_FILE)) {
      const content = fs.readFileSync(SCHOOLS_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn("Failed reading schools from disk, using defaults", err);
  }
  saveStoredSchools(DEFAULT_SCHOOLS);
  return DEFAULT_SCHOOLS;
}

export function saveStoredSchools(schools: SchoolRecord[]) {
  ensureDirectory();
  try {
    fs.writeFileSync(SCHOOLS_FILE, JSON.stringify(schools, null, 2), "utf-8");
  } catch (err) {
    console.warn("Failed writing schools to disk", err);
  }
}

export function getStoredRegistrationCodes(): RegistrationCode[] {
  ensureDirectory();
  try {
    if (fs.existsSync(REG_CODES_FILE)) {
      const content = fs.readFileSync(REG_CODES_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn("Failed reading registration codes from disk, using defaults", err);
  }
  saveStoredRegistrationCodes(DEFAULT_CODES);
  return DEFAULT_CODES;
}

export function saveStoredRegistrationCodes(codes: RegistrationCode[]) {
  ensureDirectory();
  try {
    fs.writeFileSync(REG_CODES_FILE, JSON.stringify(codes, null, 2), "utf-8");
  } catch (err) {
    console.warn("Failed writing registration codes to disk", err);
  }
}

export function getStoredPlatformUsers(): PlatformUserRecord[] {
  ensureDirectory();
  try {
    if (fs.existsSync(PLATFORM_USERS_FILE)) {
      const content = fs.readFileSync(PLATFORM_USERS_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure Super Admin is always present
        const hasSuper = parsed.some((u: any) => u.email.toLowerCase() === "mustydawuddaura@gmail.com");
        if (!hasSuper) {
          parsed.unshift(DEFAULT_USERS[0]);
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Failed reading platform users from disk, using defaults", err);
  }
  saveStoredPlatformUsers(DEFAULT_USERS);
  return DEFAULT_USERS;
}

export function saveStoredPlatformUsers(users: PlatformUserRecord[]) {
  ensureDirectory();
  try {
    // Ensure Super Admin mustydawuddaura@gmail.com is always present and active
    const hasSuper = users.some((u) => u.email.toLowerCase() === "mustydawuddaura@gmail.com");
    if (!hasSuper) {
      users.unshift(DEFAULT_USERS[0]);
    }
    fs.writeFileSync(PLATFORM_USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch (err) {
    console.warn("Failed writing platform users to disk", err);
  }
}

export function generateRegistrationCode(prefix = "SCH-REG"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let randomPart = "";
  for (let i = 0; i < 5; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${randomPart}`;
}
