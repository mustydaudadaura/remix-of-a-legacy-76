import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getSuperAdminDashboardData } from "@/lib/api/rbac.functions";
import { selectSchool } from "@/lib/school-access";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Building2, FileText, BookOpen, GraduationCap, Wallet,
  TrendingUp, TrendingDown, Award, UserCheck, ClipboardList, Sparkles,
  KeyRound, ShieldCheck, HardDrive, Eye, Settings, ArrowUpRight, CheckCircle2,
  UserPlus,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid,
  RadialBarChart, RadialBar,
} from "recharts";
import { StudentPerformanceAnalytics } from "@/components/StudentPerformanceAnalytics";
import { AdminAIAssistantWidget } from "@/components/AdminAIAssistantWidget";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Alegacy" }, { name: "description", content: "Dashboard for authorized school accounts and families in Alegacy." }, { property: "og:title", content: "Dashboard — Alegacy" }, { property: "og:description", content: "Dashboard for authorized school accounts and families in Alegacy." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Dashboard,
});

// ---------- shared building blocks ----------

const PINK = "var(--analytic-pink)";
const PURPLE = "var(--analytic-purple)";
const EMERALD = "var(--analytic-emerald)";
const BLUE = "var(--analytic-blue)";
const INDIGO = "var(--analytic-indigo)";
const ROSE = "var(--analytic-rose)";

function DonutStat({ label, value, color }: { label: string; value: number; color: string }) {
  const data = [{ name: label, value, fill: color }];
  return (
    <Card className="overflow-hidden border-0 shadow-[var(--shadow-analytic)]">
      <CardContent className="p-3 sm:p-4">
        <div className="relative mx-auto h-20 w-20 sm:h-28 sm:w-28">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
              <RadialBar dataKey="value" cornerRadius={20} background={{ fill: "oklch(0.95 0.02 320)" }} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center text-sm sm:text-lg font-bold" style={{ color }}>
            {value}%
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] sm:text-xs text-muted-foreground line-clamp-1">{label}</p>
      </CardContent>
    </Card>
  );
}

function GradientStat({
  icon: Icon, label, value, delta, gradient,
}: { icon: any; label: string; value: string | number; delta?: number; gradient: string }) {
  const up = (delta ?? 0) >= 0;
  return (
    <Card className="overflow-hidden border-0 text-white shadow-[var(--shadow-analytic)]" style={{ background: gradient }}>
      <CardContent className="flex items-center justify-between p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs uppercase tracking-wide opacity-80 truncate">{label}</p>
          <p className="mt-1 text-xl sm:text-2xl font-bold truncate">{value}</p>
          {delta !== undefined && (
            <p className="mt-1 flex items-center gap-1 text-[10px] sm:text-xs opacity-90">
              {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {up ? "+" : ""}{delta}% this term
            </p>
          )}
        </div>
        <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur">
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressRow({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ---------- mock-trend generator (deterministic) ----------
const trend = (seed: number, n = 12) =>
  Array.from({ length: n }, (_, i) => ({
    name: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i],
    a: Math.round(40 + Math.abs(Math.sin((i + seed) * 0.7)) * 200 + (i * 5)),
    b: Math.round(20 + Math.abs(Math.cos((i + seed) * 0.5)) * 150 + (i * 3)),
  }));

const bars = (seed: number) =>
  ["Math","Eng","Sci","Soc","ICT","Arts"].map((s, i) => ({
    name: s,
    score: Math.round(45 + Math.abs(Math.sin((i + seed) * 1.1)) * 50),
  }));

// ---------- main ----------

function Dashboard() {
  const { fullName, roles, schoolId } = useAuth();
  const role = roles.includes("super_admin")
    ? "super_admin"
    : roles.includes("school_admin")
    ? "school_admin"
    : roles.includes("teacher")
    ? "teacher"
    : roles.includes("accountant")
    ? "accountant"
    : roles.includes("parent")
    ? "parent"
    : roles[0] ?? "student";

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", schoolId, role],
    queryFn: async () => {
      const [schools, students, classes, assessments, staff] = await Promise.all([
        supabase.from("schools").select("id", { count: "exact", head: true }),
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("classes").select("id", { count: "exact", head: true }),
        supabase.from("assessments").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      return {
        schools: schools.count ?? 0,
        students: students.count ?? 0,
        classes: classes.count ?? 0,
        assessments: assessments.count ?? 0,
        staff: staff.count ?? 0,
      };
    },
  });

  const title =
    role === "super_admin" ? "Platform Overview"
    : role === "school_admin" ? "School Administration"
    : role === "teacher" ? "Teacher Workspace"
    : role === "accountant" ? "Finance Overview"
    : role === "parent" ? "Parent Portal"
    : "My Learning";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div
        className="flex flex-col gap-2 rounded-2xl p-4 sm:p-6 text-white shadow-[var(--shadow-analytic)] sm:flex-row sm:items-center sm:justify-between"
        style={{ background: "var(--gradient-analytic-1)" }}
      >
        <div className="min-w-0">
          <p className="text-xs sm:text-sm opacity-80">{title}</p>
          <h1 className="text-xl font-bold sm:text-3xl truncate flex items-center gap-2">
            <span>Welcome{fullName ? `, ${fullName.split(" ")[0]}` : ""}</span>
            <Sparkles className="h-6 w-6 text-white/90" />
          </h1>
          <p className="mt-1 text-xs sm:text-sm opacity-90">
            {new Date().toLocaleDateString("en-NG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <Badge className="self-start bg-white/20 text-white hover:bg-white/30 text-[10px] sm:text-xs">
          {roles.length ? roles.join(" • ") : "Awaiting role"}
        </Badge>
      </div>

      {role === "super_admin" && <SuperAdminView stats={stats} schoolId={schoolId} />}
      {role === "school_admin" && <SchoolAdminView stats={stats} schoolId={schoolId} />}
      {role === "teacher" && <TeacherView schoolId={schoolId} />}
      {role === "accountant" && <AccountantView />}
      {role === "parent" && <ParentView />}
      {role === "student" && <StudentView />}
      {roles.length === 0 && <StudentView />}
    </div>
  );
}

// ---------- ROLE VIEWS ----------

function SuperAdminView({ stats, schoolId }: { stats: any; schoolId?: string | null }) {
  const getSuperDataFn = useServerFn(getSuperAdminDashboardData);
  const { data: superData } = useQuery({
    queryKey: ["super-admin-dashboard-metrics"],
    queryFn: () => getSuperDataFn(),
  });

  const inspectedSchool = superData?.schools?.find((s) => s.id === schoolId);

  return (
    <div className="space-y-5">
      {/* Super Admin Status & School Inspection Banner */}
      <div className="flex flex-col gap-3 rounded-xl border border-purple-200 bg-purple-50/70 p-4 dark:border-purple-900/60 dark:bg-purple-950/30 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground">Platform Owner Oversight</span>
              <Badge className="bg-purple-600 text-white hover:bg-purple-700 text-[10px]">Super Admin</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {inspectedSchool
                ? `Inspecting School: ${inspectedSchool.name} (${inspectedSchool.code}) · Read-only administrative mode`
                : "Global Platform Mode · Full access to all registered schools, users, and registration codes"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {inspectedSchool && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs font-medium"
              onClick={() => {
                selectSchool(superData?.schools?.[0]?.id ?? "");
              }}
            >
              <Eye className="mr-1.5 h-3.5 w-3.5 text-primary" />
              Switch Inspection
            </Button>
          )}
          <Button asChild size="sm" variant="default" className="text-xs font-semibold bg-purple-600 hover:bg-purple-700">
            <Link to="/users">
              <KeyRound className="mr-1.5 h-3.5 w-3.5" />
              Manage Roles & Codes
            </Link>
          </Button>
        </div>
      </div>

      {/* Primary Executive Stats Grid */}
      <div className="grid gap-3 grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <GradientStat
          icon={Building2}
          label="Registered Schools"
          value={superData?.totalSchools ?? stats?.schools ?? "—"}
          delta={12}
          gradient="var(--gradient-analytic-1)"
        />
        <GradientStat
          icon={Users}
          label="Platform Users"
          value={superData?.totalUsers ?? stats?.staff ?? "—"}
          delta={8}
          gradient="var(--gradient-analytic-2)"
        />
        <GradientStat
          icon={KeyRound}
          label="Active Registration Codes"
          value={superData?.registrationCodes?.active ?? "—"}
          delta={25}
          gradient="var(--gradient-analytic-3)"
        />
        <GradientStat
          icon={HardDrive}
          label="Platform Storage Used"
          value={`${superData?.storageMetrics?.totalUsedMb ?? 142.8} MB`}
          delta={2}
          gradient="var(--gradient-analytic-1)"
        />
      </div>

      {/* Quick Governance Navigation Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/schools" className="group">
          <Card className="h-full border border-border/70 hover:border-primary/50 transition-all shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                  Schools Directory
                </span>
                <p className="text-sm font-bold text-foreground">Create & Audit Schools</p>
                <p className="text-[11px] text-muted-foreground">Manage school registrations</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link to="/users" className="group">
          <Card className="h-full border border-border/70 hover:border-primary/50 transition-all shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                  Role Governance
                </span>
                <p className="text-sm font-bold text-foreground">Users & Role Assignment</p>
                <p className="text-[11px] text-muted-foreground">Assign, modify, revoke roles</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link to="/users" search={{ tab: "codes" }} className="group">
          <Card className="h-full border border-border/70 hover:border-primary/50 transition-all shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                  Registration Codes
                </span>
                <p className="text-sm font-bold text-foreground">Unique School Codes</p>
                <p className="text-[11px] text-muted-foreground">Single-use & reusable codes</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link to="/settings" className="group">
          <Card className="h-full border border-border/70 hover:border-primary/50 transition-all shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                  Platform Settings
                </span>
                <p className="text-sm font-bold text-foreground">School Config & Audits</p>
                <p className="text-[11px] text-muted-foreground">Modules, grading, stamps</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Registered Schools Management Table */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Registered School Workspaces</CardTitle>
            <CardDescription>
              Super Admin school accounts directory. Select any school to inspect its dashboard and records.
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/schools">
              <Building2 className="mr-1.5 h-3.5 w-3.5" />
              Manage All Schools
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School Name & Code</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>Registration Date</TableHead>
                  <TableHead>Account Status</TableHead>
                  <TableHead className="text-right">Inspection Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {superData?.schools?.map((sch: any) => {
                  const isCurrent = sch.id === schoolId;
                  return (
                    <TableRow key={sch.id} className={isCurrent ? "bg-purple-50/50 dark:bg-purple-950/20" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary shrink-0" />
                          <div>
                            <span className="font-semibold text-xs text-foreground">{sch.name}</span>
                            <span className="ml-2 font-mono text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {sch.code}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {sch.phone || sch.email || "Official Contact on File"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(sch.created_at || Date.now()).toLocaleDateString("en-NG", {
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant={isCurrent ? "secondary" : "outline"}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            selectSchool(sch.id);
                          }}
                        >
                          <Eye className="mr-1.5 h-3.5 w-3.5 text-primary" />
                          {isCurrent ? "Currently Inspecting" : "Inspect Dashboard"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Platform Analytics & Assistant */}
      <AdminAIAssistantWidget schoolId={schoolId} />
      <StudentPerformanceAnalytics schoolId={schoolId} />
      <ChartsRow seed={3} title="Platform Activity Trends" subtitle="Active users and school performance metrics" />
    </div>
  );
}

function SchoolAdminView({ stats, schoolId }: { stats: any; schoolId?: string | null }) {
  return (
    <>
      <div className="grid gap-3 grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <GradientStat
          icon={Users}
          label="Total Students"
          value={stats?.students ?? "—"}
          delta={6}
          gradient="linear-gradient(135deg, oklch(0.58 0.24 355), oklch(0.48 0.22 355))"
        />
        <GradientStat
          icon={Award}
          label="Results Published"
          value={stats?.assessments ? `${stats.assessments}` : "—"}
          delta={100}
          gradient="linear-gradient(135deg, oklch(0.56 0.22 305), oklch(0.46 0.20 290))"
        />
        <GradientStat
          icon={Wallet}
          label="Total Fees Collected"
          value="₦1,250,000"
          delta={18}
          gradient="linear-gradient(135deg, oklch(0.58 0.18 150), oklch(0.48 0.16 160))"
        />
        <GradientStat
          icon={BookOpen}
          label="Active Classes"
          value={stats?.classes ?? "—"}
          delta={2}
          gradient="linear-gradient(135deg, oklch(0.62 0.16 230), oklch(0.50 0.16 250))"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-sm">
          <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-lg">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">Publish Results Online</span>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                Share results with parents instantly
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Generate beautiful Nigerian-standard report sheets, share via link or QR code, and keep parents informed in real time.
              </p>
            </div>
            <a
              href="/results"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 shrink-0"
            >
              Publish Results →
            </a>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 grid grid-cols-2 sm:grid-cols-3 gap-2">
            <a
              href="/users"
              className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-primary/40 bg-primary/5 hover:bg-primary/10 transition text-center text-xs font-semibold text-primary"
            >
              <UserPlus className="h-4 w-4 text-primary mb-1.5" />
              <span>Staff Logins</span>
            </a>
            <a
              href="/results"
              className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/60 transition text-center text-xs font-medium text-foreground"
            >
              <FileText className="h-4 w-4 text-primary mb-1.5" />
              <span>Add Results</span>
            </a>
            <a
              href="/students"
              className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/60 transition text-center text-xs font-medium text-foreground"
            >
              <Users className="h-4 w-4 text-primary mb-1.5" />
              <span>Students</span>
            </a>
            <a
              href="/report-cards"
              className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/60 transition text-center text-xs font-medium text-foreground"
            >
              <Award className="h-4 w-4 text-primary mb-1.5" />
              <span>Report Cards</span>
            </a>
            <a
              href="/announcements"
              className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/60 transition text-center text-xs font-medium text-foreground"
            >
              <UserCheck className="h-4 w-4 text-primary mb-1.5" />
              <span>Noticeboard</span>
            </a>
            <a
              href="/settings"
              className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/60 transition text-center text-xs font-medium text-foreground"
            >
              <Settings className="h-4 w-4 text-primary mb-1.5" />
              <span>Settings</span>
            </a>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:gap-4 sm:grid-cols-4">
        <DonutStat label="Attendance" value={92} color={PINK} />
        <DonutStat label="Pass Rate" value={81} color={PURPLE} />
        <DonutStat label="Fees Paid" value={67} color={EMERALD} />
        <DonutStat label="Reports Published" value={58} color={ROSE} />
      </div>

      <AdminAIAssistantWidget schoolId={schoolId} />
      <StudentPerformanceAnalytics schoolId={schoolId} />
      <ChartsRow seed={5} title="School Performance" subtitle="Enrolment trend vs assessment volume" />
      <ProgressCard />
    </>
  );
}

function TeacherView({ schoolId }: { schoolId?: string | null }) {
  return (
    <>
      <div className="grid gap-3 grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <GradientStat icon={BookOpen} label="My Classes" value={6} delta={0} gradient="var(--gradient-analytic-1)" />
        <GradientStat icon={Users} label="My Students" value={184} delta={5} gradient="var(--gradient-analytic-2)" />
        <GradientStat icon={ClipboardList} label="Pending Results" value={12} delta={-3} gradient="var(--gradient-analytic-3)" />
        <GradientStat icon={Award} label="Avg Class Score" value="74%" delta={4} gradient="var(--gradient-analytic-1)" />
      </div>
      <AdminAIAssistantWidget schoolId={schoolId} />
      <div className="grid gap-3 grid-cols-2 sm:gap-4 sm:grid-cols-4">
        <DonutStat label="Submissions" value={78} color={PINK} />
        <DonutStat label="Attendance" value={89} color={PURPLE} />
        <DonutStat label="Graded" value={64} color={INDIGO} />
        <DonutStat label="Approved" value={52} color={ROSE} />
      </div>
      <StudentPerformanceAnalytics schoolId={schoolId} />
      <ChartsRow seed={7} title="Class Performance" subtitle="Average score across subjects" />
    </>
  );
}

function AccountantView() {
  return (
    <>
      <div className="grid gap-3 grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <GradientStat icon={Wallet} label="Collected (NGN)" value="₦3.67M" delta={12} gradient="var(--gradient-analytic-1)" />
        <GradientStat icon={TrendingUp} label="Outstanding" value="₦1.24M" delta={-5} gradient="var(--gradient-analytic-2)" />
        <GradientStat icon={Users} label="Paid Students" value={345} delta={9} gradient="var(--gradient-analytic-3)" />
        <GradientStat icon={FileText} label="Invoices" value={246} delta={3} gradient="var(--gradient-analytic-1)" />
      </div>
      <div className="grid gap-3 grid-cols-2 sm:gap-4 sm:grid-cols-4">
        <DonutStat label="Collection" value={87} color={PINK} />
        <DonutStat label="Reconciled" value={64} color={PURPLE} />
        <DonutStat label="Scholarships" value={28} color={INDIGO} />
        <DonutStat label="Overdue" value={19} color={ROSE} />
      </div>
      <ChartsRow seed={2} title="Revenue Analytics" subtitle="Fee collection trend" />
    </>
  );
}

function ParentView() {
  return (
    <>
      <div className="grid gap-3 grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <GradientStat icon={GraduationCap} label="Children" value={2} gradient="var(--gradient-analytic-1)" />
        <GradientStat icon={Award} label="Avg Score" value="76%" delta={3} gradient="var(--gradient-analytic-2)" />
        <GradientStat icon={UserCheck} label="Attendance" value="94%" delta={1} gradient="var(--gradient-analytic-3)" />
        <GradientStat icon={Wallet} label="Fees Due" value="₦45,000" gradient="var(--gradient-analytic-1)" />
      </div>
      <div className="grid gap-3 grid-cols-2 sm:gap-4 sm:grid-cols-4">
        <DonutStat label="Term Progress" value={68} color={PINK} />
        <DonutStat label="Assignments" value={82} color={PURPLE} />
        <DonutStat label="Fee Paid" value={55} color={INDIGO} />
        <DonutStat label="Reports Read" value={40} color={ROSE} />
      </div>
      <ChartsRow seed={9} title="Children Performance" subtitle="Termly average per child" />
    </>
  );
}

function StudentView() {
  return (
    <>
      <div className="grid gap-3 grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <GradientStat icon={Award} label="Avg Score" value="78%" delta={6} gradient="var(--gradient-analytic-1)" />
        <GradientStat icon={BookOpen} label="Subjects" value={9} gradient="var(--gradient-analytic-2)" />
        <GradientStat icon={UserCheck} label="Attendance" value="96%" delta={2} gradient="var(--gradient-analytic-3)" />
        <GradientStat icon={ClipboardList} label="Position" value="4th" delta={3} gradient="var(--gradient-analytic-1)" />
      </div>
      <div className="grid gap-3 grid-cols-2 sm:gap-4 sm:grid-cols-4">
        <DonutStat label="Term Progress" value={72} color={PINK} />
        <DonutStat label="Assignments" value={88} color={PURPLE} />
        <DonutStat label="Quizzes" value={65} color={INDIGO} />
        <DonutStat label="Projects" value={45} color={ROSE} />
      </div>
      <ChartsRow seed={11} title="My Performance" subtitle="Score progression by subject" />
    </>
  );
}

// ---------- charts row (reusable) ----------

function ChartsRow({ seed, title, subtitle }: { seed: number; title: string; subtitle: string }) {
  const areaData = trend(seed);
  const barData = bars(seed);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2 border-0 shadow-[var(--shadow-analytic)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </CardHeader>
        <CardContent className="h-56 sm:h-72 px-2 sm:px-6">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={areaData} margin={{ left: -20, right: 10, top: 10 }}>
              <defs>
                <linearGradient id="gPink" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PINK} stopOpacity={0.7} />
                  <stop offset="100%" stopColor={PINK} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gPurple" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PURPLE} stopOpacity={0.6} />
                  <stop offset="100%" stopColor={PURPLE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.02 320)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="oklch(0.6 0.02 280)" />
              <YAxis tick={{ fontSize: 11 }} stroke="oklch(0.6 0.02 280)" />
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "var(--shadow-analytic)" }} />
              <Area type="monotone" dataKey="a" stroke={PURPLE} strokeWidth={2.5} fill="url(#gPurple)" />
              <Area type="monotone" dataKey="b" stroke={PINK} strokeWidth={2.5} fill="url(#gPink)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-[var(--shadow-analytic)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Subject Breakdown</CardTitle>
          <p className="text-xs text-muted-foreground">Average performance</p>
        </CardHeader>
        <CardContent className="h-56 sm:h-72 px-2 sm:px-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ left: -20, right: 10, top: 10 }}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ROSE} />
                  <stop offset="100%" stopColor={INDIGO} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.02 320)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="oklch(0.6 0.02 280)" />
              <YAxis tick={{ fontSize: 11 }} stroke="oklch(0.6 0.02 280)" />
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "var(--shadow-analytic)" }} />
              <Bar dataKey="score" fill="url(#barGrad)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function ProgressCard() {
  return (
    <Card className="border-0 shadow-[var(--shadow-analytic)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Operational Health</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        <ProgressRow label="Result Approval Rate" value={51} sub="246 of 482 results approved" color={PINK} />
        <ProgressRow label="Fee Collection" value={78} sub="₦12.4M of ₦15.9M collected" color={PURPLE} />
        <ProgressRow label="Attendance Compliance" value={87} sub="Above national avg" color={INDIGO} />
        <ProgressRow label="Parent Engagement" value={64} sub="65% of parents active" color={ROSE} />
      </CardContent>
    </Card>
  );
}
