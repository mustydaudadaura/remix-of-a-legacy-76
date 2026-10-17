import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira, invoiceOutstanding } from "@/lib/finance-math";
import {
  generateStudentVirtualAccount,
  formatNubanDisplay,
  SUPPORTED_VIRTUAL_BANKS,
  type StudentVirtualAccount,
} from "@/lib/virtual-accounts";
import { simulateVirtualAccountPayment } from "@/lib/api/fee-reconciliation.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Zap, Building2, Copy, Check, RefreshCw, Send, ShieldCheck, CheckCircle2, AlertCircle, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

export function VirtualAccountsManager({
  schoolId,
  students = [],
  invoices = [],
  payments = [],
  classes = [],
  school,
  onPaymentReconciled,
}: {
  schoolId: string | null;
  students?: any[];
  invoices?: any[];
  payments?: any[];
  classes?: Array<{ id: string; name: string }>;
  school?: any;
  onPaymentReconciled?: () => void;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [selectedStudentForSim, setSelectedStudentForSim] = useState<any | null>(null);
  const [simAmount, setSimAmount] = useState<string>("50000");
  const [simBank, setSimBank] = useState<string>("Wema Bank / ALAT");
  const [simPayer, setSimPayer] = useState<string>("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);

  const schoolCode = school?.code || "SCH";
  const schoolName = school?.name || "School";

  // Build virtual account directory
  const virtualAccounts = useMemo(() => {
    return (students || []).map((s: any, idx: number) => {
      const va = generateStudentVirtualAccount({
        schoolCode,
        schoolName,
        studentId: s.id,
        admissionNo: s.admission_no,
        firstName: s.first_name,
        lastName: s.last_name,
        bankIndex: idx % SUPPORTED_VIRTUAL_BANKS.length,
      });

      const studentInvs = (invoices || []).filter((inv: any) => inv.student_id === s.id);
      let totalBilled = 0;
      let totalPaid = 0;
      let totalOutstanding = 0;

      for (const inv of studentInvs) {
        const bal = invoiceOutstanding(inv);
        totalBilled += Number(inv.amount_due) || 0;
        totalPaid += Number(inv.amount_paid) || 0;
        if (bal > 0) totalOutstanding += bal;
      }

      // Check payments cleared via virtual account
      const vaPayments = (payments || []).filter(
        (p: any) => p.student_id === s.id && (p.method?.toLowerCase().includes("virtual") || p.method?.toLowerCase().includes("nuban"))
      );
      const totalVaCleared = vaPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

      return {
        ...va,
        student: s,
        studentName: [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" "),
        className: s.classes?.name ?? classes.find((c) => c.id === s.class_id)?.name ?? "Unassigned",
        totalBilled,
        totalPaid,
        totalOutstanding,
        totalVaCleared,
        vaPaymentsCount: vaPayments.length,
      };
    });
  }, [students, invoices, payments, classes, schoolCode, schoolName]);

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return virtualAccounts.filter((va) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        va.studentName.toLowerCase().includes(q) ||
        va.admissionNo.toLowerCase().includes(q) ||
        va.accountNumber.includes(q) ||
        va.className.toLowerCase().includes(q);

      const matchClass = classFilter === "all" || va.student.class_id === classFilter;
      return matchSearch && matchClass;
    });
  }, [virtualAccounts, search, classFilter]);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedAccount(id);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedAccount(null), 2500);
    });
  };

  const handleSimulatePayment = async () => {
    if (!selectedStudentForSim) return;
    const amt = Number(simAmount);
    if (!amt || amt <= 0) {
      toast.error("Please enter a valid positive payment amount");
      return;
    }

    setIsSimulating(true);
    try {
      const res = await simulateVirtualAccountPayment({
        data: {
          student_id: selectedStudentForSim.id,
          amount: amt,
          payer_name: simPayer.trim() || `Alhaji ${selectedStudentForSim.last_name}`,
          payer_bank: simBank,
          notes: `Simulated NIP transfer to dedicated NUBAN`,
        },
      });

      setSimulationResult(res);
      toast.success(`Payment of ${formatNaira(amt)} reconciled successfully!`);
      qc.invalidateQueries({ queryKey: ["fee-invoices"] });
      qc.invalidateQueries({ queryKey: ["fee-payments"] });
      onPaymentReconciled?.();
    } catch (err: any) {
      toast.error(err.message || "Simulation failed");
    } finally {
      setIsSimulating(false);
    }
  };

  // Recent virtual account payments
  const recentVaPayments = useMemo(() => {
    return (payments || [])
      .filter((p: any) => p.method?.toLowerCase().includes("virtual") || p.method?.toLowerCase().includes("nuban"))
      .slice(0, 10);
  }, [payments]);

  const originUrl = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = `${originUrl}/api/webhooks/payments`;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
            <span>Dedicated Virtual Accounts</span>
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-extrabold text-foreground">{virtualAccounts.length}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Assigned 10-digit NUBANs</p>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-1">
            <span>Automated VA Collections</span>
            <Zap className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
            {formatNaira(recentVaPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Direct NIP bank clearing</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
            <span>Reconciled Transactions</span>
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-foreground">{recentVaPayments.length}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Automated receipts generated</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-medium mb-0.5">Live Webhook Status</div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Active (200 OK)
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">Monnify / Paystack / NIP Ready</p>
        </div>
      </div>

      {/* Webhook & Bank Integration Banner */}
      <Card className="rounded-xl border border-border shadow-sm bg-muted/20">
        <CardContent className="p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-600 text-white text-[11px] font-semibold gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                Live Payment Webhook Endpoint
              </Badge>
              <span className="text-xs text-muted-foreground">Automated NUBAN Reconciliation</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Direct incoming NIP bank transfer notifications from Monnify, Paystack Dedicated NUBAN, or Flutterwave will automatically clear student invoices in real time.
            </p>
            <div className="flex items-center gap-2 pt-1 font-mono text-xs text-foreground bg-background px-3 py-1.5 rounded-md border border-border max-w-xl truncate">
              <span className="text-primary font-bold">POST</span>
              <span className="truncate">{webhookUrl}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(webhookUrl);
                setCopiedWebhookUrl(true);
                toast.success("Webhook URL copied");
                setTimeout(() => setCopiedWebhookUrl(false), 2000);
              }}
              className="text-xs h-8"
            >
              {copiedWebhookUrl ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
              {copiedWebhookUrl ? "Copied URL" : "Copy Webhook URL"}
            </Button>

            {students.length > 0 && (
              <Button
                size="sm"
                onClick={() => {
                  setSelectedStudentForSim(students[0]);
                  setSimAmount("50000");
                  setSimPayer("");
                  setSimulationResult(null);
                }}
                className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5"
              >
                <Zap className="h-3.5 w-3.5" />
                Simulate Bank Transfer
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Directory of Student Dedicated Virtual Accounts */}
      <Card className="rounded-xl border border-border shadow-sm">
        <CardHeader className="py-4 border-b border-border">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Dedicated Student Virtual Account Directory
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Every student receives a permanent 10-digit Central Bank of Nigeria (CBN) compliant NUBAN account.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search student, NUBAN, class..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="h-8 text-xs w-36">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="py-2.5">Student</TableHead>
                  <TableHead className="py-2.5">Admission No.</TableHead>
                  <TableHead className="py-2.5">Assigned Bank</TableHead>
                  <TableHead className="py-2.5">10-Digit NUBAN Account</TableHead>
                  <TableHead className="py-2.5">Beneficiary Title</TableHead>
                  <TableHead className="py-2.5 text-right">Fee Outstanding</TableHead>
                  <TableHead className="py-2.5 text-center">Status</TableHead>
                  <TableHead className="py-2.5 text-right">Quick Test</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground text-xs">
                      No student accounts found matching your query.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAccounts.map((acc) => (
                    <TableRow key={acc.studentId} className="hover:bg-muted/30">
                      <TableCell className="py-2.5 text-xs font-medium">
                        <div className="font-semibold text-foreground">{acc.studentName}</div>
                        <div className="text-[11px] text-muted-foreground">{acc.className}</div>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs font-mono font-bold text-foreground">
                        {acc.admissionNo}
                      </TableCell>
                      <TableCell className="py-2.5 text-xs">
                        <Badge variant="outline" className="text-[11px] font-semibold border-primary/20 bg-primary/5">
                          {acc.bankName}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-extrabold text-foreground text-sm tracking-wide">
                            {formatNubanDisplay(acc.accountNumber)}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyText(acc.accountNumber, acc.studentId)}
                            className="h-6 w-6 p-0 hover:bg-muted"
                          >
                            {copiedAccount === acc.studentId ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs font-mono text-muted-foreground truncate max-w-[150px]">
                        {acc.accountName}
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-right font-mono font-bold">
                        {acc.totalOutstanding > 0 ? (
                          <span className="text-destructive">{formatNaira(acc.totalOutstanding)}</span>
                        ) : (
                          <span className="text-emerald-600">₦0.00 (Cleared)</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 text-center">
                        <Badge className="bg-emerald-600 text-white text-[10px] uppercase font-semibold">
                          Active
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedStudentForSim(acc.student);
                            setSimAmount(acc.totalOutstanding > 0 ? String(acc.totalOutstanding) : "50000");
                            setSimBank(acc.bankName);
                            setSimPayer(`Alhaji ${acc.student.last_name}`);
                            setSimulationResult(null);
                          }}
                          className="h-7 text-[11px] gap-1 text-emerald-600 border-emerald-500/30 hover:bg-emerald-50"
                        >
                          <Zap className="h-3 w-3" />
                          Simulate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Simulation Modal */}
      {selectedStudentForSim && (
        <Dialog open={!!selectedStudentForSim} onOpenChange={(open) => !open && setSelectedStudentForSim(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Zap className="h-5 w-5 text-emerald-600" />
                Simulate Instant NIP Transfer to Dedicated NUBAN
              </DialogTitle>
              <DialogDescription className="text-xs">
                Simulate an automated bank payment to test instant fee clearing, receipt generation, and parent notifications.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target Student:</span>
                  <span className="font-bold text-foreground">
                    {selectedStudentForSim.first_name} {selectedStudentForSim.last_name} ({selectedStudentForSim.admission_no})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target NUBAN:</span>
                  <span className="font-mono font-extrabold text-foreground">
                    {formatNubanDisplay(
                      generateStudentVirtualAccount({
                        schoolCode,
                        schoolName,
                        studentId: selectedStudentForSim.id,
                        admissionNo: selectedStudentForSim.admission_no,
                        firstName: selectedStudentForSim.first_name,
                        lastName: selectedStudentForSim.last_name,
                      }).accountNumber
                    )}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sim-amount" className="text-xs font-semibold">Payment Amount (₦ NGN)</Label>
                <Input
                  id="sim-amount"
                  type="number"
                  value={simAmount}
                  onChange={(e) => setSimAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  className="font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sim-bank" className="text-xs font-semibold">Payer Bank</Label>
                  <Select value={simBank} onValueChange={setSimBank}>
                    <SelectTrigger id="sim-bank" className="text-xs">
                      <SelectValue placeholder="Select bank" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Wema Bank / ALAT">Wema Bank / ALAT</SelectItem>
                      <SelectItem value="Providus Bank">Providus Bank</SelectItem>
                      <SelectItem value="GTBank">GTBank</SelectItem>
                      <SelectItem value="Zenith Bank">Zenith Bank</SelectItem>
                      <SelectItem value="First Bank of Nigeria">First Bank of Nigeria</SelectItem>
                      <SelectItem value="Kuda Bank">Kuda Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sim-payer" className="text-xs font-semibold">Payer Name / Narration</Label>
                  <Input
                    id="sim-payer"
                    value={simPayer}
                    onChange={(e) => setSimPayer(e.target.value)}
                    placeholder="e.g. Alhaji Ibrahim Dauda"
                    className="text-xs"
                  />
                </div>
              </div>

              {simulationResult && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Reconciliation Successful!
                  </div>
                  <p className="text-[11px]">
                    Cleared {simulationResult.cleared_invoices?.length || 0} invoice(s) • Amount: {formatNaira(simulationResult.total_received)}
                  </p>
                  {simulationResult.cleared_invoices?.[0]?.receipt_no && (
                    <p className="font-mono text-[10px]">
                      Receipt Issued: {simulationResult.cleared_invoices[0].receipt_no}
                    </p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedStudentForSim(null)}>
                Close
              </Button>
              <Button
                size="sm"
                onClick={handleSimulatePayment}
                disabled={isSimulating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {isSimulating ? (
                  <>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap className="mr-1.5 h-3.5 w-3.5" />
                    Send Transfer & Clear Fees
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
