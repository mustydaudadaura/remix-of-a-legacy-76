import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchool } from "@/hooks/useSchool";
import { financeSummary, type FinanceSummary } from "@/lib/api/finance.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer } from "lucide-react";
import { toast } from "sonner";

const money = (n: number) => `₦${Math.round(n).toLocaleString()}`;

export function FinanceReports() {
  const { schoolId } = useAuth();
  const { school } = useSchool();
  const [session, setSession] = useState("");
  const [term, setTerm] = useState<"first" | "second" | "third">("first");
  useEffect(() => {
    if (school?.current_session) setSession((s) => s || school.current_session!);
    if (school?.current_term) setTerm((t) => t || (school.current_term as any));
  }, [school?.current_session, school?.current_term]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);

  const load = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return;
    setBusy(true);
    try {
      setSummary(await financeSummary({ data: { school_id: schoolId, session, term, month } }));
      setPrinting(false);
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
          <CardTitle className="text-base">Termly finance report</CardTitle>
          <form onSubmit={load} className="flex flex-wrap items-end gap-2">
            <div><Label>Session</Label><Input value={session} onChange={(e) => setSession(e.target.value)} className="w-32" placeholder="2025/2026" /></div>
            <div><Label>Term</Label>
              <Select value={term} onValueChange={(v: any) => setTerm(v)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="first">First</SelectItem><SelectItem value="second">Second</SelectItem><SelectItem value="third">Third</SelectItem>
                </SelectContent>
              </Select></div>
            <div><Label>Payroll month</Label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" /></div>
            <Button type="submit" disabled={busy || !session}>{busy ? "Working…" : "Show report"}</Button>
          </form>
        </CardHeader>
        <CardContent>
          {!summary && <p className="text-sm text-muted-foreground">Choose a session and term, then press Show report.</p>}
          {summary && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <Stat label="Billed" value={money(summary.billed)} />
                <Stat label="Discounts" value={money(summary.discounted)} tone="muted" />
                <Stat label="Collected" value={money(summary.collected)} tone="good" />
                <Stat label="Outstanding" value={money(summary.outstanding)} tone="bad" />
                <Stat label="Expenses" value={money(summary.expenseTotal)} tone="bad" />
                <Stat label="Salaries" value={money(summary.payrollTotal)} tone="muted" />
              </div>
              <p className="text-sm">
                <b>Net position:</b>{" "}
                {summary.collected - summary.expenseTotal - summary.payrollPaid >= 0
                  ? money(summary.collected - summary.expenseTotal - summary.payrollPaid) + " in hand"
                  : money(Math.abs(summary.collected - summary.expenseTotal - summary.payrollPaid)) + " short"}
                {" "}<span className="text-muted-foreground">(collected, less expenses and salaries already released)</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {summary.invoices} invoice(s) for this term; {summary.defaulters} still owing.
                Salaries released: {money(summary.payrollPaid)}; awaiting release: {money(summary.payrollPending)}.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setPrinting(true)}><Printer className="mr-2 h-4 w-4" />Print report</Button>
              </div>
              {printing && <PrintSheet summary={summary} session={session} term={term} month={month} />}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" | "muted" }) {
  const colour = tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-destructive" : "text-muted-foreground";
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-base font-semibold ${tone ? colour : ""}`}>{value}</p>
    </div>
  );
}

function PrintSheet({ summary, session, term, month }: { summary: FinanceSummary; session: string; term: string; month: string }) {
  const { schoolId } = useAuth() as any;
  const { data: school } = useQuery({
    queryKey: ["finance-report-school", schoolId],
    queryFn: async () => (await supabase.from("schools").select("name, address, code").eq("id", schoolId!).maybeSingle()).data,
    enabled: !!schoolId,
  });
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/95 p-4">
      <div className="mb-3 flex justify-end print:hidden"><Button variant="outline" size="sm" onClick={() => window.print()}>Print / save PDF</Button></div>
      <div className="print-doc mx-auto max-w-3xl border p-6 text-sm">
        <div className="text-center">
          <h2 className="text-lg font-bold uppercase">{school?.name ?? "School"}</h2>
          <p className="text-xs">{school?.address}</p>
          <p className="mt-1 text-xs font-semibold uppercase">Finance report — {term} term, {session} (payroll month {month})</p>
        </div>
        <table className="mt-4 w-full border-collapse text-sm">
          <tbody>
            <Row label="Fees billed" value={money(summary.billed)} />
            <Row label="Discounts and scholarships" value={`- ${money(summary.discounted)}`} />
            <Row label="Fees collected" value={money(summary.collected)} />
            <Row label="Outstanding balance" value={money(summary.outstanding)} />
            <Row label="Pupils still owing" value={String(summary.defaulters)} />
            <Row label="Expenses recorded" value={money(summary.expenseTotal)} />
            <Row label="Salaries for the month" value={money(summary.payrollTotal)} />
            <Row label="Salaries already released" value={money(summary.payrollPaid)} />
            <Row label="Salaries awaiting release" value={money(summary.payrollPending)} />
            <Row label="Net in hand" value={money(summary.collected - summary.expenseTotal - summary.payrollPaid)} bold />
          </tbody>
        </table>
        {summary.expenseByCategory.length > 0 && (
          <div className="mt-4 border-t pt-2">
            <p className="text-xs font-semibold uppercase">Expenses by category</p>
            <table className="w-full border-collapse text-xs">
              <tbody>{summary.expenseByCategory.map((c) => <Row key={c.category} label={c.category} value={money(c.total)} />)}</tbody>
            </table>
          </div>
        )}
        <p className="mt-6 text-xs text-muted-foreground">Generated {new Date().toLocaleString("en-NG")} • School code {school?.code}</p>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <tr className={bold ? "border-t-2" : "border-b"}>
      <td className={`py-1 capitalize ${bold ? "font-bold" : ""}`}>{label}</td>
      <td className={`py-1 text-right ${bold ? "font-bold" : ""}`}>{value}</td>
    </tr>
  );
}
