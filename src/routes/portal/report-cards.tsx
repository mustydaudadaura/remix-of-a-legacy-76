import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useParentAuth } from "@/hooks/useParentAuth";
import { getActiveChildId } from "@/routes/portal";
import { getPortalContext, getPortalReportCards } from "@/lib/api/portal.functions";
import { getUnlockedReportsFn } from "@/lib/api/pins.functions";
import { ScratchCardModal } from "@/components/portal/ScratchCardModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock, Eye, KeyRound } from "lucide-react";

export const Route = createFileRoute("/portal/report-cards")({
  head: () => ({ meta: [{ title: "Child Results — Alegacy Parent Portal" }, { name: "description", content: "Child Results for authorized school accounts and families in Alegacy." }, { property: "og:title", content: "Child Results — Alegacy Parent Portal" }, { property: "og:description", content: "Child Results for authorized school accounts and families in Alegacy." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { token, parent } = useParentAuth();
  const [scratchModalOpen, setScratchModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);

  const { data: ctx } = useQuery({
    queryKey: ["portal-ctx", token],
    queryFn: () => getPortalContext({ data: { token: token! } }),
    enabled: !!token,
  });

  const activeSid = getActiveChildId();
  const kids = ctx?.students ?? [];
  const sid = kids.some((k: any) => k.id === activeSid) ? activeSid : kids[0]?.id;
  const currentChild = kids.find((k: any) => k.id === sid) ?? kids[0];

  const { data } = useQuery({
    queryKey: ["portal-rc", token, sid],
    queryFn: () => getPortalReportCards({ data: { token: token!, student_id: sid! } }),
    enabled: !!token && !!sid,
  });

  const getUnlocked = useServerFn(getUnlockedReportsFn);
  const { data: unlockedData } = useQuery({
    queryKey: ["unlocked-reports", sid],
    queryFn: () => getUnlocked({ data: { student_id: sid! } }),
    enabled: !!sid,
  });

  const unlockedIds = new Set(unlockedData?.unlockedReportCardIds ?? []);
  const rows = data?.rows ?? [];

  const handleViewReport = (r: any) => {
    const isUnlocked = unlockedIds.has(r.id);
    if (isUnlocked) {
      navigate({ to: "/portal/report-card/$id", params: { id: r.id } });
    } else {
      setSelectedReport(r);
      setScratchModalOpen(true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Scratch Card Protected Results</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            In accordance with school policy, enter the official result checker PIN card issued by the school to view your child's terminal breakdown.
          </p>
        </div>
        <Badge variant="outline" className="border-primary/30 text-primary text-[10px] shrink-0 font-medium">
          Exam PIN Required
        </Badge>
      </div>

      {rows.length === 0 && (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No published report cards yet.</CardContent></Card>
      )}

      {rows.map((r: any) => {
        const isUnlocked = unlockedIds.has(r.id);
        return (
          <Card key={r.id} className="relative overflow-hidden">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base capitalize">
                {r.session} • {r.term} term
              </CardTitle>
              {isUnlocked ? (
                <Badge className="bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/20 text-xs gap-1 border border-emerald-300">
                  <Unlock className="h-3 w-3" /> Unlocked
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Lock className="h-3 w-3 text-amber-600" /> Scratch Card Required
                </Badge>
              )}
            </CardHeader>

            <CardContent>
              {isUnlocked ? (
                <div className="mb-4 grid grid-cols-3 gap-2 text-center text-sm">
                  <div><div className="text-xl font-bold text-emerald-700">{Number(r.average ?? 0).toFixed(1)}%</div><div className="text-xs text-muted-foreground">Average</div></div>
                  <div><div className="text-xl font-bold">{r.position ?? "—"}/{r.class_size ?? "—"}</div><div className="text-xs text-muted-foreground">Position</div></div>
                  <div><div className="text-xl font-bold">{r.gpa ?? "—"}</div><div className="text-xs text-muted-foreground">GPA</div></div>
                </div>
              ) : (
                <div className="mb-4 rounded-lg bg-muted/60 p-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    Grades, subject ranks, and cumulative comments are locked until verified with a scratch card.
                  </p>
                </div>
              )}

              <Button
                variant={isUnlocked ? "default" : "outline"}
                className="w-full gap-2 font-medium"
                onClick={() => handleViewReport(r)}
              >
                {isUnlocked ? (
                  <>
                    <Eye className="h-4 w-4" /> View Full Report Sheet
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4 text-primary" /> Scratch Card to Unlock Result
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        );
      })}

      {selectedReport && sid && (
        <ScratchCardModal
          open={scratchModalOpen}
          onOpenChange={setScratchModalOpen}
          studentId={sid}
          studentName={`${currentChild?.first_name || ""} ${currentChild?.last_name || ""}`}
          studentAdmissionNo={currentChild?.admission_no}
          reportCardId={selectedReport.id}
          session={selectedReport.session}
          term={selectedReport.term}
          schoolId={ctx?.school?.id}
          onSuccess={(unlockedId) => {
            qc.invalidateQueries({ queryKey: ["unlocked-reports", sid] });
            navigate({ to: "/portal/report-card/$id", params: { id: unlockedId } });
          }}
        />
      )}
    </div>
  );
}
