import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useParentAuth } from "@/hooks/useParentAuth";
import { getPortalContext } from "@/lib/api/portal.functions";
import { getActiveChildId, setActiveChildId } from "@/routes/portal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Check, User } from "lucide-react";

export const Route = createFileRoute("/portal/children")({
  head: () => ({ meta: [{ title: "My Children — Parent Portal" }, { name: "description", content: "My Children for authorized school accounts and families in EduERP." }, { property: "og:title", content: "My Children — Parent Portal" }, { property: "og:description", content: "My Children for authorized school accounts and families in EduERP." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ChildrenPage,
});

function ChildrenPage() {
  const { token, parent } = useParentAuth();
  const navigate = useNavigate();
  const active = getActiveChildId();

  const { data, isLoading } = useQuery({
    queryKey: ["portal-ctx", token],
    queryFn: () => getPortalContext({ data: { token: token! } }),
    enabled: !!token,
  });

  const kids = data?.students ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">My Children</h1>
        <p className="text-sm text-muted-foreground">
          All children linked to {parent?.full_name ?? "your"} phone number. Tap one to switch.
        </p>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : kids.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No children are linked to your phone number yet. Please ask the school admin to add
            your number to your child's record.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {kids.map((k: any) => {
            const isActive = k.id === active;
            const initials = `${k.first_name?.[0] ?? ""}${k.last_name?.[0] ?? ""}`.toUpperCase();
            return (
              <Card key={k.id} className={isActive ? "border-primary" : ""}>
                <CardContent className="flex items-center gap-3 p-4">
                  <Avatar className="h-12 w-12">
                    {k.photo_url ? <AvatarImage src={k.photo_url} alt={k.first_name} /> : null}
                    <AvatarFallback>{initials || <User className="h-5 w-5" />}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate font-medium">
                        {k.first_name} {k.last_name}
                      </div>
                      {isActive && (
                        <Badge variant="secondary" className="gap-1">
                          <Check className="h-3 w-3" /> Active
                        </Badge>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {k.classes?.name ?? "No class"} • Adm: {k.admission_no ?? "—"}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={isActive ? "secondary" : "default"}
                    onClick={() => {
                      setActiveChildId(k.id);
                      navigate({ to: "/portal" });
                    }}
                  >
                    {isActive ? "Open" : "Switch"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
