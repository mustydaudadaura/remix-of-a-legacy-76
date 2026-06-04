import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useParentAuth } from "@/hooks/useParentAuth";
import { getActiveChildId } from "@/routes/portal";
import { getPortalAttendance } from "@/lib/api/portal.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/portal/attendance")({
  component: Page,
});

function Page() {
  const { token } = useParentAuth();
  const sid = getActiveChildId();
  const to = new Date().toISOString().slice(0, 10);
  const fromD = new Date(); fromD.setDate(fromD.getDate() - 60);
  const from = fromD.toISOString().slice(0, 10);

  const { data } = useQuery({
    queryKey: ["portal-att", token, sid, from, to],
    queryFn: () => getPortalAttendance({ data: { token: token!, student_id: sid!, from, to } }),
    enabled: !!token && !!sid,
  });

  const rows = data?.rows ?? [];
  const counts = rows.reduce((acc: any, r: any) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {});

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Last 60 days</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2 text-center text-sm">
            <Stat label="Present" v={counts.present ?? 0} />
            <Stat label="Absent" v={counts.absent ?? 0} />
            <Stat label="Late" v={counts.late ?? 0} />
            <Stat label="Excused" v={counts.excused ?? 0} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Daily log</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 && <p className="text-sm text-muted-foreground">No attendance records yet.</p>}
          {rows.map((r: any) => (
            <div key={r.date} className="flex items-center justify-between border-b py-2 last:border-0">
              <span className="text-sm">{new Date(r.date).toLocaleDateString()}</span>
              <Badge variant={r.status === "absent" ? "destructive" : "secondary"} className="capitalize">{r.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return <div className="rounded-md bg-muted/50 p-2"><div className="text-lg font-bold">{v}</div><div className="text-xs text-muted-foreground">{label}</div></div>;
}
