import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useParentAuth } from "@/hooks/useParentAuth";
import { getActiveChildId } from "@/routes/_portal";
import { getPortalReportCards } from "@/lib/api/portal.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/portal/report-cards")({
  component: Page,
});

function Page() {
  const { token } = useParentAuth();
  const sid = getActiveChildId();
  const { data } = useQuery({
    queryKey: ["portal-rc", token, sid],
    queryFn: () => getPortalReportCards({ data: { token: token!, student_id: sid! } }),
    enabled: !!token && !!sid,
  });
  const rows = data?.rows ?? [];
  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No published report cards yet.</CardContent></Card>
      )}
      {rows.map((r: any) => (
        <Card key={r.id}>
          <CardHeader className="pb-2"><CardTitle className="text-base capitalize">{r.session} • {r.term} term</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-3 grid grid-cols-3 gap-2 text-center text-sm">
              <div><div className="text-xl font-bold">{Number(r.average ?? 0).toFixed(1)}%</div><div className="text-xs text-muted-foreground">Average</div></div>
              <div><div className="text-xl font-bold">{r.position ?? "—"}/{r.class_size ?? "—"}</div><div className="text-xs text-muted-foreground">Position</div></div>
              <div><div className="text-xl font-bold">{r.gpa ?? "—"}</div><div className="text-xs text-muted-foreground">GPA</div></div>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link to="/report-card/$id" params={{ id: r.id }}>View report</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
