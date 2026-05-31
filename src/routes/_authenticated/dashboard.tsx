import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, FileText, BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — EduERP" }] }),
  component: Dashboard,
});

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { fullName, roles, schoolId } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", schoolId],
    queryFn: async () => {
      const [schools, students, classes, assessments] = await Promise.all([
        supabase.from("schools").select("id", { count: "exact", head: true }),
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("classes").select("id", { count: "exact", head: true }),
        supabase.from("assessments").select("id", { count: "exact", head: true }),
      ]);
      return {
        schools: schools.count ?? 0,
        students: students.count ?? 0,
        classes: classes.count ?? 0,
        assessments: assessments.count ?? 0,
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Welcome{fullName ? `, ${fullName.split(" ")[0]}` : ""} 👋
        </h1>
        <p className="mt-1 text-muted-foreground">
          {roles.length === 0
            ? "Your account is ready. An administrator will assign you a role shortly, or set up your school below."
            : `Logged in as ${roles.join(", ")}.`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Building2} label="Schools" value={stats?.schools ?? "—"} />
        <Stat icon={Users} label="Students" value={stats?.students ?? "—"} />
        <Stat icon={BookOpen} label="Classes" value={stats?.classes ?? "—"} />
        <Stat icon={FileText} label="Assessments" value={stats?.assessments ?? "—"} />
      </div>

      {roles.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Getting started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>You don't have a role assigned yet. To set up the platform:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Ask the platform owner to make you a <strong>Super Admin</strong> from the database.</li>
              <li>Create your school in the <strong>Schools</strong> module.</li>
              <li>Add classes, subjects, and start admitting students.</li>
              <li>Assign roles to teachers, parents, and accountants.</li>
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
