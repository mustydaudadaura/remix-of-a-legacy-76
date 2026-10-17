import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParentAuth } from "@/hooks/useParentAuth";
import { getPortalNotifications, markNotificationRead, getParentPreferences, saveParentPreferences } from "@/lib/api/portal.functions";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/portal/notifications")({
  head: () => ({ meta: [{ title: "Family Alerts — Alegace Parent Portal" }, { name: "description", content: "Family Alerts for authorized school accounts and families in Alegace." }, { property: "og:title", content: "Family Alerts — Alegace Parent Portal" }, { property: "og:description", content: "Family Alerts for authorized school accounts and families in Alegace." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

function Page() {
  const { token } = useParentAuth();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["portal-notifs", token],
    queryFn: () => getPortalNotifications({ data: { token: token! } }),
    enabled: !!token,
  });
  const rows = data?.rows ?? [];
  const mark = async (id: string) => {
    await markNotificationRead({ data: { token: token!, id } });
    qc.invalidateQueries({ queryKey: ["portal-notifs"] });
    qc.invalidateQueries({ queryKey: ["portal-summary"] });
  };
  const { data: prefs } = useQuery({
    queryKey: ["portal-prefs", token],
    queryFn: () => getParentPreferences({ data: { token: token! } }),
    enabled: !!token,
  });
  const muted: string[] = prefs?.muted_types ?? [];
  const toggle = async (type: "news" | "general", on: boolean) => {
    const next = (on ? muted.filter((t) => t !== type) : [...muted, type]) as ("news" | "general")[];
    try {
      await saveParentPreferences({ data: { token: token!, muted_types: next } });
      qc.invalidateQueries({ queryKey: ["portal-prefs"] });
      toast.success("Alert choices saved");
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <div className="space-y-2">
      <Card><CardContent className="space-y-3 p-4">
        <div className="text-sm font-medium">What alerts do you want?</div>
        <label htmlFor="pref_news" className="flex items-center justify-between gap-3 text-sm">Newsletters & school news<Switch id="pref_news" checked={!muted.includes("news")} onCheckedChange={(v) => toggle("news", v)} /></label>
        <label htmlFor="pref_general" className="flex items-center justify-between gap-3 text-sm">General notices<Switch id="pref_general" checked={!muted.includes("general")} onCheckedChange={(v) => toggle("general", v)} /></label>
        <p className="text-xs text-muted-foreground">Fee reminders and direct messages from the school always arrive.</p>
      </CardContent></Card>
      {rows.length === 0 && <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No notifications.</CardContent></Card>}
      {rows.map((n: any) => (
        <Card key={n.id} className={n.read_at ? "opacity-70" : ""} onClick={() => !n.read_at && mark(n.id)}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><Badge variant="outline" className="capitalize">{n.type.replace("_", " ")}</Badge>{!n.read_at && <span className="text-xs text-primary">• new</span>}</div>
                <div className="mt-1 font-medium">{n.title}</div>
                {n.body && <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{n.body}</div>}
                <div className="mt-1 text-xs text-muted-foreground">{new Date(n.visible_from ?? n.created_at).toLocaleString()}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
