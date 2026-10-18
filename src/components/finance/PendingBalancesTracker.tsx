import { useState, useMemo } from "react";
import { formatNaira, invoiceOutstanding, paymentProgressPercentage, calculateCollectionTotals, resolveFeeBreakdown } from "@/lib/finance-math";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, AlertTriangle, CheckCircle2, Clock, DollarSign, Download, Filter, BellRing, Percent } from "lucide-react";
import { toast } from "sonner";

export interface PendingInvoice {
  id: string;
  title: string;
  session: string;
  term: string;
  amount_due: number;
  amount_paid: number;
  discount_amount: number;
  discount_reason: string | null;
  discount_kind: string | null;
  status: string;
  due_date: string | null;
  students?: {
    id: string;
    first_name: string;
    last_name: string;
    admission_no: string;
    class_id?: string | null;
    classes?: { id: string; name: string } | null;
  } | null;
}

export function PendingBalancesTracker({
  invoices,
  classes = [],
  onRecordPayment,
  onApplyDiscount,
  onNotifyDefaulters,
}: {
  invoices: PendingInvoice[];
  classes?: Array<{ id: string; name: string }>;
  onRecordPayment: (invoice: PendingInvoice) => void;
  onApplyDiscount: (invoice: PendingInvoice) => void;
  onNotifyDefaulters?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("owing"); // owing, overdue, partial, unpaid, all

  const nowTime = useMemo(() => Date.now(), []);

  // Filtered list
  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const bal = invoiceOutstanding(inv);

      // Status filter
      const isOverdue = inv.due_date ? new Date(inv.due_date).getTime() < nowTime && bal > 0 : false;
      const isPartial = Number(inv.amount_paid) > 0 && bal > 0;
      const isUnpaid = Number(inv.amount_paid) === 0 && bal > 0;

      if (statusFilter === "owing" && bal <= 0) return false;
      if (statusFilter === "overdue" && !isOverdue) return false;
      if (statusFilter === "partial" && !isPartial) return false;
      if (statusFilter === "unpaid" && !isUnpaid) return false;
      if (statusFilter === "cleared" && bal > 0) return false;

      // Class filter
      if (classFilter !== "all") {
        const studentClassId = inv.students?.class_id || inv.students?.classes?.id;
        if (studentClassId !== classFilter) return false;
      }

      // Search filter
      const q = search.toLowerCase().trim();
      if (q) {
        const studentName = `${inv.students?.first_name ?? ""} ${inv.students?.last_name ?? ""}`.toLowerCase();
        const adm = (inv.students?.admission_no ?? "").toLowerCase();
        const title = (inv.title ?? "").toLowerCase();
        if (!studentName.includes(q) && !adm.includes(q) && !title.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, search, classFilter, statusFilter, nowTime]);

  // Unified financial statistics using shared math module
  const totals = useMemo(() => {
    return calculateCollectionTotals(invoices);
  }, [invoices]);

  const overdueCount = useMemo(() => {
    return invoices.filter((inv) => {
      const bal = invoiceOutstanding(inv);
      return bal > 0 && inv.due_date && new Date(inv.due_date).getTime() < nowTime;
    }).length;
  }, [invoices, nowTime]);

  const exportPendingCSV = () => {
    const owingInvoices = filtered.filter((i) => invoiceOutstanding(i) > 0);
    if (!owingInvoices.length) {
      toast.error("No pending balances to export");
      return;
    }

    const headers = [
      "Student Name",
      "Admission No",
      "Class",
      "Fee Title",
      "Term",
      "Original Billed",
      "Discount",
      "Amount Paid",
      "Outstanding Balance",
      "Due Date",
      "Status",
    ];

    const rows = owingInvoices.map((inv) => [
      `"${inv.students?.first_name ?? ""} ${inv.students?.last_name ?? ""}"`,
      `"${inv.students?.admission_no ?? ""}"`,
      `"${inv.students?.classes?.name ?? ""}"`,
      `"${inv.title}"`,
      `"${inv.session} ${inv.term}"`,
      inv.amount_due,
      inv.discount_amount ?? 0,
      inv.amount_paid,
      invoiceOutstanding(inv),
      inv.due_date ?? "N/A",
      inv.status,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pending-fee-balances-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${owingInvoices.length} pending balances`);
  };

  return (
    <div className="space-y-4">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground font-medium mb-1">Total Invoiced</div>
          <div className="text-xl font-bold text-foreground">{formatNaira(totals.billed)}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Gross fee billing</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground font-medium mb-1">Discounts / Waivers</div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
            {formatNaira(totals.discounts)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Approved reductions</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground font-medium mb-1">Total Collected</div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatNaira(totals.collected)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {totals.collectionRate}% collection rate
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm border-destructive/20 bg-destructive/5">
          <div className="text-xs text-destructive font-medium mb-1 flex items-center justify-between">
            <span>Pending Balance</span>
            <AlertTriangle className="h-3.5 w-3.5" />
          </div>
          <div className="text-xl font-bold text-destructive">{formatNaira(totals.outstanding)}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Awaiting collection</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm col-span-2 sm:col-span-1">
          <div className="text-xs text-muted-foreground font-medium mb-1 flex items-center justify-between">
            <span>Overdue Invoices</span>
            <Clock className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-foreground">{overdueCount}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Past settlement deadline</p>
        </div>
      </div>

      {/* Filter and Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by student name, admission number, or fee title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs sm:text-sm bg-background"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] text-xs h-9 bg-background">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="owing">All Pending Balances</SelectItem>
              <SelectItem value="overdue">Overdue Deadlines</SelectItem>
              <SelectItem value="partial">Partially Paid</SelectItem>
              <SelectItem value="unpaid">Zero Payment Made</SelectItem>
              <SelectItem value="cleared">Fully Cleared (₦0)</SelectItem>
              <SelectItem value="all">All Invoices</SelectItem>
            </SelectContent>
          </Select>

          {classes.length > 0 && (
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-[140px] text-xs h-9 bg-background">
                <SelectValue placeholder="Class" />
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
          )}

          <Button variant="outline" size="sm" onClick={exportPendingCSV} className="h-9 text-xs">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export Defaulters
          </Button>

          {onNotifyDefaulters && (
            <Button
              size="sm"
              variant="default"
              onClick={onNotifyDefaulters}
              className="h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <BellRing className="h-3.5 w-3.5 mr-1.5" />
              Notify Defaulters
            </Button>
          )}
        </div>
      </div>

      {/* Outstanding Invoices Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Fee Item</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead className="text-right">Billed</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="w-[140px]">Progress</TableHead>
                <TableHead className="text-right">Pending Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inv) => {
                const bal = invoiceOutstanding(inv);
                const progress = paymentProgressPercentage(inv);
                const isOverdue = inv.due_date ? new Date(inv.due_date).getTime() < nowTime && bal > 0 : false;
                const studentName = `${inv.students?.first_name ?? ""} ${inv.students?.last_name ?? ""}`.trim() || "Student";

                return (
                  <TableRow key={inv.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="font-semibold text-sm text-foreground">{studentName}</div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="font-mono text-[11px] text-muted-foreground">{inv.students?.admission_no}</span>
                        {inv.students?.classes?.name && (
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                            {inv.students.classes.name}
                          </Badge>
                        )}
                        <span className="text-[10px] font-mono bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-1 py-0.2 rounded border border-emerald-500/20">
                          Auto-VA
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-xs">
                      <div className="font-semibold text-foreground">{inv.title}</div>
                      <div className="text-[11px] text-muted-foreground capitalize">
                        {inv.session} • {inv.term} Term
                      </div>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <span className="text-[9px] bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-1 py-0.2 rounded border border-blue-200 dark:border-blue-800">
                          Tuition
                        </span>
                        <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-1 py-0.2 rounded border border-emerald-200 dark:border-emerald-800">
                          PTA
                        </span>
                        <span className="text-[9px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-1 py-0.2 rounded border border-amber-200 dark:border-amber-800">
                          Uniforms
                        </span>
                        <span className="text-[9px] bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-1 py-0.2 rounded border border-purple-200 dark:border-purple-800">
                          Books
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-xs whitespace-nowrap">
                      {inv.due_date ? (
                        <div>
                          <span>{new Date(inv.due_date).toLocaleDateString()}</span>
                          {isOverdue && (
                            <Badge variant="destructive" className="ml-1 text-[10px] py-0 px-1">
                              Overdue
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Not set</span>
                      )}
                    </TableCell>

                    <TableCell className="text-right text-xs font-medium">
                      {formatNaira(inv.amount_due)}
                    </TableCell>

                    <TableCell className="text-right text-xs">
                      {Number(inv.discount_amount) > 0 ? (
                        <span className="text-amber-600 font-medium" title={inv.discount_reason ?? ""}>
                          -{formatNaira(inv.discount_amount)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="text-right text-xs font-medium text-emerald-600">
                      {formatNaira(inv.amount_paid)}
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-medium">{progress}%</span>
                          <span className="text-muted-foreground">
                            {bal <= 0 ? "Settled" : progress > 0 ? "Partial" : "Unpaid"}
                          </span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                      </div>
                    </TableCell>

                    <TableCell className="text-right font-bold text-sm">
                      {bal > 0 ? (
                        <span className={isOverdue ? "text-destructive" : "text-foreground"}>
                          {formatNaira(bal)}
                        </span>
                      ) : (
                        <span className="text-emerald-600 flex items-center justify-end gap-1 text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Cleared
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant={bal > 0 ? "default" : "outline"}
                          disabled={bal <= 0}
                          onClick={() => onRecordPayment(inv)}
                          className="h-7 text-xs px-2.5"
                        >
                          <DollarSign className="h-3.5 w-3.5 mr-1" />
                          Pay
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onApplyDiscount(inv)}
                          title="Apply Discount or Waiver"
                          className="h-7 w-7 p-0"
                        >
                          <Percent className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {!filtered.length && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-600/50 mb-2" />
                    <p className="text-sm font-medium">No pending balances matching your criteria</p>
                    <p className="text-xs">All accounts in this selection are up-to-date or no records match.</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
