import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useParentAuth } from "@/hooks/useParentAuth";
import { getActiveChildId } from "@/routes/_portal";
import { getPortalSummary } from "@/lib/api/portal.functions";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarCheck, Wallet, Award, Bell } from "lucide-react";

export const Route = createFileRoute("/portal/")({
  component: PortalHome,
});

function PortalHome() {
  const { token } = useParentAuth();
  const sid = getActiveChildId();
  const { data } = useQuery({
    queryKey: ["portal-summary", token, sid],
    queryFn: () => getPortalSummary({ data: { token: token!, student_id: sid ?? undefined } }),
    enabled: !!token,
  });

  const att = data?.attendance;
  const pct = att && att.total > 0 ? Math.round((att.present / att.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Tile to="/portal/attendance" icon={CalendarCheck} title="Attendance (30d)" value={`${pct}%`} hint={`${att?.present ?? 0}/${att?.total ?? 0} days`} />
        <Tile to="/portal/fees" icon={Wallet} title="Outstanding fees" value={`₦${(data?.balance ?? 0).toLocaleString()}`} hint="Tap to view invoices" />
        <Tile to="/portal/report-cards" icon={Award} title="Latest report" value={data?.latestReport ? `${data.latestReport.average?.toFixed?.(1) ?? data.latestReport.average}%` : "—"} hint={data?.latestReport ? `${data.latestReport.session} • ${data.latestReport.term}` : "No reports yet"} />
        <Tile to="/portal/notifications" icon={Bell} title="Unread alerts" value={String(data?.unreadCount ?? 0)} hint="News, reminders" />
      </div>
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Welcome to your parent portal. Use the tabs at the bottom to view attendance, report cards, fees, receipts, and school announcements.
        </CardContent>
      </Card>
    </div>
  );
}

function Tile({ to, icon: Icon, title, value, hint }: any) {
  return (
    <Link to={to}>
      <Card className="h-full transition hover:shadow-md">
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{title}</span>
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
        </CardContent>
      </Card>
    </Link>
  );
}
