import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useParentAuth } from "@/hooks/useParentAuth";
import { getPortalReportCardDetail } from "@/lib/api/portal.functions";
import { getUnlockedReportsFn, verifyAndUnlockReportCardFn } from "@/lib/api/pins.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ArrowLeft, Printer, Lock, KeyRound, Sparkles, ShieldAlert, CheckCircle2 } from "lucide-react";
import { ReportCardView } from "@/components/ReportCardView";
import { toast } from "sonner";
import { normalizePin, isValidPinFormat } from "@/lib/pin-system";

export const Route = createFileRoute("/portal/report-card/$id")({
  head: () => ({
    meta: [
      { title: "Child Report Card — EduERP Parent Portal" },
      { name: "description", content: "Child Report Card for authorized school accounts and families in EduERP." },
      { property: "og:title", content: "Child Report Card — EduERP Parent Portal" },
      { property: "og:description", content: "Child Report Card for authorized school accounts and families in EduERP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { token } = useParentAuth();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [serialNo, setSerialNo] = useState("");
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getUnlocked = useServerFn(getUnlockedReportsFn);
  const verifyPin = useServerFn(verifyAndUnlockReportCardFn);

  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-rc-detail", token, id],
    queryFn: () => getPortalReportCardDetail({ data: { token: token!, id } }),
    enabled: !!token,
  });

  const rc = data?.rc;
  const studentId = rc?.student_id;

  // Check if previously unlocked
  useEffect(() => {
    if (!studentId || typeof window === "undefined") return;
    try {
      const stored = sessionStorage.getItem(`unlocked_rc_${studentId}`);
      if (stored) {
        const ids: string[] = JSON.parse(stored);
        if (ids.includes(id)) {
          setIsUnlocked(true);
          return;
        }
      }
    } catch {
      // ignore
    }

    // Check server registry
    getUnlocked({ data: { student_id: studentId, school_id: rc?.school_id } })
      .then((res) => {
        if (res?.unlockedReportCardIds?.includes(id)) {
          setIsUnlocked(true);
        }
      })
      .catch(() => {});
  }, [id, studentId, rc?.school_id]);

  const unlockMutation = useMutation({
    mutationFn: () =>
      verifyPin({
        data: {
          school_id: rc?.school_id,
          student_id: studentId!,
          report_card_id: id,
          pin: normalizePin(pin),
          serial_no: serialNo.trim().toUpperCase(),
          session: rc?.session,
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        setErrorMsg(res.error || "Verification failed");
        toast.error(res.error || "Invalid PIN or Serial Number");
        return;
      }

      toast.success(res.message || "Report card unlocked successfully!");
      setIsUnlocked(true);
      if (typeof window !== "undefined" && studentId) {
        try {
          const stored = sessionStorage.getItem(`unlocked_rc_${studentId}`);
          const list = stored ? JSON.parse(stored) : [];
          if (!list.includes(id)) list.push(id);
          sessionStorage.setItem(`unlocked_rc_${studentId}`, JSON.stringify(list));
        } catch {
          // ignore
        }
      }
    },
    onError: (e: Error) => {
      setErrorMsg(e.message || "Could not verify PIN");
      toast.error(e.message || "Verification error");
    },
  });

  const handleAutofillDemo = () => {
    setSerialNo("EDU-2026-DEMO-0001");
    setPin("8821-4902-1134");
    setErrorMsg(null);
    toast.info("Autofilled demo scratch card credentials");
  };

  const handlePinChange = (val: string) => {
    const digits = val.replace(/[^0-9]/g, "").slice(0, 12);
    let formatted = "";
    for (let i = 0; i < digits.length; i++) {
      if (i > 0 && i % 4 === 0) formatted += "-";
      formatted += digits[i];
    }
    setPin(formatted);
    if (errorMsg) setErrorMsg(null);
  };

  if (isLoading) return <div className="p-8 text-muted-foreground text-sm">Loading report card…</div>;
  if (error || !rc) return <div className="p-8 text-destructive text-sm">Report card not available.</div>;

  // If card is locked, render the Scratch Card PIN challenge screen
  if (!isUnlocked) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-8 px-4">
        <Link
          to="/portal/report-cards"
          className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to report cards
        </Link>

        <Card className="border-2 border-primary/20 shadow-md">
          <CardHeader className="bg-muted/30 border-b text-center pb-4">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Lock className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg">Scratch-Card PIN Required</CardTitle>
            <CardDescription className="text-xs">
              This terminal report card is secured. Enter a valid 12-digit scratch card PIN &amp; Serial Number to access.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-4">
            <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1 border">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Candidate:</span>
                <span className="font-semibold">{rc.students?.first_name} {rc.students?.last_name} ({rc.students?.admission_no})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Class &amp; Term:</span>
                <span className="font-mono capitalize">{rc.classes?.name} · {rc.session} ({rc.term} Term)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">National Limit:</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Valid for up to 5 checks</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="serial" className="text-xs font-semibold">
                  Card Serial Number
                </Label>
                <Input
                  id="serial"
                  placeholder="e.g. EDU-2026-DEMO-0001"
                  value={serialNo}
                  onChange={(e) => setSerialNo(e.target.value.toUpperCase())}
                  className="font-mono uppercase tracking-wider text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pin" className="text-xs font-semibold">
                  12-Digit Security PIN
                </Label>
                <div className="relative">
                  <Input
                    id="pin"
                    placeholder="XXXX-XXXX-XXXX"
                    value={pin}
                    onChange={(e) => handlePinChange(e.target.value)}
                    maxLength={14}
                    className="font-mono font-bold tracking-widest text-base pr-9 text-primary"
                  />
                  <KeyRound className="h-4 w-4 absolute right-3 top-2.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Demo Mode Button */}
              <div className="rounded-lg border border-dashed p-3 bg-muted/20 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <span className="font-semibold flex items-center gap-1 text-primary">
                    <Sparkles className="h-3.5 w-3.5" /> Testing Mode
                  </span>
                  <p className="text-[10px] text-muted-foreground">
                    Autofill active demo scratch card.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutofillDemo}
                  className="text-xs h-7"
                >
                  Autofill Demo Card
                </Button>
              </div>
            </div>
          </CardContent>

          <CardFooter className="border-t bg-muted/10 p-4 flex flex-col gap-2">
            <Button
              className="w-full font-semibold shadow-xs"
              disabled={!serialNo.trim() || normalizePin(pin).length !== 12 || unlockMutation.isPending}
              onClick={() => unlockMutation.mutate()}
            >
              {unlockMutation.isPending ? "Validating Scratch Card…" : "Unlock & View Report Card"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Once unlocked, display full official report card
  return (
    <div className="bg-muted/30 min-h-screen">
      <div className="print:hidden sticky top-0 z-10 border-b bg-card px-4 py-3 flex items-center justify-between shadow-xs">
        <Link
          to="/portal/report-cards"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to results
        </Link>
        <div className="flex items-center gap-3">
          <Badge className="bg-emerald-600 text-white text-xs gap-1 hidden sm:inline-flex">
            <CheckCircle2 className="h-3.5 w-3.5" /> PIN Verified
          </Badge>
          <Button onClick={() => window.print()} className="font-semibold shadow-xs">
            <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
          </Button>
        </div>
      </div>
      <ReportCardView rc={rc} assessments={data.assessments as any} />
    </div>
  );
}
