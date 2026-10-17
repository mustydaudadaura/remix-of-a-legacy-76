import { useEffect, useState, useRef, useMemo } from "react";
import QRCode from "qrcode";
import { formatNaira, invoiceOutstanding, resolveFeeBreakdown, allocatePaymentToBreakdown } from "@/lib/finance-math";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, Download, Copy, Check, ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export interface ReceiptData {
  payment: {
    id: string;
    receipt_no: string;
    amount: number | string;
    method: string;
    reference?: string | null;
    paid_at: string;
    notes?: string | null;
    recorded_by_name?: string | null;
  };
  invoice?: {
    id?: string;
    title: string;
    session: string;
    term: string;
    amount_due: number | string;
    amount_paid: number | string;
    discount_amount?: number | string | null;
    discount_reason?: string | null;
    discount_kind?: string | null;
    status?: string;
    due_date?: string | null;
  } | null;
  student?: {
    id?: string;
    first_name: string;
    last_name: string;
    middle_name?: string | null;
    admission_no: string;
    classes?: { name: string } | null;
    class_name?: string | null;
  } | null;
  school?: {
    name?: string;
    logo_url?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    motto?: string | null;
    branch_name?: string | null;
  } | null;
}

export function DigitalReceipt({ data, onClose }: { data: ReceiptData; onClose?: () => void }) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const { payment, invoice, student, school } = data;
  const studentName = [student?.first_name, student?.middle_name, student?.last_name].filter(Boolean).join(" ");
  const className = student?.classes?.name ?? student?.class_name ?? "—";

  const originalBilled = Number(invoice?.amount_due ?? payment.amount);
  const discount = Number(invoice?.discount_amount ?? 0);
  const netPayable = Math.max(originalBilled - discount, 0);
  const totalPaid = Number(invoice?.amount_paid ?? payment.amount);
  const pendingBalance = invoice ? invoiceOutstanding(invoice) : 0;
  const isFullyPaid = pendingBalance <= 0;

  const breakdownItems = useMemo(() => {
    return resolveFeeBreakdown(invoice?.title || "Tuition / Term Fee", originalBilled);
  }, [invoice?.title, originalBilled]);

  const allocatedBreakdown = useMemo(() => {
    return allocatePaymentToBreakdown(breakdownItems, totalPaid);
  }, [breakdownItems, totalPaid]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const origin = window.location.origin;
    // Verification payload or direct verification link
    const verificationUrl = `${origin}/portal/receipt/${payment.id}`;
    QRCode.toDataURL(verificationUrl, {
      width: 140,
      margin: 1,
      color: {
        dark: "#1e1e2d",
        light: "#ffffff",
      },
    })
      .then(setQrCodeUrl)
      .catch((err) => console.error("Error generating QR", err));
  }, [payment.id, payment.receipt_no]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/portal/receipt/${payment.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success("Receipt verification link copied to clipboard");
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const formatMethod = (method: string) => {
    switch (method.toLowerCase()) {
      case "bank_transfer":
        return "Bank Transfer";
      case "pos":
        return "POS Terminal";
      case "online":
        return "Online Card / Web";
      case "cash":
        return "Cash at Bursary";
      default:
        return method.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Top action bar (hidden in print) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 print:hidden">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 border-emerald-500 text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-950/30">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Verified Electronic Receipt
          </Badge>
          <span className="text-xs text-muted-foreground font-mono">{payment.receipt_no}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleCopyLink} className="h-8 text-xs">
            {copied ? <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
            {copied ? "Copied Link" : "Copy Link"}
          </Button>
          <Button size="sm" onClick={handlePrint} className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm">
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Printable Receipt Paper */}
      <div
        ref={printRef}
        className="rounded-xl border border-border bg-card text-card-foreground p-6 sm:p-8 shadow-sm print:p-0 print:border-0 print:shadow-none print:m-0 text-foreground relative overflow-hidden"
      >
        {/* Top Header & Crest */}
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 border-b border-border pb-5">
          <div className="flex items-start gap-4">
            {school?.logo_url ? (
              <img src={school.logo_url} alt="School Logo" className="h-16 w-16 object-contain rounded-md" />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xl border border-primary/20 shrink-0">
                {(school?.name || "EduERP").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-lg sm:text-xl font-bold uppercase tracking-tight text-foreground">
                {school?.name || "Result Arena / EduERP High School"}
              </h2>
              {school?.motto && (
                <p className="text-xs italic text-muted-foreground mt-0.5">"{school.motto}"</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {[school?.address, school?.phone, school?.email].filter(Boolean).join(" • ")}
              </p>
              {school?.branch_name && (
                <span className="inline-block mt-1 text-[11px] font-semibold text-primary">
                  Campus: {school.branch_name}
                </span>
              )}
            </div>
          </div>

          <div className="text-left sm:text-right shrink-0 bg-muted/40 p-3 rounded-lg border border-border/70 sm:bg-transparent sm:p-0 sm:border-0">
            <div className="text-[10px] uppercase font-bold tracking-widest text-primary">
              Official Receipt
            </div>
            <div className="font-mono text-base font-extrabold text-foreground">
              {payment.receipt_no}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {new Date(payment.paid_at).toLocaleString("en-NG", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </div>
          </div>
        </div>

        {/* Amount Paid Banner */}
        <div className="my-5 p-4 rounded-lg bg-gradient-to-r from-primary/10 via-accent/5 to-transparent border border-primary/20 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
              Amount Paid in This Transaction
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
              {formatNaira(payment.amount)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Payment Method: <span className="font-semibold text-foreground">{formatMethod(payment.method)}</span>
              {payment.reference && (
                <span> • Ref: <span className="font-mono text-foreground font-semibold">{payment.reference}</span></span>
              )}
            </div>
          </div>

          <div>
            {isFullyPaid ? (
              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1 text-xs gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Fee Cleared / Paid In Full
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-1 text-xs font-semibold">
                Pending Balance: {formatNaira(pendingBalance)}
              </Badge>
            )}
          </div>
        </div>

        {/* Student & Term Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-y border-border text-xs">
          <div>
            <span className="text-muted-foreground block text-[11px] uppercase tracking-wider">Student Name</span>
            <span className="font-semibold text-foreground text-sm">{studentName || "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px] uppercase tracking-wider">Admission No.</span>
            <span className="font-mono font-bold text-foreground text-sm">{student?.admission_no || "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px] uppercase tracking-wider">Class</span>
            <span className="font-medium text-foreground text-sm">{className}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px] uppercase tracking-wider">Session & Term</span>
            <span className="font-medium text-foreground text-sm capitalize">
              {invoice?.session || "Current"} • {invoice?.term || "First"} Term
            </span>
          </div>
        </div>

        {/* Financial Breakdown Table */}
        <div className="mt-5">
          <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground mb-2">
            Fee & Payment Breakdown
          </h4>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/60 border-b border-border">
                <tr className="text-left text-muted-foreground">
                  <th className="py-2.5 px-3 font-semibold">Fee Description</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Billed</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Discount / Waiver</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Net Payable</th>
                  <th className="py-2.5 px-3 text-right font-semibold">This Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-3 px-3">
                    <div className="font-semibold text-foreground text-sm">{invoice?.title || "Tuition / Term Fee"}</div>
                    <div className="text-[11px] text-muted-foreground capitalize">
                      {invoice?.session} • {invoice?.term} Term
                      {invoice?.due_date && ` • Due ${new Date(invoice.due_date).toLocaleDateString()}`}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-medium">{formatNaira(originalBilled)}</td>
                  <td className="py-3 px-3 text-right">
                    {discount > 0 ? (
                      <div>
                        <span className="font-medium text-amber-600 dark:text-amber-400">-{formatNaira(discount)}</span>
                        {invoice?.discount_reason && (
                          <div className="text-[10px] text-muted-foreground italic truncate max-w-[120px] ml-auto">
                            {invoice.discount_reason}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-semibold">{formatNaira(netPayable)}</td>
                  <td className="py-3 px-3 text-right font-bold text-primary">{formatNaira(payment.amount)}</td>
                </tr>
              </tbody>
              <tfoot className="bg-muted/30 font-semibold border-t border-border">
                <tr>
                  <td colSpan={4} className="py-2.5 px-3 text-right text-muted-foreground">Cumulative Paid to Date:</td>
                  <td className="py-2.5 px-3 text-right font-bold text-foreground">{formatNaira(totalPaid)}</td>
                </tr>
                <tr className="border-t border-border/80">
                  <td colSpan={4} className="py-2.5 px-3 text-right text-muted-foreground">Remaining Pending Balance:</td>
                  <td className={`py-2.5 px-3 text-right font-bold ${pendingBalance > 0 ? "text-destructive" : "text-emerald-600"}`}>
                    {pendingBalance > 0 ? formatNaira(pendingBalance) : "₦0.00 (Cleared)"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Standard Nigerian Fee Itemization (Tuition, PTA, Uniforms, Books, Boarding) */}
          {breakdownItems.length > 1 && (
            <div className="mt-3 p-3 rounded-lg border border-border/70 bg-muted/20">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
                <span>Statutory Nigerian Fee Breakdown</span>
                <span className="text-[10px] font-normal lowercase">Tuition • PTA • Uniforms • Books • Boarding</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                {allocatedBreakdown.map((item) => (
                  <div key={item.category} className="p-2 rounded bg-background/80 border border-border/60">
                    <div className="text-muted-foreground truncate">{item.name}</div>
                    <div className="flex items-center justify-between mt-1 font-mono font-semibold">
                      <span>{formatNaira(item.amount)}</span>
                      <span className={item.remaining === 0 ? "text-emerald-600 text-[10px]" : "text-amber-600 text-[10px]"}>
                        {item.remaining === 0 ? "✓ Cleared" : `${formatNaira(item.allocated)} pd`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {payment.notes && (
          <div className="mt-4 p-2.5 rounded-md bg-muted/30 border border-border text-xs">
            <span className="font-semibold text-muted-foreground">Payment Notes:</span>{" "}
            <span className="text-foreground">{payment.notes}</span>
          </div>
        )}

        {/* Verification & Stamp Footer */}
        <div className="mt-8 pt-5 border-t border-dashed border-border flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            {qrCodeUrl && (
              <img
                src={qrCodeUrl}
                alt="Verification QR Code"
                className="h-20 w-20 border border-border p-1 rounded-md bg-white shrink-0"
              />
            )}
            <div className="text-[11px] text-muted-foreground space-y-0.5">
              <div className="font-bold text-foreground flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Tamper-Proof Digital Verification
              </div>
              <p>Scan this QR code with any camera to verify this payment on EduERP.</p>
              <p className="font-mono text-[10px]">Receipt ID: {payment.id}</p>
            </div>
          </div>

          <div className="text-center sm:text-right shrink-0">
            <div className="inline-block border-b-2 border-foreground/40 w-36 mb-1 pb-4">
              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider">
                ✓ System Authorized
              </div>
            </div>
            <div className="text-xs font-semibold text-foreground">Bursary & Accounts Dept.</div>
            <div className="text-[11px] text-muted-foreground">
              {payment.recorded_by_name ? `Recorded by ${payment.recorded_by_name}` : "EduERP Automated Clearance"}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[10px] text-muted-foreground border-t border-border pt-3">
          This receipt was generated electronically and is valid without an embossed physical seal.
          Retain for your school fee audit records.
        </p>
      </div>

      {onClose && (
        <div className="flex justify-end print:hidden">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
    </div>
  );
}
