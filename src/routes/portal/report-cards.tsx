import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useParentAuth } from "@/hooks/useParentAuth";
import { getActiveChildId } from "@/routes/portal";
import { getPortalContext, getPortalReportCards } from "@/lib/api/portal.functions";
import { getUnlockedReportsFn } from "@/lib/api/pins.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScratchCardModal } from "@/components/portal/ScratchCardModal";
import { Lock, Unlock, CheckCircle2, ShieldCheck, ArrowRight, Eye, Sparkles } from "lucide-react";

export const Route = createFileRoute("/portal/report-cards")({
  head: () => ({
    meta: [
      { title: "Child Results & Scratch-Card Checker — EduERP Parent Portal" },
      { name: "description", content: "Access official termly report cards with your 12-digit scratch card PIN." },
      { property: "og:title", content: "Child Results & Scratch-Card Checker — EduERP Parent Portal" },
      { property: "og:description", content: "Verify scratch-card PIN to view and download your child's terminal report card." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const router = useRouter();
  const { token } = useParentAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [localUnlocked, setLocalUnlocked] = useState<Set<string>>(new Set());

  const getUnlocked = useServerFn(getUnlockedReportsFn);

  const { data: ctx } = useQuery({
    queryKey: ["portal-ctx", token],
    queryFn: () => getPortalContext({ data: { token: token! } }),
    enabled: !!token,
  });

  const activeSid = getActiveChildId();
  const kids = ctx?.students ?? [];
  const activeStudent = kids.find((k: any) => k.id === activeSid) || kids[0];
  const sid = activeStudent?.id;

  const { data } = useQuery({
    queryKey: ["portal-rc", token, sid],
    queryFn: () => getPortalReportCards({ data: { token: token!, student_id: sid! } }),
    enabled: !!token && !!sid,
  });

  // Query server for cards previously unlocked for this student
  const { data: unlockedData, refetch: refetchUnlocked } = useQuery({
    queryKey: ["unlocked-rc", sid],
    queryFn: () => getUnlocked({ data: { student_id: sid!, school_id: ctx?.school?.id } }),
    enabled: !!sid,
  });

  // Sync server unlocked + local session unlocked
  useEffect(() => {
    if (sid && typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem(`unlocked_rc_${sid}`);
        if (stored) {
          const ids: string[] = JSON.parse(stored);
          setLocalUnlocked((prev) => new Set([...prev, ...ids]));
        }
      } catch {
        // ignore
      }
    }
  }, [sid]);

  useEffect(() => {
    if (unlockedData?.unlockedReportCardIds?.length) {
      setLocalUnlocked((prev) => new Set([...prev, ...unlockedData.unlockedReportCardIds]));
    }
  }, [unlockedData]);

  const rows = data?.rows ?? [];

  const handleOpenUnlockModal = (report: any) => {
    setSelectedReport(report);
    setModalOpen(true);
  };

  const handleUnlockedSuccess = (reportId: string) => {
    setLocalUnlocked((prev) => {
      const next = new Set(prev);
      next.add(reportId);
      if (typeof window !== "undefined" && sid) {
        sessionStorage.setItem(`unlocked_rc_${sid}`, JSON.stringify(Array.from(next)));
      }
      return next;
    });
    refetchUnlocked();
  };

  return (
    <div className="space-y-4">
      {/* Header Info Banner */}
      <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold flex items-center gap-1.5">
              Official Result Checker Portal
              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                Scratch Card Protected
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Candidate: <span className="font-semibold text-foreground">{activeStudent?.first_name} {activeStudent?.last_name}</span> ({activeStudent?.admission_no})
            </p>
          </div>
        </div>

        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Results verified by National Exam Standards</span>
        </div>
      </div>

      {rows.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No published report cards yet for this student.
          </CardContent>
        </Card>
      )}

      {rows.map((r: any) => {
        const isUnlocked = localUnlocked.has(r.id);

        return (
          <Card key={r.id} className="border shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-3 pt-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base capitalize flex items-center gap-2">
                  <span>{r.session} • {r.term} Term</span>
                  {isUnlocked ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] gap-1">
                      <Unlock className="h-3 w-3" /> Unlocked
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Lock className="h-3 w-3 text-muted-foreground" /> PIN Protected
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  Published terminal evaluation &amp; broadsheet record.
                </CardDescription>
              </div>

              {isUnlocked && (
                <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Ready to View &amp; Print
                </span>
              )}
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center text-sm bg-muted/20 p-3 rounded-lg border">
                <div>
                  <div className="text-xl font-bold font-mono">{Number(r.average ?? 0).toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground font-medium">Average</div>
                </div>
                <div>
                  <div className="text-xl font-bold font-mono">
                    {r.position ?? "—"} <span className="text-xs font-normal text-muted-foreground">/ {r.class_size ?? "—"}</span>
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">Class Position</div>
                </div>
                <div>
                  <div className="text-xl font-bold font-mono text-primary">{r.gpa ?? "—"}</div>
                  <div className="text-xs text-muted-foreground font-medium">National GPA</div>
                </div>
              </div>

              {isUnlocked ? (
                <Button asChild className="w-full font-semibold shadow-xs">
                  <Link to="/portal/report-card/$id" params={{ id: r.id }}>
                    <Eye className="mr-2 h-4 w-4" /> Open Full Report Card &amp; Print
                  </Link>
                </Button>
              ) : (
                <div className="space-y-2">
                  <Button
                    onClick={() => handleOpenUnlockModal(r)}
                    className="w-full font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-2"
                  >
                    <Lock className="h-4 w-4" />
                    Enter Scratch Card PIN to View Report
                    <ArrowRight className="h-4 w-4 ml-auto" />
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Requires a valid 12-digit scratch card PIN &amp; Serial Number issued by the school.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Interactive Scratch-Card Unlock Modal */}
      {selectedReport && (
        <ScratchCardModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          studentId={sid || ""}
          studentName={`${activeStudent?.first_name || ""} ${activeStudent?.last_name || ""}`}
          studentAdmissionNo={activeStudent?.admission_no || ""}
          reportCardId={selectedReport.id}
          session={selectedReport.session}
          term={selectedReport.term}
          schoolId={ctx?.school?.id}
          onSuccess={handleUnlockedSuccess}
        />
      )}
    </div>
  );
}
