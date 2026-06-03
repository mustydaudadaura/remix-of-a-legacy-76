import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Users, Building2, FileText, BookOpen, GraduationCap, Wallet,
  TrendingUp, TrendingDown, Award, UserCheck, ClipboardList,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid,
  RadialBarChart, RadialBar,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — EduERP" }] }),
  component: Dashboard,
});

// ---------- shared building blocks ----------

const PINK = "oklch(0.72 0.2 5)";
const PURPLE = "oklch(0.58 0.22 300)";
const INDIGO = "oklch(0.55 0.2 270)";
const BLUE = "oklch(0.68 0.16 240)";
const ROSE = "oklch(0.68 0.22 15)";

function DonutStat({ label, value, color }: { label: string; value: number; color: string }) {
  const data = [{ name: label, value, fill: color }];
  return (
    <Card className="overflow-hidden border-0 shadow-[var(--shadow-analytic)]">
      <CardContent className="p-4">
        <div className="relative mx-auto h-28 w-28">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
              <RadialBar dataKey="value" cornerRadius={20} background={{ fill: "oklch(0.95 0.02 320)" }} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center text-lg font-bold" style={{ color }}>
            {value}%
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">{label}</p>
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
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-wide opacity-80">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
          {delta !== undefined && (
            <p className="mt-1 flex items-center gap-1 text-xs opacity-90">
              {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {up ? "+" : ""}{delta}% this term
            </p>
          )}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur">
          <Icon className="h-6 w-6" />
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
  const role = roles[0] ?? "student";

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
    <div className="space-y-6">
      {/* Header */}
      <div
        className="flex flex-col gap-2 rounded-2xl p-6 text-white shadow-[var(--shadow-analytic)] sm:flex-row sm:items-center sm:justify-between"
        style={{ background: "var(--gradient-analytic-1)" }}
      >
        <div>
          <p className="text-sm opacity-80">{title}</p>
          <h1 className="text-2xl font-bold sm:text-3xl">
            Welcome{fullName ? `, ${fullName.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="mt-1 text-sm opacity-90">
            {new Date().toLocaleDateString("en-NG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <Badge className="self-start bg-white/20 text-white hover:bg-white/30">
          {roles.length ? roles.join(" • ") : "Awaiting role"}
        </Badge>
      </div>

      {role === "super_admin" && <SuperAdminView stats={stats} />}
      {role === "school_admin" && <SchoolAdminView stats={stats} />}
      {role === "teacher" && <TeacherView />}
      {role === "accountant" && <AccountantView />}
      {role === "parent" && <ParentView />}
      {role === "student" && <StudentView />}
      {roles.length === 0 && <StudentView />}
    </div>
  );
}

// ---------- ROLE VIEWS ----------

function SuperAdminView({ stats }: { stats: any }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GradientStat icon={Building2} label="Schools" value={stats?.schools ?? "—"} delta={12} gradient="var(--gradient-analytic-1)" />
        <GradientStat icon={Users} label="Total Students" value={stats?.students ?? "—"} delta={8} gradient="var(--gradient-analytic-2)" />
        <GradientStat icon={UserCheck} label="Staff" value={stats?.staff ?? "—"} delta={4} gradient="var(--gradient-analytic-3)" />
        <GradientStat icon={FileText} label="Assessments" value={stats?.assessments ?? "—"} delta={22} gradient="var(--gradient-analytic-1)" />
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <DonutStat label="Active Schools" value={74} color={PINK} />
        <DonutStat label="Result Coverage" value={70} color={PURPLE} />
        <DonutStat label="Fee Collection" value={45} color={INDIGO} />
        <DonutStat label="Attendance Avg" value={57} color={ROSE} />
      </div>

      <ChartsRow seed={3} title="Platform Growth" subtitle="Schools onboarded vs active users" />
    </>
  );
}

function SchoolAdminView({ stats }: { stats: any }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GradientStat icon={Users} label="Students" value={stats?.students ?? "—"} delta={6} gradient="var(--gradient-analytic-1)" />
        <GradientStat icon={BookOpen} label="Classes" value={stats?.classes ?? "—"} delta={2} gradient="var(--gradient-analytic-2)" />
        <GradientStat icon={UserCheck} label="Staff" value={stats?.staff ?? "—"} delta={3} gradient="var(--gradient-analytic-3)" />
        <GradientStat icon={ClipboardList} label="Assessments" value={stats?.assessments ?? "—"} delta={15} gradient="var(--gradient-analytic-1)" />
      </div>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <DonutStat label="Attendance" value={92} color={PINK} />
        <DonutStat label="Pass Rate" value={81} color={PURPLE} />
        <DonutStat label="Fees Paid" value={67} color={INDIGO} />
        <DonutStat label="Reports Published" value={58} color={ROSE} />
      </div>
      <ChartsRow seed={5} title="School Performance" subtitle="Enrolment trend vs assessment volume" />
      <ProgressCard />
    </>
  );
}

function TeacherView() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GradientStat icon={BookOpen} label="My Classes" value={6} delta={0} gradient="var(--gradient-analytic-1)" />
        <GradientStat icon={Users} label="My Students" value={184} delta={5} gradient="var(--gradient-analytic-2)" />
        <GradientStat icon={ClipboardList} label="Pending Results" value={12} delta={-3} gradient="var(--gradient-analytic-3)" />
        <GradientStat icon={Award} label="Avg Class Score" value="74%" delta={4} gradient="var(--gradient-analytic-1)" />
      </div>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <DonutStat label="Submissions" value={78} color={PINK} />
        <DonutStat label="Attendance" value={89} color={PURPLE} />
        <DonutStat label="Graded" value={64} color={INDIGO} />
        <DonutStat label="Approved" value={52} color={ROSE} />
      </div>
      <ChartsRow seed={7} title="Class Performance" subtitle="Average score across subjects" />
    </>
  );
}

function AccountantView() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GradientStat icon={Wallet} label="Collected (NGN)" value="₦3.67M" delta={12} gradient="var(--gradient-analytic-1)" />
        <GradientStat icon={TrendingUp} label="Outstanding" value="₦1.24M" delta={-5} gradient="var(--gradient-analytic-2)" />
        <GradientStat icon={Users} label="Paid Students" value={345} delta={9} gradient="var(--gradient-analytic-3)" />
        <GradientStat icon={FileText} label="Invoices" value={246} delta={3} gradient="var(--gradient-analytic-1)" />
      </div>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GradientStat icon={GraduationCap} label="Children" value={2} gradient="var(--gradient-analytic-1)" />
        <GradientStat icon={Award} label="Avg Score" value="76%" delta={3} gradient="var(--gradient-analytic-2)" />
        <GradientStat icon={UserCheck} label="Attendance" value="94%" delta={1} gradient="var(--gradient-analytic-3)" />
        <GradientStat icon={Wallet} label="Fees Due" value="₦45,000" gradient="var(--gradient-analytic-1)" />
      </div>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GradientStat icon={Award} label="Avg Score" value="78%" delta={6} gradient="var(--gradient-analytic-1)" />
        <GradientStat icon={BookOpen} label="Subjects" value={9} gradient="var(--gradient-analytic-2)" />
        <GradientStat icon={UserCheck} label="Attendance" value="96%" delta={2} gradient="var(--gradient-analytic-3)" />
        <GradientStat icon={ClipboardList} label="Position" value="4th" delta={3} gradient="var(--gradient-analytic-1)" />
      </div>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
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
        <CardContent className="h-72">
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
        <CardContent className="h-72">
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
