import { useState, useMemo } from "react";
import { formatNaira } from "@/lib/finance-math";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DigitalReceipt, type ReceiptData } from "@/components/finance/DigitalReceipt";
import { Search, Receipt, Download, Filter, Calendar, CreditCard, Building2, Wallet } from "lucide-react";
import { toast } from "sonner";

export interface PaymentRecord {
  id: string;
  receipt_no: string;
  amount: number;
  method: string;
  reference: string | null;
  paid_at: string;
  notes: string | null;
  recorded_by?: string | null;
  student_id: string;
  invoice_id: string;
  students?: {
    id: string;
    first_name: string;
    last_name: string;
    admission_no: string;
    classes?: { name: string } | null;
  } | null;
  fee_invoices?: {
    id: string;
    title: string;
    session: string;
    term: string;
    amount_due: number;
    amount_paid: number;
    discount_amount?: number | null;
    discount_reason?: string | null;
    discount_kind?: string | null;
    status: string;
    due_date?: string | null;
  } | null;
}

export function PaymentHistoryTable({
  payments,
  school,
  isLoading = false,
}: {
  payments: PaymentRecord[];
  school?: any;
  isLoading?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all");
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      // Search filter
      const q = search.toLowerCase().trim();
      if (q) {
        const studentName = `${p.students?.first_name ?? ""} ${p.students?.last_name ?? ""}`.toLowerCase();
        const adm = (p.students?.admission_no ?? "").toLowerCase();
        const rcp = (p.receipt_no ?? "").toLowerCase();
        const ref = (p.reference ?? "").toLowerCase();
        const invTitle = (p.fee_invoices?.title ?? "").toLowerCase();
        if (!studentName.includes(q) && !adm.includes(q) && !rcp.includes(q) && !ref.includes(q) && !invTitle.includes(q)) {
          return false;
        }
      }

      // Method filter
      if (methodFilter !== "all" && p.method !== methodFilter) {
        return false;
      }

      // Time filter
      if (timeFilter !== "all") {
        const date = new Date(p.paid_at);
        const now = new Date();
        if (timeFilter === "today") {
          const isToday = date.toDateString() === now.toDateString();
          if (!isToday) return false;
        } else if (timeFilter === "week") {
          const diffDays = (now.getTime() - date.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 7) return false;
        } else if (timeFilter === "month") {
          const diffDays = (now.getTime() - date.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 30) return false;
        }
      }

      return true;
    });
  }, [payments, search, methodFilter, timeFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    let totalAmount = 0;
    const methodCounts: Record<string, { count: number; sum: number }> = {
      cash: { count: 0, sum: 0 },
      bank_transfer: { count: 0, sum: 0 },
      pos: { count: 0, sum: 0 },
      online: { count: 0, sum: 0 },
    };

    for (const p of filtered) {
      const amt = Number(p.amount) || 0;
      totalAmount += amt;
      const m = p.method?.toLowerCase() || "cash";
      if (!methodCounts[m]) {
        methodCounts[m] = { count: 0, sum: 0 };
      }
      methodCounts[m].count += 1;
      methodCounts[m].sum += amt;
    }

    return { totalAmount, count: filtered.length, methodCounts };
  }, [filtered]);

  const openReceipt = (p: PaymentRecord) => {
    setSelectedReceipt({
      payment: {
        id: p.id,
        receipt_no: p.receipt_no,
        amount: p.amount,
        method: p.method,
        reference: p.reference,
        paid_at: p.paid_at,
        notes: p.notes,
      },
      invoice: p.fee_invoices ?? {
        title: "School Fee",
        session: "2025/2026",
        term: "first",
        amount_due: p.amount,
        amount_paid: p.amount,
      },
      student: p.students,
      school,
    });
  };

  const exportCSV = () => {
    if (!filtered.length) {
      toast.error("No records to export");
      return;
    }
    const headers = ["Receipt No", "Date", "Student Name", "Admission No", "Class", "Fee Title", "Amount (NGN)", "Payment Method", "Reference", "Notes"];
    const rows = filtered.map((p) => [
      p.receipt_no,
      new Date(p.paid_at).toLocaleString(),
      `"${p.students?.first_name ?? ""} ${p.students?.last_name ?? ""}"`,
      `"${p.students?.admission_no ?? ""}"`,
      `"${p.students?.classes?.name ?? ""}"`,
      `"${p.fee_invoices?.title ?? ""}"`,
      p.amount,
      p.method,
      `"${p.reference ?? ""}"`,
      `"${p.notes ?? ""}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `payment-history-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filtered.length} payment records`);
  };

  const getMethodBadge = (method: string) => {
    switch (method?.toLowerCase()) {
      case "bank_transfer":
        return <Badge variant="outline" className="border-blue-500/30 text-blue-600 bg-blue-50 dark:bg-blue-950/20 font-medium text-[11px]">Bank Transfer</Badge>;
      case "pos":
        return <Badge variant="outline" className="border-purple-500/30 text-purple-600 bg-purple-50 dark:bg-purple-950/20 font-medium text-[11px]">POS Terminal</Badge>;
      case "online":
        return <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 font-medium text-[11px]">Online</Badge>;
      case "cash":
        return <Badge variant="outline" className="border-slate-400 text-slate-700 dark:text-slate-300 font-medium text-[11px]">Cash</Badge>;
      default:
        return <Badge variant="outline" className="capitalize text-[11px]">{method}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium">Total Collected</span>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-foreground">{formatNaira(stats.totalAmount)}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{stats.count} transactions recorded</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium">Bank Transfers</span>
            <Building2 className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-foreground">
            {formatNaira(stats.methodCounts.bank_transfer?.sum ?? 0)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {stats.methodCounts.bank_transfer?.count ?? 0} payments
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium">POS Terminal</span>
            <CreditCard className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-foreground">
            {formatNaira(stats.methodCounts.pos?.sum ?? 0)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {stats.methodCounts.pos?.count ?? 0} payments
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium">Cash at Bursary</span>
            <Wallet className="h-4 w-4 text-slate-600" />
          </div>
          <div className="text-xl font-bold text-foreground">
            {formatNaira(stats.methodCounts.cash?.sum ?? 0)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {stats.methodCounts.cash?.count ?? 0} payments
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by student name, admission number, receipt or reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs sm:text-sm bg-background"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-[140px] text-xs h-9 bg-background">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Payment Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="pos">POS Terminal</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="online">Online</SelectItem>
            </SelectContent>
          </Select>

          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-[130px] text-xs h-9 bg-background">
              <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Past 7 Days</SelectItem>
              <SelectItem value="month">Past 30 Days</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={exportCSV} className="h-9 text-xs">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[130px]">Receipt No.</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Fee Item</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount Paid</TableHead>
                <TableHead className="text-right">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const studentName = `${p.students?.first_name ?? ""} ${p.students?.last_name ?? ""}`.trim() || "Student";
                return (
                  <TableRow key={p.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs font-bold text-foreground">
                      {p.receipt_no}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(p.paid_at).toLocaleDateString("en-NG", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      <span className="block text-[10px] text-muted-foreground">
                        {new Date(p.paid_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm text-foreground">{studentName}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-[11px] text-muted-foreground">{p.students?.admission_no}</span>
                        {p.students?.classes?.name && (
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                            {p.students.classes.name}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium text-foreground">{p.fee_invoices?.title || "Fee Item"}</div>
                      <div className="text-[11px] text-muted-foreground capitalize">
                        {p.fee_invoices?.session} • {p.fee_invoices?.term} Term
                      </div>
                    </TableCell>
                    <TableCell>{getMethodBadge(p.method)}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {p.reference ? (
                        <span title={p.reference} className="truncate max-w-[120px] inline-block">
                          {p.reference}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold text-sm text-emerald-600 dark:text-emerald-400">
                      {formatNaira(p.amount)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openReceipt(p)}
                        className="h-8 text-xs gap-1 border-primary/20 hover:bg-primary/10 text-primary"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        Digital Receipt
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}

              {!filtered.length && !isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <Receipt className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm font-medium">No payment records found</p>
                    <p className="text-xs">Try adjusting your search criteria or payment method filters.</p>
                  </TableCell>
                </TableRow>
              )}

              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                    Loading payment records...
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Digital Receipt Modal */}
      {selectedReceipt && (
        <Dialog open={!!selectedReceipt} onOpenChange={(open) => !open && setSelectedReceipt(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Digital Payment Receipt
              </DialogTitle>
            </DialogHeader>
            <DigitalReceipt data={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
