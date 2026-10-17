import { useState } from "react";
import { toast } from "sonner";
import {
  CreditCard,
  Building,
  CheckCircle2,
  AlertCircle,
  Copy,
  RefreshCw,
  Send,
  Zap,
  ArrowRight,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getStudentVirtualAccount, formatNaira } from "@/lib/nigerian-fees";
import { reconcileVirtualAccountPayment } from "@/lib/api/nigerian-fees.functions";

interface VirtualAccountModalProps {
  student: { id: string; first_name: string; last_name: string; admission_no: string };
  school: { id: string; name: string; code?: string | null };
  openBalance?: number;
  onPaymentSuccess?: () => void;
}

export function VirtualAccountReconciliationDialog({
  student,
  school,
  openBalance = 0,
  onPaymentSuccess,
}: VirtualAccountModalProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "simulate">("details");
  const [simAmount, setSimAmount] = useState(openBalance > 0 ? String(openBalance) : "50000");
  const [simPayer, setSimPayer] = useState("Mr. / Mrs. Parent");
  const [simBank, setSimBank] = useState("Access Bank PLC");
  const [simChannel, setSimChannel] = useState<"whatsapp" | "generic">("whatsapp");
  const [busy, setBusy] = useState(false);
  const [simResult, setSimResult] = useState<any | null>(null);

  const va = getStudentVirtualAccount(student, school);

  const copyAccount = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Virtual Account copied to clipboard");
  };

  const handleSimulateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await reconcileVirtualAccountPayment({
        data: {
          school_id: school.id,
          virtual_account: va.account_number,
          amount: Number(simAmount),
          student_id: student.id,
          admission_no: student.admission_no,
          sender_name: simPayer,
          sender_bank: simBank,
          send_receipt_alert: true,
          channel: simChannel,
        },
      });

      setSimResult(res);
      toast.success(`Cleared ${formatNaira(res.amount_cleared)}! WhatsApp/SMS receipt triggered.`);
      if (onPaymentSuccess) onPaymentSuccess();
    } catch (err: any) {
      toast.error("Reconciliation failed: " + (err?.message || "Unknown error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-semibold">
          <CreditCard className="h-3.5 w-3.5 text-primary" />
          Virtual Account
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-border bg-card/60">
          <DialogTitle className="text-sm font-bold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Dedicated Virtual Account
            </span>
            <Badge variant="outline" className="text-[10px] uppercase font-mono">
              Auto-Reconciliation
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="p-5 space-y-4 text-xs">
          {/* Card Presentation of Student's Virtual Account */}
          <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-background p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Building className="h-4 w-4 text-primary" />
                <span className="font-bold text-xs">{va.bank_name}</span>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 text-[9px]">
                NUBAN Active
              </Badge>
            </div>

            <div className="space-y-1 my-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                Account Number
              </p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-mono font-bold tracking-wider text-foreground">
                  {va.account_number}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => copyAccount(va.account_number)}
                  title="Copy account number"
                >
                  <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </Button>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between">
              <div>
                <p className="text-[9px] text-muted-foreground uppercase">Beneficiary Name</p>
                <p className="font-semibold text-xs text-foreground">{va.account_name}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-muted-foreground uppercase">Admission No</p>
                <p className="font-mono text-xs text-foreground font-semibold">{student.admission_no}</p>
              </div>
            </div>
          </div>

          {/* Webhook & Instant Reconciliation Simulator */}
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span>Simulate / Reconcile Bank Transfer</span>
              </div>
              <Badge variant="secondary" className="text-[9px]">
                Live Webhook Endpoint Ready
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              When a parent transfers funds to this virtual account via mobile banking or USSD, the payment gateway webhook automatically clears invoices and triggers WhatsApp/SMS receipts.
            </p>

            <form onSubmit={handleSimulateWebhook} className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Transfer Amount (₦)</Label>
                  <Input
                    type="number"
                    value={simAmount}
                    onChange={(e) => setSimAmount(e.target.value)}
                    className="h-7 text-xs font-semibold"
                    required
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Payer Name</Label>
                  <Input
                    value={simPayer}
                    onChange={(e) => setSimPayer(e.target.value)}
                    className="h-7 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Sending Bank</Label>
                  <Input
                    value={simBank}
                    onChange={(e) => setSimBank(e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Receipt Alert Channel</Label>
                  <Select value={simChannel} onValueChange={(v: any) => setSimChannel(v)}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp Receipt</SelectItem>
                      <SelectItem value="generic">SMS Alert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                type="submit"
                disabled={busy}
                className="w-full h-8 text-xs font-semibold shadow-sm"
              >
                {busy ? (
                  <>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Clearing via Webhook…
                  </>
                ) : (
                  <>
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    Process Payment & Trigger Alert
                  </>
                )}
              </Button>
            </form>

            {simResult && (
              <div className="mt-2 rounded border border-emerald-500/30 bg-emerald-50/40 p-2.5 text-[11px] text-emerald-900 space-y-1">
                <div className="flex items-center gap-1 font-semibold text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Reconciled Successfully! Ref: {simResult.reference}</span>
                </div>
                <p>
                  Cleared <b>{formatNaira(simResult.amount_cleared)}</b> across {simResult.payments?.length} invoice(s).
                </p>
                {simResult.alert_sent && (
                  <p className="text-emerald-700 font-medium">
                    ✓ WhatsApp/SMS receipt broadcast to registered parent phones.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="text-[10px] text-muted-foreground flex items-center justify-between">
            <span>Webhook URL: <code>/api/public/virtual-account-webhook</code></span>
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <ShieldCheck className="h-3 w-3" /> Real-time CBN / NIBSS Verified
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
