import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useParentAuth } from "@/hooks/useParentAuth";
import { useQuery } from "@tanstack/react-query";
import { getPortalContext } from "@/lib/api/portal.functions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Home, CalendarCheck, Award, Wallet, Bell, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal")({
  head: () => ({ meta: [{ title: "Parent Portal — EduERP" }] }),
  component: PortalLayout,
});

const CHILD_KEY = "portal_active_child";

export function getActiveChildId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CHILD_KEY);
}
export function setActiveChildId(id: string) {
  localStorage.setItem(CHILD_KEY, id);
}

function PortalLayout() {
  const { token, parent, ready, signOut } = useParentAuth();
  const navigate = useNavigate();
  const { location } = useRouterState();
  const [activeChild, setActive] = useState<string | null>(getActiveChildId());

  useEffect(() => {
    if (ready && !token) navigate({ to: "/auth", replace: true });
  }, [ready, token, navigate]);

  const ctx = useQuery({
    queryKey: ["portal-ctx", token],
    queryFn: () => getPortalContext({ data: { token: token! } }),
    enabled: !!token,
  });

  useEffect(() => {
    const kids = ctx.data?.students ?? [];
    if (kids.length && !activeChild) {
      setActiveChildId(kids[0].id);
      setActive(kids[0].id);
    }
  }, [ctx.data, activeChild]);

  if (!ready || !token) return <div className="flex min-h-screen items-center justify-center">Loading…</div>;

  const kids = ctx.data?.students ?? [];
  const school = ctx.data?.school;

  const tabs = [
    { to: "/portal", label: "Home", icon: Home },
    { to: "/portal/attendance", label: "Attendance", icon: CalendarCheck },
    { to: "/portal/report-cards", label: "Reports", icon: Award },
    { to: "/portal/fees", label: "Fees", icon: Wallet },
    { to: "/portal/notifications", label: "Alerts", icon: Bell },
  ] as const;

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link to="/portal" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{school?.name ?? "Portal"}</div>
              <div className="truncate text-xs text-muted-foreground">Hi, {parent?.full_name}</div>
            </div>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate({ to: "/auth" }); }}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        {kids.length > 0 && (
          <div className="mx-auto mt-3 max-w-3xl">
            <Select value={activeChild ?? undefined} onValueChange={(v) => { setActiveChildId(v); setActive(v); }}>
              <SelectTrigger><SelectValue placeholder="Select a child" /></SelectTrigger>
              <SelectContent>
                {kids.map((k: any) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.first_name} {k.last_name} — {k.classes?.name ?? "No class"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 p-4">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-5">
          {tabs.map((t) => {
            const active = t.to === "/portal" ? location.pathname === "/portal" : location.pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link key={t.to} to={t.to} className={cn("flex flex-col items-center gap-1 py-2 text-xs", active ? "text-primary font-medium" : "text-muted-foreground")}>
                <Icon className="h-5 w-5" />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
