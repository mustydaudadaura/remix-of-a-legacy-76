import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { verifyAndUnlockReportCardFn } from "@/lib/api/pins.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { KeyRound, ShieldAlert, Sparkles, CheckCircle2, Lock, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { isValidPinFormat, normalizePin } from "@/lib/pin-system";

interface ScratchCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName?: string;
  studentAdmissionNo?: string;
  reportCardId: string;
  session?: string;
  term?: string;
  schoolId?: string;
  onSuccess: (reportCardId: string) => void;
}

export function ScratchCardModal({
  open,
  onOpenChange,
  studentId,
  studentName = "Candidate",
  studentAdmissionNo = "Student",
  reportCardId,
  session = "2025/2026",
  term = "First",
  schoolId,
  onSuccess,
}: ScratchCardModalProps) {
  const [serialNo, setSerialNo] = useState("");
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const verifyPin = useServerFn(verifyAndUnlockReportCardFn);

  const unlockMutation = useMutation({
    mutationFn: () =>
      verifyPin({
        data: {
          school_id: schoolId,
          student_id: studentId,
          report_card_id: reportCardId,
          pin: normalizePin(pin),
          serial_no: serialNo.trim().toUpperCase(),
          session,
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        setErrorMsg(res.error || "Verification failed");
        toast.error(res.error || "Invalid PIN or Serial Number");
        return;
      }

      toast.success(res.message || "Report card unlocked successfully!");
      onSuccess(reportCardId);
      onOpenChange(false);
    },
    onError: (e: Error) => {
      setErrorMsg(e.message || "Could not verify PIN");
      toast.error(e.message || "Verification error");
    },
  });

  const handleAutofillDemo = () => {
    setSerialNo("ALG-2026-SCRATCH-001");
    setPin("8821-4902-1134");
    setErrorMsg(null);
    toast.info("Autofilled official Alegacy scratch card credentials");
  };

  const handlePinChange = (val: string) => {
    // Format as 4-4-4
    const digits = val.replace(/[^0-9]/g, "").slice(0, 12);
    let formatted = "";
    for (let i = 0; i < digits.length; i++) {
      if (i > 0 && i % 4 === 0) formatted += "-";
      formatted += digits[i];
    }
    setPin(formatted);
    if (errorMsg) setErrorMsg(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-1.5 border-b pb-3 text-left">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base flex items-center gap-2">
                Result Checker Scratch Card Access
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                  WAEC / NECO Standard
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Enter your 12-digit PIN &amp; Serial Number to access and print this report card.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Student & Term Context */}
        <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Candidate:</span>
            <span className="font-semibold">{studentName} ({studentAdmissionNo})</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Examination Period:</span>
            <span className="font-mono font-medium capitalize">{session} • {term} Term</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Usage Allowance:</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Valid for up to 5 checks</span>
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-3.5 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="serial" className="text-xs font-semibold">
              Scratch Card Serial Number
            </Label>
            <Input
              id="serial"
              placeholder="e.g. EDU-2026-DEMO-0001"
              value={serialNo}
              onChange={(e) => {
                setSerialNo(e.target.value.toUpperCase());
                if (errorMsg) setErrorMsg(null);
              }}
              className="font-mono uppercase tracking-wider text-sm"
            />
            <span className="text-[10px] text-muted-foreground block">
              Found on the front or barcode area of your school scratch card.
            </span>
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
            <span className="text-[10px] text-muted-foreground block">
              Gently scratch the silver foil on your card to reveal the 12 numeric digits.
            </span>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Demo Card Autofill */}
          <div className="rounded-lg border border-dashed p-2.5 bg-card flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <span className="font-semibold flex items-center gap-1 text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Testing / Demonstration Mode
              </span>
              <p className="text-[10px] text-muted-foreground">
                Don't have a physical card? Click to autofill active test scratch card.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutofillDemo}
              className="text-xs h-7"
            >
              Autofill Test PIN
            </Button>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!serialNo.trim() || normalizePin(pin).length !== 12 || unlockMutation.isPending}
            onClick={() => unlockMutation.mutate()}
            className="text-xs font-semibold shadow-xs"
          >
            {unlockMutation.isPending ? "Validating Card…" : "Check & Unlock Result"}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
