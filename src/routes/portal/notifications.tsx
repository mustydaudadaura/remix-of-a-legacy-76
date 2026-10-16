import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParentAuth } from "@/hooks/useParentAuth";
import { getPortalNotifications, markNotificationRead, getParentPreferences, saveParentPreferences } from "@/lib/api/portal.functions";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, CheckCircle2, Clock, AlertTriangle, Calendar } from "lucide-react";

export const Route = createFileRoute("/portal/notifications")({
  head: () => ({
    meta: [
      { title: "Family Alerts & Friday Updates — EduERP Parent Portal" },
      { name: "description", content: "Weekly student performance digests, punctuality updates, and school notices." },
      { property: "og:title", content: "Family Alerts & Friday Updates — EduERP Parent Portal" },
      { property: "og:description", content: "Weekly student performance digests, punctuality updates, and school notices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-3 max-w-4xl mx-auto">
      <Card className="rounded-xl border border-border shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="text-sm font-semibold">Notification Preferences</div>
          <label htmlFor="pref_news" className="flex items-center justify-between gap-3 text-sm cursor-pointer">
            <span>Newsletters & school news</span>
            <Switch id="pref_news" checked={!muted.includes("news")} onCheckedChange={(v) => toggle("news", v)} />
          </label>
          <label htmlFor="pref_general" className="flex items-center justify-between gap-3 text-sm cursor-pointer">
            <span>General school notices</span>
            <Switch id="pref_general" checked={!muted.includes("general")} onCheckedChange={(v) => toggle("general", v)} />
          </label>
          <p className="text-xs text-muted-foreground">
            Weekly Friday performance updates, attendance alerts, and fee receipts always arrive.
          </p>
        </CardContent>
      </Card>

      {rows.length === 0 && (
        <Card className="rounded-xl border border-border p-12 text-center text-sm text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="font-semibold">No notifications</p>
          <p className="text-xs">Your inbox is clear. Important updates and Friday digests will appear here.</p>
        </Card>
      )}

      {rows.map((n: any) => {
        const isFridayDigest = n.meta?.friday_digest === true;
        const overallFlag = n.meta?.overall_flag;
        const children = n.meta?.children as Array<{ name: string; punctuality: string; flags: string[] }> | undefined;

        return (
          <Card
            key={n.id}
            className={`rounded-xl border transition cursor-pointer shadow-sm ${
              n.read_at ? "opacity-75 bg-card/60" : "bg-card hover:border-primary/40 border-primary/20"
            } ${isFridayDigest ? "border-l-4 border-l-primary" : ""}`}
            onClick={() => !n.read_at && mark(n.id)}
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {isFridayDigest ? (
                      <Badge className="bg-primary hover:bg-primary text-primary-foreground gap-1 text-[11px]">
                        <Sparkles className="h-3 w-3" />
                        Friday Student Update
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="capitalize text-[11px]">
                        {n.type.replace("_", " ")}
                      </Badge>
                    )}

                    {overallFlag === "praise" && (
                      <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Praise & Commendation
                      </Badge>
                    )}
                    {overallFlag === "watchlist" && (
                      <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50 text-[10px] gap-1">
                        <Clock className="h-3 w-3" />
                        Weekly Watchlist
                      </Badge>
                    )}
                    {overallFlag === "action_required" && (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Action Suggested
                      </Badge>
                    )}

                    {!n.read_at && <span className="text-xs font-semibold text-primary">• new</span>}
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-foreground">{n.title}</h3>

                  {n.body && (
                    <div className="text-xs sm:text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed rounded-lg bg-muted/30 p-3 border border-border/60">
                      {n.body}
                    </div>
                  )}

                  {/* Children tags in Friday Digest */}
                  {children && children.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {children.map((c, idx) => (
                        <div key={idx} className="rounded-md border border-border bg-background px-2.5 py-1 text-xs">
                          <span className="font-semibold text-foreground">{c.name}:</span>{" "}
                          <span className="capitalize text-muted-foreground">{c.punctuality.replace("_", " ")}</span>
                          {c.flags && c.flags.length > 0 && (
                            <span className="text-[11px] text-amber-600 ml-1">({c.flags.join(", ")})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-[11px] text-muted-foreground pt-1">
                    {new Date(n.visible_from ?? n.created_at).toLocaleString("en-NG", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
